import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { DefaultViewRedirect } from "@/components/layout/DefaultViewRedirect";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { TaskFormSheet } from "@/components/tasks/TaskFormSheet";
import { ProjectFormSheet } from "@/components/projects/ProjectFormSheet";
import { SprintFormSheet } from "@/components/sprints/SprintFormSheet";
import { TasksProvider } from "@/components/providers/TasksProvider";
import { ProjectsProvider } from "@/components/providers/ProjectsProvider";
import { SprintsProvider } from "@/components/providers/SprintsProvider";
import { CommandPaletteProvider } from "@/components/providers/CommandPaletteProvider";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { mockProjects, mockSprints } from "@/lib/mock-data";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapDbTaskToClient, mapDbProjectToClient, mapDbSprintToClient } from "@/lib/tasks-reducer";
import { ProjectCategory, ProjectStatus, SprintStatus } from "@/generated/prisma/client";
import { toDbProjectCategory } from "@/lib/schemas/project";
import type { SavedFilterClient } from "@/lib/actions/filters";
import type { UserSetting } from "@/types/settings";
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect("/auth");
  }

  const owner = await db.user.upsert({
    where: { email: session.user.email },
    update: {},
    create: { email: session.user.email, name: session.user.name ?? session.user.email },
  });

  const [dbTasks, rawDbProjects, rawDbSprints, rawDbActivityLogs] = await Promise.all([
    db.task.findMany({
      where: { ownerId: owner.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        statusHistory: {
          orderBy: {
            changedAt: "asc",
          },
        },
        comments: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            author: true,
          },
        },
      },
    }),
    db.project.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    db.sprint.findMany({
      orderBy: { startDate: "asc" },
    }),
    db.activityLog.findMany({
      where: { actorId: owner.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        createdAt: true,
        task: { select: { title: true } },
        project: { select: { emoji: true, name: true } },
        sprint: { select: { name: true } },
        actor: { select: { name: true, email: true } },
      },
    }),
  ]);

  let dbProjects = rawDbProjects;
  let dbSprints = rawDbSprints;

  if (dbProjects.length === 0) {
    const PROJECT_MAP: Record<string, string> = {
      "ATS": "a0665f80-7a0e-4364-8848-d39f60d3d5f1",
      "Thesis": "b04e6c9a-d762-4217-a066-6b22b2ee709a",
      "Client A": "c0559f23-64be-4581-807e-1284eb3b7280",
      "Atlas": "d09ef1b3-4f24-4f40-8bde-d51025a17688",
      "Group Project": "e03bf3ab-d886-455f-8647-5d2bc50e3025",
      "Full-time": "f0f9c2d1-2ee3-4927-99df-1c7c10b429a3",
    };

    await db.project.createMany({
      data: mockProjects.map((p) => ({
        id: PROJECT_MAP[p.name],
        name: p.name,
        emoji: p.emoji,
        colorVar: p.colorVar,
        category: toDbProjectCategory(p.category) as ProjectCategory,
        status: p.status as ProjectStatus,
        description: p.description,
      })),
    });

    dbProjects = await db.project.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
  }

  if (dbSprints.length === 0) {
    const SPRINT_MAP: Record<string, string> = {
      "Sprint 7 — The Awakening": "77777777-7777-7777-7777-777777777777",
      "Sprint 6 — Dark Passage": "66666666-6666-6666-6666-666666666666",
      "Sprint 8 — The Reckoning": "88888888-8888-8888-8888-888888888888",
    };

    await db.sprint.createMany({
      data: mockSprints.map((s) => ({
        id: SPRINT_MAP[s.name] || crypto.randomUUID(),
        name: s.name,
        startDate: new Date(s.startDate),
        endDate: new Date(s.endDate),
        status: s.status as SprintStatus,
        goal: s.goal || null,
      })),
    });

    dbSprints = await db.sprint.findMany({
      orderBy: { startDate: "asc" },
    });
  }

  const tasks = dbTasks.map((t) => mapDbTaskToClient(t, dbProjects, dbSprints));
  const projects = dbProjects.map(mapDbProjectToClient);
  const sprints = dbSprints.map(mapDbSprintToClient);
  const activityLogs = rawDbActivityLogs.map((l) => ({
    id: l.id,
    action: l.action,
    createdAt: l.createdAt.toISOString(),
    actorName: l.actor.name || l.actor.email,
    taskTitle: l.task?.title || undefined,
    projectEmoji: l.project?.emoji || undefined,
    projectName: l.project?.name || undefined,
    sprintName: l.sprint?.name || undefined,
  }));

  const initialActiveTimer = owner.activeTimerTaskId && owner.activeTimerStartedAt
    ? {
        taskId: owner.activeTimerTaskId,
        startedAt: owner.activeTimerStartedAt.getTime(),
        phase: (owner.activeTimerPhase || "focus") as "focus" | "break",
      }
    : null;

  return (
    <ToastProvider>
      <SettingsProvider initialSettings={owner.settings as unknown as UserSetting[]}>
        <DefaultViewRedirect />
        <ProjectsProvider initialProjects={projects}>
          <SprintsProvider initialSprints={sprints}>
            <TasksProvider
              initialTasks={tasks}
              initialActivityLogs={activityLogs}
              initialBonusXp={owner.bonusXp}
              initialBonusCoins={owner.bonusCoins}
              initialPurchasedDecorations={owner.purchasedDecorations}
              initialPlacedDecorations={owner.placedDecorations as Record<string, string | null>}
              initialSavedFilters={owner.savedFilters as unknown as SavedFilterClient[]}
              initialLastQuestClaimedAt={owner.lastQuestClaimedAt ? owner.lastQuestClaimedAt.toISOString() : null}
              initialActiveTimer={initialActiveTimer}
            >
              <CommandPaletteProvider>
                <div className="flex h-full flex-1 overflow-hidden">
                  <Sidebar />
                  <div className="flex-1 overflow-y-auto">{children}</div>
                </div>
                <TaskFormSheet />
                <ProjectFormSheet />
                <SprintFormSheet />
                <CommandPalette />
              </CommandPaletteProvider>
            </TasksProvider>
          </SprintsProvider>
        </ProjectsProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
