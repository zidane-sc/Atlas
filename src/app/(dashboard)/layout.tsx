import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { DefaultViewRedirect } from "@/components/layout/DefaultViewRedirect";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { TaskFormSheet } from "@/components/tasks/TaskFormSheet";
import { ProjectFormSheet } from "@/components/projects/ProjectFormSheet";
import { SprintFormSheet } from "@/components/sprints/SprintFormSheet";
import { TasksProvider } from "@/components/providers/TasksProvider";
import { ProjectsProvider } from "@/components/providers/ProjectsProvider";
import { SprintsProvider } from "@/components/providers/SprintsProvider";
import { CommandPaletteProvider } from "@/components/providers/CommandPaletteProvider";
import { SidebarProvider } from "@/components/providers/SidebarProvider";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { NotificationProvider } from "@/components/providers/NotificationProvider";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { mapDbTaskToClient, mapDbProjectToClient, mapDbSprintToClient } from "@/lib/tasks-reducer";
import { getCharacterSheetData } from "@/lib/character-sheet-data";
import { seedInitialData } from "@/lib/seeders/initial-data";
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
      where: { ownerId: owner.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
    }),
    db.sprint.findMany({
      where: { ownerId: owner.id },
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

  // Seed initial data on first login (no projects/sprints yet)
  if (dbProjects.length === 0 || dbSprints.length === 0) {
    await seedInitialData(owner.id);
    dbProjects = await db.project.findMany({
      where: { ownerId: owner.id, archivedAt: null },
      orderBy: { createdAt: "asc" },
    });
    dbSprints = await db.sprint.findMany({
      where: { ownerId: owner.id },
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
              initialPlacedDecorations={owner.placedDecorations as Record<string, any>}
              initialSavedFilters={owner.savedFilters as unknown as SavedFilterClient[]}
              initialLastQuestClaimedAt={owner.lastQuestClaimedAt ? owner.lastQuestClaimedAt.toISOString() : null}
              initialActiveTimer={initialActiveTimer}
            >
              <CommandPaletteProvider>
                <SidebarProvider>
                  <div className="flex h-full flex-1 overflow-hidden">
                    <Sidebar />
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <MobileTopBar />
                      <div className="flex-1 overflow-y-auto">{children}</div>
                    </div>
                  </div>
                </SidebarProvider>
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
