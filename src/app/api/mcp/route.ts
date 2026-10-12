import { NextRequest, NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { verifyBearerToken } from "@/lib/services/credentials-service";
import { db } from "@/lib/db";
import { domainCreateTask, domainUpdateTask } from "@/lib/services/tasks-domain";
import { broadcastSyncEvent } from "@/lib/sync-events";

export const dynamic = "force-dynamic";

function jsonSuccess(data: any) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function jsonError(message: string, code: string = "ERROR") {
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify({ error: { code, message } }) }],
  };
}

async function createAtlasMcpServer(userId: string, credentialId: string) {
  const server = new McpServer({
    name: "atlas-mcp",
    version: "1.0.0",
  });

  // 1. atlas_find_tasks
  server.registerTool(
    "atlas_find_tasks",
    {
      description: "TASK SEARCH: Search or resolve existing tasks/quests by code (e.g. CR-421, ATS-22), title, PR URL, or status filter.",
      inputSchema: {
        query: z.string().optional().describe("Free-text search or code/PR number"),
        status: z.enum(["backlog", "todo", "in_progress", "done", "archived"]).optional(),
        isIdling: z.boolean().optional().describe("Filter tasks that have a waiting/idling reason set"),
        sourceKey: z.string().optional().describe("Canonical source key like github.com/owner/repo/pull/123"),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async ({ query, status, isIdling, sourceKey, limit }) => {
      try {
        const whereClause: any = {
          ownerId: userId,
          deletedAt: null,
        };

        if (status) {
          whereClause.status = status;
        }

        if (isIdling) {
          whereClause.waitingReason = { not: null };
        }

        if (sourceKey) {
          whereClause.sources = {
            some: {
              canonicalKey: { contains: sourceKey, mode: "insensitive" },
            },
          };
        } else if (query) {
          const q = query.trim();
          whereClause.OR = [
            { code: { equals: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { waitingReason: { contains: q, mode: "insensitive" } },
            {
              sources: {
                some: {
                  canonicalKey: { contains: q, mode: "insensitive" },
                },
              },
            },
          ];
        }

        const tasks = await db.task.findMany({
          where: whereClause,
          take: limit,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            priority: true,
            size: true,
            waitingReason: true,
            updatedAt: true,
            project: { select: { name: true } },
            sources: { select: { provider: true, canonicalKey: true, url: true } },
          },
        });

        return jsonSuccess({ count: tasks.length, tasks });
      } catch (err: any) {
        return jsonError(err?.message || "Failed to find tasks", "DB_ERROR");
      }
    }
  );

  // 2. atlas_get_task_context
  server.registerTool(
    "atlas_get_task_context",
    {
      description: "TASK RECALL & RESUME: Retrieve distilled context, latest checkpoint, active runs, and session pointers for a specific task before resuming work. Avoids re-reading full transcripts.",
      inputSchema: {
        taskId: z.string().uuid().optional(),
        code: z.string().optional().describe("Task code like CR-421 or ATS-22"),
      },
    },
    async ({ taskId, code }) => {
      try {
        if (!taskId && !code) {
          return jsonError("Either taskId or code must be provided", "VALIDATION_ERROR");
        }

        const task = await db.task.findFirst({
          where: {
            ownerId: userId,
            deletedAt: null,
            ...(taskId ? { id: taskId } : {}),
            ...(code ? { code: { equals: code.trim(), mode: "insensitive" } } : {}),
          },
          include: {
            project: { select: { name: true, code: true } },
            sources: { select: { provider: true, canonicalKey: true, url: true } },
            checkpoints: {
              orderBy: { revision: "desc" },
              take: 3,
            },
            agentRuns: {
              orderBy: { startedAt: "desc" },
              take: 3,
              select: {
                id: true,
                agentName: true,
                sessionId: true,
                sessionTitle: true,
                platform: true,
                chatId: true,
                chatName: true,
                threadId: true,
                threadName: true,
                status: true,
                startedAt: true,
                endedAt: true,
              },
            },
          },
        });

        if (!task) {
          return jsonError("Task not found", "NOT_FOUND");
        }

        const latestCheckpoint = task.checkpoints[0] || null;

        return jsonSuccess({
          task: {
            id: task.id,
            code: task.code,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            project: task.project?.name,
            waitingReason: task.waitingReason,
            metadata: task.metadata,
            updatedAt: task.updatedAt,
          },
          latestCheckpoint,
          recentCheckpoints: task.checkpoints,
          recentRuns: task.agentRuns,
          sources: task.sources,
        });
      } catch (err: any) {
        return jsonError(err?.message || "Failed to get task context", "DB_ERROR");
      }
    }
  );

  // 3. atlas_create_task
  server.registerTool(
    "atlas_create_task",
    {
      description: "MANDATORY START STEP: Call this at the VERY BEGINNING (Turn 1, tool call 1) of any non-trivial user task or code review before reading, modifying, or executing code. Creates the active quest card on the live Kanban board in 'in_progress' status so the user can see it in real-time.",
      inputSchema: {
        title: z.string().min(1).describe("Concise task/quest title"),
        description: z.string().optional().describe("Context, PR description, or reproduction steps"),
        projectName: z.string().optional().describe("Name of project to assign (e.g. Dealls, Personal)"),
        status: z.enum(["backlog", "todo", "in_progress", "done"]).default("in_progress"),
        priority: z.enum(["high", "medium", "low"]).default("medium"),
        type: z.enum(["coding", "research", "design", "documentation", "bug", "meeting", "admin"]).default("coding"),
        size: z.enum(["xs", "s", "m", "l", "xl"]).optional().describe("Estimated task size"),
        waitingReason: z.string().optional().describe("If idling, why (e.g. Waiting for PR review)"),
        metadata: z.record(z.string(), z.any()).optional().describe("Extra structured info (models, prUrl, etc.)"),
        tags: z.array(z.string()).optional().describe("Tags / labels for the quest (e.g. ['security', 'auth', 'pr-421']). If omitted, tags are auto-inferred from title and project."),
        sessionId: z.string().optional().describe("Hermes session_id (e.g. 20261010_022039_e753711c)"),
        sessionTitle: z.string().optional().describe("Hermes session title (e.g. Review Database Schema)"),
        agentName: z.string().default("hermes").describe("Agent identifier name"),
        platform: z.string().optional().describe("e.g. telegram"),
        chatId: z.string().optional().describe("e.g. -1003905247788"),
        chatName: z.string().optional().describe("e.g. SC R&D / Solo Projects"),
        threadId: z.string().optional().describe("e.g. 2303"),
        threadName: z.string().optional().describe("e.g. Atlas - RPG Task Manager"),
        attachments: z
          .array(
            z.object({
              type: z.enum(["github_pr", "github_issue", "link", "file", "other"]).default("github_pr"),
              url: z.string(),
              label: z.string().optional(),
            })
          )
          .optional()
          .describe("Relevant links or PRs"),
        deliverables: z
          .array(
            z.object({
              type: z.enum(["pr", "doc", "design", "other"]).default("pr"),
              urlOrContent: z.string(),
            })
          )
          .optional()
          .describe("Final PR or outcome artifacts"),
        source: z
          .object({
            provider: z.string().default("github_pr"),
            canonicalKey: z.string(),
            url: z.string().optional(),
          })
          .optional(),
      },
    },
    async ({ title, description, projectName, status, priority, type, size, waitingReason, metadata, tags, sessionId, sessionTitle, agentName, platform, chatId, chatName, threadId, threadName, attachments, deliverables, source }) => {
      try {
        let projectId: string | undefined;
        if (projectName) {
          const trimmedProject = projectName.trim();
          let p = await db.project.findFirst({
            where: { ownerId: userId, name: { equals: trimmedProject, mode: "insensitive" } },
            select: { id: true, code: true, name: true },
          });

          // If project does not exist yet, auto-create it on the fly so tasks are never orphaned
          if (!p && trimmedProject) {
            try {
              const cleanAlpha = trimmedProject.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
              let baseCode = cleanAlpha.slice(0, 3);
              if (baseCode.length < 2) baseCode = (cleanAlpha + "PRJ").slice(0, 3);

              let candidateCode = baseCode;
              let suffix = 1;
              while (await db.project.findUnique({ where: { code: candidateCode } })) {
                candidateCode = `${baseCode.slice(0, 2)}${suffix}`;
                suffix++;
                if (suffix > 9) {
                  candidateCode = `P${Math.floor(100 + Math.random() * 900)}`;
                  break;
                }
              }

              p = await db.project.create({
                data: {
                  name: trimmedProject,
                  code: candidateCode,
                  category: "work",
                  colorVar: "--color-primary-gold",
                  emoji: "📁",
                  status: "active",
                  ownerId: userId,
                },
                select: { id: true, code: true, name: true },
              });

              await broadcastSyncEvent(userId, "sync:reload", { autoCreatedProject: p });
            } catch {
              // Fallback if concurrent project creation collision occurs
              p = await db.project.findFirst({
                where: { ownerId: userId, name: { equals: trimmedProject, mode: "insensitive" } },
                select: { id: true, code: true, name: true },
              });
            }
          }

          if (p) projectId = p.id;
        }

        // Auto-infer tags if none provided or empty
        let resolvedTags = (tags || []).map((t) => t.trim().toLowerCase()).filter(Boolean);
        if (resolvedTags.length === 0) {
          const inferred = new Set<string>();
          if (projectName) inferred.add(projectName.toLowerCase().replace(/[^a-z0-9-]/g, ""));
          if (type) inferred.add(type.toLowerCase().replace(/[^a-z0-9-]/g, ""));
          const prMatches = (title + " " + (description || "")).match(/#(\d+)/g);
          if (prMatches) {
            for (const m of prMatches) inferred.add(`pr-${m.replace("#", "")}`);
          }
          const words = title.toLowerCase().split(/[\s:,\-_/]+/);
          for (const w of words) {
            if (["review", "holding", "auth", "bug", "feature", "api", "db", "schema", "ui", "fix", "frontend", "backend"].includes(w)) {
              inferred.add(w);
            }
          }
          resolvedTags = Array.from(inferred).slice(0, 5);
        }

        const createRes = await domainCreateTask(userId, {
          title,
          description,
          projectId,
          status,
          priority,
          type,
          size,
          reporter: "other",
          waitingReason,
          tags: resolvedTags,
          attachments,
          deliverables,
          metadata: {
            ...metadata,
            agentReporter: "agent",
            createdByAgent: true,
            createdAtAgent: new Date().toISOString(),
          },
        });

        if (!createRes.success) {
          return jsonError(createRes.error.message, createRes.error.code);
        }

        const task = createRes.data.task;

        // Auto-create initial AgentRun so runs are never empty
        await db.agentRun.create({
          data: {
            taskId: task.id,
            credentialId,
            agentName: agentName || "hermes",
            sessionId,
            sessionTitle,
            platform: platform || "telegram",
            chatId,
            chatName,
            threadId,
            threadName,
            status: "active",
          },
        });

        if (source) {
          await db.taskSource.create({
            data: {
              taskId: task.id,
              provider: source.provider,
              canonicalKey: source.canonicalKey,
              url: source.url,
            },
          });
        }

        return jsonSuccess({
          message: "Task created successfully by AI Agent",
          task: {
            id: task.id,
            code: task.code,
            title: task.title,
            status: task.status,
            tags: resolvedTags,
            reporter: task.reporter,
          },
        });
      } catch (err: any) {
        return jsonError(err?.message || "Failed to create task", "INTERNAL");
      }
    }
  );

  // 4. atlas_start_run
  server.registerTool(
    "atlas_start_run",
    {
      description: "Start an active agent execution run on a task, storing Hermes session & topic metadata.",
      inputSchema: {
        taskId: z.string().uuid(),
        agentName: z.string().default("hermes"),
        sessionId: z.string().optional().describe("Hermes session_id (e.g. 20261010_022039_e753711c)"),
        sessionTitle: z.string().optional().describe("Hermes session title (e.g. Review Database Schema)"),
        platform: z.string().optional().describe("e.g. telegram"),
        chatId: z.string().optional().describe("e.g. -1003905247788"),
        chatName: z.string().optional().describe("e.g. SC R&D / Solo Projects"),
        threadId: z.string().optional().describe("e.g. 2303"),
        threadName: z.string().optional().describe("e.g. Solo Projects or topic title"),
        externalRunId: z.string().optional(),
      },
    },
    async ({ taskId, agentName, sessionId, sessionTitle, platform, chatId, chatName, threadId, threadName, externalRunId }) => {
      try {
        const task = await db.task.findFirst({
          where: { id: taskId, ownerId: userId, deletedAt: null },
          select: { id: true, status: true },
        });

        if (!task) return jsonError("Task not found", "NOT_FOUND");

        const run = await db.agentRun.create({
          data: {
            taskId,
            credentialId,
            agentName,
            sessionId,
            sessionTitle,
            platform,
            chatId,
            chatName,
            threadId,
            threadName,
            externalRunId,
            status: "active",
          },
        });

        if (task.status !== "in_progress") {
          await domainUpdateTask(userId, taskId, { status: "in_progress" });
        }

        return jsonSuccess({
          runId: run.id,
          taskId: run.taskId,
          status: run.status,
          startedAt: run.startedAt,
        });
      } catch (err: any) {
        return jsonError(err?.message || "Failed to start agent run", "INTERNAL");
      }
    }
  );

  // 5. atlas_save_checkpoint
  server.registerTool(
    "atlas_save_checkpoint",
    {
      description: "MILESTONE & STATE TRANSITION: Call this at key milestones (e.g. initial review done -> checkpointState='waiting_external' with waitingReason; or all issues resolved -> checkpointState='finished' which automatically marks the task 'done'). Auto-posts a summary comment.",
      inputSchema: {
        taskId: z.string().uuid(),
        runId: z.string().uuid().optional(),
        summary: z.string().min(1),
        checkpointState: z.enum(["in_progress", "waiting_external", "finished"]).optional(),
        waitingReason: z.string().optional(),
        nextStep: z.string().optional(),
        provenanceSource: z.string().optional().describe("e.g. commit SHA, PR link"),
        comment: z.string().optional().describe("Auto-post a comment under the task for teammates to read"),
      },
    },
    async ({ taskId, runId, summary, checkpointState, waitingReason, nextStep, provenanceSource, comment }) => {
      try {
        const task = await db.task.findFirst({
          where: { id: taskId, ownerId: userId, deletedAt: null },
          include: {
            checkpoints: {
              orderBy: { revision: "desc" },
              take: 1,
              select: { revision: true },
            },
          },
        });

        if (!task) return jsonError("Task not found", "NOT_FOUND");

        const nextRevision = (task.checkpoints[0]?.revision ?? 0) + 1;

        const checkpoint = await db.agentCheckpoint.create({
          data: {
            taskId,
            runId: runId || null,
            revision: nextRevision,
            summary,
            checkpointState,
            waitingReason,
            nextStep,
            provenanceSource,
          },
        });

        // Always auto-post a comment under the task with findings/progress
        const commentContent = comment
          ? `⚡ [MCP]: ${comment}`
          : `⚡ [MCP Checkpoint Rev #${nextRevision}]: ${summary}${waitingReason ? ` (Idling: ${waitingReason})` : ""}`;

        await db.comment.create({
          data: {
            taskId,
            authorId: userId,
            content: commentContent,
          },
        });

        // Sync back to task status or broadcast updated task via SSE
        if (checkpointState === "finished") {
          await domainUpdateTask(userId, taskId, {
            status: "done",
            waitingReason: null,
          });
        } else if (checkpointState === "waiting_external") {
          await domainUpdateTask(userId, taskId, {
            status: "in_progress",
            waitingReason: waitingReason || summary,
          });
        } else if (checkpointState === "in_progress") {
          await domainUpdateTask(userId, taskId, {
            status: "in_progress",
            waitingReason: null,
          });
        } else {
          const currentTask = await db.task.findUnique({
            where: { id: taskId },
            include: {
              tags: { select: { tag: { select: { name: true } } } },
              relations: { select: { relationType: true, relatedTask: { select: { id: true, title: true } } } },
              attachments: true,
              deliverables: true,
            },
          });
          if (currentTask) {
            await broadcastSyncEvent(userId, "task:updated", {
              task: currentTask,
              id: taskId,
              title: currentTask.title,
              status: currentTask.status,
              waitingReason: currentTask.waitingReason,
            });
          }
        }

        // Ensure at least one agentRun exists for this task so session telemetry isn't empty
        const existingRun = await db.agentRun.findFirst({
          where: { taskId },
        });
        if (!existingRun) {
          await db.agentRun.create({
            data: {
              taskId,
              credentialId,
              agentName: "hermes",
              status: checkpointState === "finished" ? "completed" : "active",
            },
          });
        }

        return jsonSuccess({
          checkpointId: checkpoint.id,
          revision: checkpoint.revision,
          summary: checkpoint.summary,
        });
      } catch (err: any) {
        return jsonError(err?.message || "Failed to save checkpoint", "INTERNAL");
      }
    }
  );

  // 6. atlas_add_comment
  server.registerTool(
    "atlas_add_comment",
    {
      description: "ACTIVITY LOGGING: Call this frequently throughout execution to log what the agent is currently doing, examining, discovering, or executing (e.g. file analysis findings, PR review comments posted, test results). Serves as a transparent live activity trail for teammates.",
      inputSchema: {
        taskId: z.string().optional().describe("Task UUID (or use code instead)"),
        code: z.string().optional().describe("Task code (e.g. ATL-18, TASK-2)"),
        content: z.string().min(1).describe("Comment body (markdown supported)"),
      },
    },
    async ({ taskId, code, content }) => {
      try {
        let resolvedTaskId = taskId;
        if (!resolvedTaskId && code) {
          const t = await db.task.findFirst({
            where: { ownerId: userId, code: { equals: code.trim(), mode: "insensitive" }, deletedAt: null },
            select: { id: true },
          });
          if (t) resolvedTaskId = t.id;
        }

        if (!resolvedTaskId) {
          return jsonError("Either taskId (UUID) or code (e.g. ATL-18) is required", "INVALID_INPUT");
        }

        const task = await db.task.findFirst({
          where: { id: resolvedTaskId, ownerId: userId, deletedAt: null },
          select: { id: true, title: true, status: true, waitingReason: true },
        });

        if (!task) return jsonError("Task not found", "NOT_FOUND");

        const comment = await db.comment.create({
          data: {
            taskId: task.id,
            authorId: userId,
            content: `⚡ [MCP]: ${content}`,
          },
        });

        // Broadcast comment event + task update
        await broadcastSyncEvent(userId, "comment:created", { taskId: task.id, commentId: comment.id });
        await broadcastSyncEvent(userId, "task:updated", {
          id: task.id,
          title: task.title,
          status: task.status,
          waitingReason: task.waitingReason,
        });

        return jsonSuccess({
          message: "Comment posted successfully",
          commentId: comment.id,
          taskId: task.id,
        });
      } catch (err: any) {
        return jsonError(err?.message || "Failed to post comment", "INTERNAL");
      }
    }
  );

  // 7. atlas_update_task
  server.registerTool(
    "atlas_update_task",
    {
      description: "MID-RUN TASK ENRICHMENT: Call this during execution whenever new scope, tags (e.g. ['security', 'breaking-changes']), re-estimated size (xs/s/m/l/xl), waitingReason, or status transitions are discovered, keeping the quest card accurate.",
      inputSchema: {
        taskId: z.string().uuid().optional(),
        code: z.string().optional().describe("Task code, e.g. ATS-22 or ATL-18"),
        status: z.enum(["backlog", "todo", "in_progress", "done", "archived"]).optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        projectName: z.string().optional().describe("Assign or move to project by name (auto-created if not exists)"),
        priority: z.enum(["high", "medium", "low"]).optional(),
        size: z.enum(["xs", "s", "m", "l", "xl"]).optional(),
        waitingReason: z.string().nullable().optional(),
        tags: z.array(z.string()).optional().describe("Updated or replacement tags"),
      },
    },
    async ({ taskId, code, status, title, description, projectName, priority, size, waitingReason, tags }) => {
      try {
        let resolvedTaskId = taskId;
        if (!resolvedTaskId && code) {
          const t = await db.task.findFirst({
            where: { ownerId: userId, code: { equals: code.trim(), mode: "insensitive" }, deletedAt: null },
            select: { id: true },
          });
          if (t) resolvedTaskId = t.id;
        }

        if (!resolvedTaskId) {
          return jsonError("Either taskId (UUID) or code (e.g. ATS-22) is required", "INVALID_INPUT");
        }

        const updateData: any = {};
        if (status !== undefined) updateData.status = status;
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (priority !== undefined) updateData.priority = priority;
        if (size !== undefined) updateData.size = size;
        if (waitingReason !== undefined) updateData.waitingReason = waitingReason;
        if (tags !== undefined) updateData.tags = tags;

        if (projectName) {
          const trimmedProject = projectName.trim();
          let p = await db.project.findFirst({
            where: { ownerId: userId, name: { equals: trimmedProject, mode: "insensitive" } },
            select: { id: true },
          });
          if (!p && trimmedProject) {
            try {
              const cleanAlpha = trimmedProject.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
              let baseCode = cleanAlpha.slice(0, 3);
              if (baseCode.length < 2) baseCode = (cleanAlpha + "PRJ").slice(0, 3);
              let candidateCode = baseCode;
              let suffix = 1;
              while (await db.project.findUnique({ where: { code: candidateCode } })) {
                candidateCode = `${baseCode.slice(0, 2)}${suffix}`;
                suffix++;
                if (suffix > 9) break;
              }
              p = await db.project.create({
                data: {
                  name: trimmedProject,
                  code: candidateCode,
                  category: "work",
                  colorVar: "--color-primary-gold",
                  emoji: "📁",
                  status: "active",
                  ownerId: userId,
                },
                select: { id: true },
              });
              await broadcastSyncEvent(userId, "sync:reload", { autoCreatedProject: p });
            } catch {}
          }
          if (p) updateData.projectId = p.id;
        }

        const updateRes = await domainUpdateTask(userId, resolvedTaskId, updateData);
        if (!updateRes.success) {
          return jsonError(updateRes.error.message, updateRes.error.code);
        }

        return jsonSuccess({
          message: "Task updated successfully",
          task: {
            id: updateRes.data.task.id,
            code: updateRes.data.task.code,
            title: updateRes.data.task.title,
            status: updateRes.data.task.status,
            waitingReason: updateRes.data.task.waitingReason,
          },
        });
      } catch (err: any) {
        return jsonError(err?.message || "Failed to update task", "INTERNAL");
      }
    }
  );

  // 8. atlas_finish_run
  server.registerTool(
    "atlas_finish_run",
    {
      description: "TASK COMPLETION: Conclude an active agent execution run, updating status to completed and recording token metrics. Set taskCompleted=true when work is fully resolved to mark the quest 'done'.",
      inputSchema: {
        runId: z.string().uuid(),
        status: z.enum(["completed", "failed"]).default("completed"),
        taskCompleted: z.boolean().default(false).describe("Set true ONLY if task is fully done"),
        usage: z
          .object({
            model: z.string(),
            provider: z.string().optional(),
            promptTokens: z.number().int().default(0),
            completionTokens: z.number().int().default(0),
            totalTokens: z.number().int().default(0),
            costUsd: z.number().optional(),
          })
          .optional(),
      },
    },
    async ({ runId, status, taskCompleted, usage }) => {
      try {
        const run = await db.agentRun.findFirst({
          where: { id: runId, task: { ownerId: userId } },
          select: { id: true, taskId: true, agentName: true },
        });

        if (!run) return jsonError("Agent run not found", "NOT_FOUND");

        await db.agentRun.update({
          where: { id: runId },
          data: {
            status,
            endedAt: new Date(),
          },
        });

        if (usage) {
          await db.agentUsageEvent.create({
            data: {
              runId,
              model: usage.model,
              provider: usage.provider,
              promptTokens: usage.promptTokens,
              completionTokens: usage.completionTokens,
              totalTokens: usage.totalTokens,
              costUsd: usage.costUsd,
            },
          });
        }

        if (taskCompleted) {
          await domainUpdateTask(userId, run.taskId, { status: "done" });
        }

        // Auto-post a brief finish comment to the task
        await db.comment.create({
          data: {
            taskId: run.taskId,
            authorId: userId,
            content: taskCompleted
              ? `🏁 [MCP Run Finished]: Quest marked DONE by ${run.agentName}.${usage?.totalTokens ? ` Burned ${usage.totalTokens.toLocaleString()} tokens.` : ""}`
              : `🏁 [MCP Run Concluded]: Run by ${run.agentName} ended (${status}).${usage?.totalTokens ? ` Burned ${usage.totalTokens.toLocaleString()} tokens.` : ""}`,
          },
        });

        return jsonSuccess({
          message: "Run finished successfully",
          runId,
          taskCompleted,
        });
      } catch (err: any) {
        return jsonError(err?.message || "Failed to finish run", "INTERNAL");
      }
    }
  );

  return server;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cred = await verifyBearerToken(authHeader);

  if (!cred) {
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32000, message: "Unauthorized: Invalid or revoked Atlas Bearer token" }, id: null },
      { status: 401 }
    );
  }

  try {
    const server = await createAtlasMcpServer(cred.userId, cred.credentialId);
    const transport = new WebStandardStreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(req);
    return response;
  } catch (err: any) {
    console.error("Atlas MCP Route Error:", err);
    return NextResponse.json(
      { jsonrpc: "2.0", error: { code: -32603, message: err?.message || "Internal server error" }, id: null },
      { status: 500 }
    );
  }
}
