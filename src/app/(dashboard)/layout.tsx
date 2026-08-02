import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
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
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { mockProjects, mockSprints } from "@/lib/mock-data";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapDbTaskToClient, mapDbProjectToClient, mapDbSprintToClient } from "@/lib/tasks-reducer";
import { getCharacterSheetData } from "@/lib/character-sheet-data";
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

  const [dbTasks, rawDbAllDoneTasks, rawDbProjects, rawDbSprints, rawDbActivityLogs, characterSheetData] = await Promise.all([
    // No nested `statusHistory`/`comments` here — both are now on-demand only, fetched by
    // `getTaskDetails` when TaskFormSheet opens a specific task. `createdAt`/`completedAt` are
    // direct scalar columns (see Task.createdAt, types/task.ts), so nothing in the bulk views
    // needs the nested include anymore (docs/05-backlog.md §8 finding #16).
    db.task.findMany({
      where: { ownerId: owner.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    // Unbounded (no `take`) — the 200-cap above exists for the interactive views, but
    // gamification/statistics need lifetime totals (XP, achievement tiers, longest-ever
    // streak, completion rate, focus hours), which would otherwise silently drop older
    // completions once total task count passes 200. See docs/05-backlog.md §8 finding #15.
    db.task.findMany({
      where: { ownerId: owner.id, deletedAt: null, status: "done" },
      orderBy: { completedAt: "asc" },
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
    getCharacterSheetData(owner.id),
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
  const allDoneTasks = rawDbAllDoneTasks.map((t) => mapDbTaskToClient(t, dbProjects, dbSprints));
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
    <SessionProvider>
      <SettingsProvider initialSettings={owner.settings as unknown as UserSetting[]}>
        <NotificationProvider>
        <DefaultViewRedirect />
        <ProjectsProvider initialProjects={projects}>
          <SprintsProvider initialSprints={sprints}>
            <TasksProvider
              initialTasks={tasks}
              initialAllDoneTasks={allDoneTasks}
              initialActivityLogs={activityLogs}
              initialBonusXp={owner.bonusXp}
              initialBonusCoins={owner.bonusCoins}
              initialCharacterSheet={characterSheetData.characterSheet}
              initialUnlockedAchievements={characterSheetData.unlockedAchievements}
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
        </NotificationProvider>
      </SettingsProvider>
    </SessionProvider>
  );
}
