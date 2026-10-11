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
      description: "Search or resolve existing tasks/quests by code (e.g. CR-421), title, PR URL, or status filter.",
      inputSchema: {
        query: z.string().optional().describe("Free-text search or code/PR number"),
        status: z.enum(["backlog", "todo", "in_progress", "done", "archived"]).optional(),
        sourceKey: z.string().optional().describe("Canonical source key like github.com/owner/repo/pull/123"),
        limit: z.number().int().min(1).max(50).default(10),
      },
    },
    async ({ query, status, sourceKey, limit }) => {
      try {
        const whereClause: any = {
          ownerId: userId,
          deletedAt: null,
        };

        if (status) {
          whereClause.status = status;
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
      description: "Retrieve distilled context, latest checkpoint, active runs, and session pointers for a specific task.",
      inputSchema: {
        taskId: z.string().uuid().optional(),
        code: z.string().optional(),
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
                platform: true,
                chatId: true,
                threadId: true,
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
      description: "Create a new task in Atlas, optionally binding it to a project, description, size, and canonical external source (e.g. PR URL).",
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
        source: z
          .object({
            provider: z.string().default("github_pr"),
            canonicalKey: z.string(),
            url: z.string().optional(),
          })
          .optional(),
      },
    },
    async ({ title, description, projectName, status, priority, type, size, waitingReason, metadata, source }) => {
      try {
        let projectId: string | undefined;
        if (projectName) {
          const p = await db.project.findFirst({
            where: { ownerId: userId, name: { equals: projectName.trim(), mode: "insensitive" } },
            select: { id: true },
          });
          if (p) projectId = p.id;
        }

        const createRes = await domainCreateTask(userId, {
          title,
          description,
          projectId,
          status,
          priority,
          type,
          size,
          reporter: "agent",
          waitingReason,
          metadata: {
            ...metadata,
            createdByAgent: true,
            createdAtAgent: new Date().toISOString(),
          },
        });

        if (!createRes.success) {
          return jsonError(createRes.error.message, createRes.error.code);
        }

        const task = createRes.data.task;

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
        sessionId: z.string().optional().describe("Hermes session_id"),
        platform: z.string().optional().describe("e.g. telegram"),
        chatId: z.string().optional(),
        threadId: z.string().optional(),
        externalRunId: z.string().optional(),
      },
    },
    async ({ taskId, agentName, sessionId, platform, chatId, threadId, externalRunId }) => {
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
            platform,
            chatId,
            threadId,
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
      description: "Save a structured checkpoint/summary on a task, updating status and waiting reason.",
      inputSchema: {
        taskId: z.string().uuid(),
        runId: z.string().uuid().optional(),
        summary: z.string().min(1),
        checkpointState: z.enum(["in_progress", "waiting_external", "finished"]).optional(),
        waitingReason: z.string().optional(),
        nextStep: z.string().optional(),
        provenanceSource: z.string().optional().describe("e.g. commit SHA, PR link"),
      },
    },
    async ({ taskId, runId, summary, checkpointState, waitingReason, nextStep, provenanceSource }) => {
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

        // Sync back to task status
        if (checkpointState === "waiting_external") {
          await domainUpdateTask(userId, taskId, {
            waitingReason: waitingReason || summary,
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

  // 6. atlas_finish_run
  server.registerTool(
    "atlas_finish_run",
    {
      description: "Conclude an active agent run, updating status to completed and recording metrics.",
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
          select: { id: true, taskId: true },
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
