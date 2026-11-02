"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "@/lib/actions/types";
import { domainUpdateTask } from "@/lib/services/tasks-domain";
import { broadcastSyncEvent } from "@/lib/sync-events";

export interface AgentFleetItem {
  id: string;
  agentName: string;
  platform?: string | null;
  chatName?: string | null;
  threadName?: string | null;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  task: {
    id: string;
    code: string | null;
    title: string;
    status: string;
    priority: string;
    projectName?: string | null;
    projectColorVar?: string | null;
  };
  latestCheckpoint?: {
    summary: string;
    checkpointState: string | null;
    waitingReason: string | null;
    nextStep: string | null;
    provenanceSource: string | null;
    createdAt: string;
  } | null;
  latestLog?: string | null;
  latestLogTime?: string | null;
  usage: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
  };
}

export interface AgentFleetStatus {
  activeRuns: AgentFleetItem[];
  recentRuns: AgentFleetItem[];
  todayStats: {
    totalRuns: number;
    activeCount: number;
    totalTokens: number;
    totalCostUsd: number;
  };
}

function mapRunToFleetItem(run: any): AgentFleetItem {
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let costUsd = 0;

  for (const ev of run.usageEvents || []) {
    promptTokens += ev.promptTokens || 0;
    completionTokens += ev.completionTokens || 0;
    totalTokens += ev.totalTokens || 0;
    costUsd += ev.costUsd || 0;
  }

  const cp = run.checkpoints?.[0];
  const rawComment = run.task?.comments?.[0]?.content;
  const cleanComment = rawComment
    ? rawComment.replace(/^⚡\s*\[MCP(?:\s*Run[^\]]*)?\]:\s*/i, "").trim()
    : null;

  const latestLog = cleanComment || cp?.summary || null;
  const rawLogTime = run.task?.comments?.[0]?.createdAt || cp?.createdAt;
  const latestLogTime = rawLogTime
    ? (rawLogTime instanceof Date ? rawLogTime.toISOString() : String(rawLogTime))
    : null;

  return {
    id: run.id,
    agentName: run.agentName || "hermes",
    platform: run.platform,
    chatName: run.chatName,
    threadName: run.threadName,
    status: run.status,
    startedAt: run.startedAt instanceof Date ? run.startedAt.toISOString() : String(run.startedAt),
    endedAt: run.endedAt ? (run.endedAt instanceof Date ? run.endedAt.toISOString() : String(run.endedAt)) : null,
    task: {
      id: run.task.id,
      code: run.task.code,
      title: run.task.title,
      status: run.task.status,
      priority: run.task.priority,
      projectName: run.task.project?.name ?? null,
      projectColorVar: run.task.project?.colorVar ?? null,
    },
    latestCheckpoint: cp
      ? {
          summary: cp.summary,
          checkpointState: cp.checkpointState,
          waitingReason: cp.waitingReason,
          nextStep: cp.nextStep,
          provenanceSource: cp.provenanceSource,
          createdAt: cp.createdAt instanceof Date ? cp.createdAt.toISOString() : String(cp.createdAt),
        }
      : null,
    latestLog,
    latestLogTime,
    usage: {
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
    },
  };
}

export async function getAgentFleetStatus(): Promise<ActionResult<AgentFleetStatus>> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    // 1. Fetch active runs (only on non-done tasks within the last 12 hours)
    const activeThreshold = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const rawActiveRuns = await db.agentRun.findMany({
      where: {
        task: { ownerId: user.id, deletedAt: null, status: { not: "done" } },
        status: "active",
        startedAt: { gte: activeThreshold },
      },
      orderBy: { startedAt: "desc" },
      take: 5,
      include: {
        task: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            priority: true,
            project: { select: { name: true, colorVar: true } },
            comments: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { content: true, createdAt: true },
            },
          },
        },
        usageEvents: {
          select: {
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            costUsd: true,
          },
        },
        checkpoints: {
          orderBy: { revision: "desc" },
          take: 1,
          select: {
            summary: true,
            checkpointState: true,
            waitingReason: true,
            nextStep: true,
            provenanceSource: true,
            createdAt: true,
          },
        },
      },
    });

    // 2. Fetch recent completed/failed runs
    const rawRecentRuns = await db.agentRun.findMany({
      where: {
        task: { ownerId: user.id, deletedAt: null },
        status: { in: ["completed", "failed"] },
      },
      orderBy: { endedAt: "desc" },
      take: 5,
      include: {
        task: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            priority: true,
            project: { select: { name: true, colorVar: true } },
            comments: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { content: true, createdAt: true },
            },
          },
        },
        usageEvents: {
          select: {
            promptTokens: true,
            completionTokens: true,
            totalTokens: true,
            costUsd: true,
          },
        },
        checkpoints: {
          orderBy: { revision: "desc" },
          take: 1,
          select: {
            summary: true,
            checkpointState: true,
            waitingReason: true,
            nextStep: true,
            provenanceSource: true,
            createdAt: true,
          },
        },
      },
    });

    // 3. Compute today's telemetry totals
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayUsage = await db.agentUsageEvent.findMany({
      where: {
        run: { task: { ownerId: user.id } },
        createdAt: { gte: startOfToday },
      },
      select: {
        totalTokens: true,
        costUsd: true,
      },
    });

    let todayTokens = 0;
    let todayCostUsd = 0;
    for (const u of todayUsage) {
      todayTokens += u.totalTokens || 0;
      todayCostUsd += u.costUsd || 0;
    }

    const todayRunsCount = await db.agentRun.count({
      where: {
        task: { ownerId: user.id },
        startedAt: { gte: startOfToday },
      },
    });

    return {
      success: true,
      data: {
        activeRuns: rawActiveRuns.map(mapRunToFleetItem),
        recentRuns: rawRecentRuns.map(mapRunToFleetItem),
        todayStats: {
          totalRuns: todayRunsCount,
          activeCount: rawActiveRuns.length,
          totalTokens: todayTokens,
          totalCostUsd: todayCostUsd,
        },
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "INTERNAL", message: err?.message || "Failed to load agent fleet status" },
    };
  }
}

export async function concludeAgentRunAction(
  runId: string,
  markTaskDone: boolean = false
): Promise<ActionResult<{ runId: string; taskCompleted: boolean }>> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
    }

    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });
    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const run = await db.agentRun.findFirst({
      where: { id: runId, task: { ownerId: user.id } },
      select: { id: true, taskId: true },
    });
    if (!run) {
      return { success: false, error: { code: "NOT_FOUND", message: "Agent run not found." } };
    }

    await db.agentRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        endedAt: new Date(),
      },
    });

    if (markTaskDone) {
      await domainUpdateTask(user.id, run.taskId, { status: "done" });
    }

    await broadcastSyncEvent(user.id, "sync:reload", { agentRunConcluded: runId });

    return {
      success: true,
      data: { runId, taskCompleted: markTaskDone },
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "INTERNAL", message: err?.message || "Failed to conclude agent run" },
    };
  }
}
