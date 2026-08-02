# Server-Computed Character Sheet & Live-Feedback Mechanism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Character Sheet (XP/level/coins) computation and level-up/achievement-unlock detection server-side, per `docs/superpowers/specs/2026-08-03-server-computed-character-sheet-design.md`.

**Architecture:** A new shared helper `getCharacterSheetData(ownerId)` computes the character sheet + achievement unlock state fresh from the DB, using the *same, unchanged* `computeCharacterSheet`/`computeUnlockedAchievements` functions. `layout.tsx` calls it once per page load for the initial value; `updateTask`, `createTask`, and `claimDailyQuestAction` call it again after their own DB write and return the fresh value inline. `TasksProvider` stores the result as shared state; the 6 consumer components read it from context instead of computing it themselves.

**Tech Stack:** Next.js Server Components/Server Actions, Prisma, existing pure functions in `src/lib/gamification.ts` (unchanged).

## Global Constraints

- Do not modify `computeCharacterSheet`, `computeUnlockedAchievements`, `checkAndEmitLevelUp`, `checkAndEmitAchievementUnlocks`, `checkAndEmitStreakMilestone`, or `calcTaskXP` in `src/lib/gamification.ts` — only *where* they're called and *what feeds them* changes.
- The per-task "+XP" toast (`calcTaskXP`) and current-streak-milestone detection stay exactly as they are today — 100% unchanged, no server round-trip.
- `allTimeTasks`/`allDoneTasksBeyondWindow` stays in `TasksProvider` — do not remove it. After this plan its only remaining consumer is `TaskFormSheet`'s relation-trashed check.
- Every task ends with: typecheck clean (no *new* errors beyond the 14 pre-existing errors in 6 test files already in the repo, confirmed via `npx tsc --noEmit -p tsconfig.json`), then commit.
- Same testing bar as prior phases — `npx tsc --noEmit`, `npx vitest run` (104 existing tests must stay green), `npx next build`; no new automated tests for this glue code (no Prisma/auth mocking harness in this repo), verified by manual browser check instead.

---

### Task 1: Character Sheet server-side data layer + layout.tsx wiring

**Files:**
- Create: `src/lib/character-sheet-data.ts`
- Modify: `src/app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `db` (`@/lib/db`), `mapDbTaskToClient`/`mapDbProjectToClient`/`mapDbSprintToClient` (`@/lib/tasks-reducer`), `computeCharacterSheet`/`computeUnlockedAchievements`/`CharacterSheet` (`@/lib/gamification`).
- Produces: `export interface CharacterSheetData { characterSheet: CharacterSheet; unlockedAchievements: Record<string, { unlocked: boolean; unlockedAt: string | null }> }` and `export async function getCharacterSheetData(ownerId: string): Promise<CharacterSheetData>` — the two names/shapes Tasks 2, 3, and 4 rely on.

- [ ] **Step 1: Write `src/lib/character-sheet-data.ts`**

```ts
import { db } from "@/lib/db";
import { mapDbTaskToClient, mapDbProjectToClient, mapDbSprintToClient } from "@/lib/tasks-reducer";
import { computeCharacterSheet, computeUnlockedAchievements, type CharacterSheet } from "@/lib/gamification";

export interface CharacterSheetData {
  characterSheet: CharacterSheet;
  unlockedAchievements: Record<string, { unlocked: boolean; unlockedAt: string | null }>;
}

/**
 * Self-contained: given an ownerId (already resolved/verified by the caller — this is an
 * internal utility, not a page-level entry point, so it does no auth of its own), computes
 * the character sheet + achievement unlock state fresh from the DB. Called once per page
 * load (layout.tsx) and again after every mutation that can change XP/coins/achievements
 * (updateTask, createTask, claimDailyQuestAction) so the response carries the authoritative
 * post-mutation value inline instead of the client recomputing from a possibly-stale array.
 */
export async function getCharacterSheetData(ownerId: string): Promise<CharacterSheetData> {
  const [dbDoneTasks, dbProjects, dbSprints, owner] = await Promise.all([
    db.task.findMany({ where: { ownerId, deletedAt: null, status: "done" } }),
    db.project.findMany({ where: { archivedAt: null } }),
    db.sprint.findMany(),
    db.user.findUnique({ where: { id: ownerId }, select: { bonusXp: true, bonusCoins: true } }),
  ]);

  if (!owner) {
    throw new Error(`getCharacterSheetData: user ${ownerId} not found`);
  }

  const tasks = dbDoneTasks.map((t) => mapDbTaskToClient(t, dbProjects, dbSprints));
  const projects = dbProjects.map(mapDbProjectToClient);
  const sprints = dbSprints.map(mapDbSprintToClient);

  return {
    characterSheet: computeCharacterSheet(tasks, owner.bonusXp, owner.bonusCoins),
    unlockedAchievements: computeUnlockedAchievements(tasks, projects, sprints),
  };
}
```

- [ ] **Step 2: Wire it into `layout.tsx`**

Add the import, alongside the existing ones:

```ts
import { getCharacterSheetData } from "@/lib/character-sheet-data";
```

Add `getCharacterSheetData(owner.id)` as a 6th parallel query and destructure its result:

```ts
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
```

Pass the two new props into `<TasksProvider>`:

```tsx
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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "character-sheet-data|layout.tsx"`
Expected: errors mentioning `TasksProvider` missing the new required props — that's expected until Task 4 adds them. If the only errors are about `initialCharacterSheet`/`initialUnlockedAchievements` not existing on `TasksProvider`'s props type, that confirms Task 1 itself is correct; proceed to commit.

- [ ] **Step 4: Commit**

```bash
git add src/lib/character-sheet-data.ts "src/app/(dashboard)/layout.tsx"
git commit -m "feat: add server-side Character Sheet data computation, wire into layout"
```

---

### Task 2: Return fresh Character Sheet data from updateTask/createTask

**Files:**
- Modify: `src/lib/actions/tasks.ts`

**Interfaces:**
- Consumes: `getCharacterSheetData` (`@/lib/character-sheet-data`, Task 1).
- Produces: `createTask`/`updateTask` now return `ActionResult<{ task: Task; characterSheet?: CharacterSheet; unlockedAchievements?: Record<string, {unlocked: boolean; unlockedAt: string | null}> }>` (was `ActionResult<Task>`) — Task 4 relies on this new shape (`result.data.task` instead of `result.data`).

- [ ] **Step 1: Add the import**

```ts
import { getCharacterSheetData, type CharacterSheetData } from "@/lib/character-sheet-data";
```

- [ ] **Step 2: Change `createTask`'s return type and success path**

Old:

```ts
export async function createTask(input: unknown): Promise<ActionResult<Task>> {
```

New:

```ts
export async function createTask(
  input: unknown
): Promise<ActionResult<{ task: Task } & Partial<CharacterSheetData>>> {
```

Old success return (inside the retry loop, after the transaction):

```ts
      return { success: true, data: task };
    } catch (err) {
```

New — compute the sheet in its own try/catch so a failure there doesn't turn a successful task creation into a reported failure:

```ts
      let sheetData: CharacterSheetData | undefined;
      try {
        sheetData = await getCharacterSheetData(owner.id);
      } catch (sheetErr) {
        console.error("Failed to compute character sheet after task create:", sheetErr);
      }
      return { success: true, data: { task, ...sheetData } };
    } catch (err) {
```

- [ ] **Step 3: Change `updateTask`'s return type and success path**

Old:

```ts
export async function updateTask(id: string, input: unknown): Promise<ActionResult<Task>> {
```

New:

```ts
export async function updateTask(
  id: string,
  input: unknown
): Promise<ActionResult<{ task: Task } & Partial<CharacterSheetData>>> {
```

Old success return (after the transaction):

```ts
      return updated;
    });
    return { success: true, data: task };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { success: false, error: { code: "NOT_FOUND", message: "Related project or sprint not found." } };
    }
    return { success: false, error: { code: "INTERNAL", message: "Failed to update task." } };
  }
}
```

New:

```ts
      return updated;
    });

    let sheetData: CharacterSheetData | undefined;
    try {
      sheetData = await getCharacterSheetData(owner.id);
    } catch (sheetErr) {
      console.error("Failed to compute character sheet after task update:", sheetErr);
    }
    return { success: true, data: { task, ...sheetData } };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { success: false, error: { code: "NOT_FOUND", message: "Related project or sprint not found." } };
    }
    return { success: false, error: { code: "INTERNAL", message: "Failed to update task." } };
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "actions/tasks.ts"`
Expected: no output (the file itself is internally consistent now; callers in `TasksProvider.tsx` will show errors until Task 4 — that's expected and fixed there).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/tasks.ts
git commit -m "feat: return fresh character sheet data from createTask/updateTask"
```

---

### Task 3: Return fresh Character Sheet data from claimDailyQuestAction; remove now-dead getUserStatsAction

**Files:**
- Modify: `src/lib/actions/user.ts`

**Interfaces:**
- Consumes: `getCharacterSheetData` (`@/lib/character-sheet-data`, Task 1).
- Produces: `claimDailyQuestAction` now returns `ActionResult<{ bonusXp: number; bonusCoins: number; lastQuestClaimedAt: string | null } & Partial<CharacterSheetData>>` (added fields, existing three unchanged) — Task 4 relies on this shape.

- [ ] **Step 1: Add the import**

```ts
import { getCharacterSheetData, type CharacterSheetData } from "@/lib/character-sheet-data";
```

- [ ] **Step 2: Change `claimDailyQuestAction`'s return type and success path**

Old:

```ts
export async function claimDailyQuestAction(
  input: unknown
): Promise<
  ActionResult<{
    bonusXp: number;
    bonusCoins: number;
    lastQuestClaimedAt: string | null;
  }>
> {
```

New:

```ts
export async function claimDailyQuestAction(
  input: unknown
): Promise<
  ActionResult<
    {
      bonusXp: number;
      bonusCoins: number;
      lastQuestClaimedAt: string | null;
    } & Partial<CharacterSheetData>
  >
> {
```

Old success return:

```ts
    return {
      success: true,
      data: {
        bonusXp: updated.bonusXp,
        bonusCoins: updated.bonusCoins,
        lastQuestClaimedAt: updated.lastQuestClaimedAt ? updated.lastQuestClaimedAt.toISOString() : null,
      },
    };
  } catch (error) {
    console.error("Failed to claim daily quest:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to claim daily quest." } };
  }
}
```

New:

```ts
    let sheetData: CharacterSheetData | undefined;
    try {
      sheetData = await getCharacterSheetData(user.id);
    } catch (sheetErr) {
      console.error("Failed to compute character sheet after daily quest claim:", sheetErr);
    }

    return {
      success: true,
      data: {
        bonusXp: updated.bonusXp,
        bonusCoins: updated.bonusCoins,
        lastQuestClaimedAt: updated.lastQuestClaimedAt ? updated.lastQuestClaimedAt.toISOString() : null,
        ...sheetData,
      },
    };
  } catch (error) {
    console.error("Failed to claim daily quest:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to claim daily quest." } };
  }
}
```

- [ ] **Step 3: Remove the now-dead `getUserStatsAction`**

Phase 2 makes `characterSheet` in `TasksProvider` context always fresh (every mutation returns it inline, initial load is server-computed too), so `SaveAndQuitOverlay`'s workaround of fetching `getUserStatsAction` on mount just to recompute an accurate coin total becomes unnecessary — Task 5 removes that fetch. Confirm this is its only caller:

Run: `grep -rn "getUserStatsAction" src --include="*.ts*"`
Expected: `src/lib/actions/user.ts` (definition) and `src/components/gamification/SaveAndQuitOverlay.tsx` (the only call site, removed in Task 5). If anything else shows up, stop — do not delete the function, leave it and skip the rest of this step.

Delete this function entirely from `src/lib/actions/user.ts`:

```ts
export async function getUserStatsAction(): Promise<
  ActionResult<{
    bonusXp: number;
    bonusCoins: number;
  }>
> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { bonusXp: true, bonusCoins: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    return {
      success: true,
      data: {
        bonusXp: user.bonusXp,
        bonusCoins: user.bonusCoins,
      },
    };
  } catch (error) {
    console.error("Failed to fetch user stats:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to fetch user stats." } };
  }
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "actions/user.ts"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/user.ts
git commit -m "feat: return fresh character sheet data from claimDailyQuestAction; remove dead getUserStatsAction"
```

---

### Task 4: Wire TasksProvider to hold and update characterSheet/unlockedAchievements

**Files:**
- Modify: `src/components/providers/TasksProvider.tsx`

**Interfaces:**
- Consumes: `CharacterSheet` type and `computeCharacterSheet`/`computeUnlockedAchievements`/`checkAndEmitLevelUp`/`checkAndEmitAchievementUnlocks` (already imported, unchanged signatures), the new `{ task, characterSheet?, unlockedAchievements? }` response shape from `apiCreateTask`/`apiUpdateTask` (Task 2) and `apiClaimDailyQuest` (Task 3).
- Produces: `TasksContextValue.characterSheet: CharacterSheet` and `TasksContextValue.unlockedAchievements: Record<string, {unlocked: boolean; unlockedAt: string | null}>` — Task 5's 6 consumer components rely on these two exact names.

- [ ] **Step 1: Add the `CharacterSheet` type import**

Old:

```ts
import {
  calcTaskXP,
  calculateStreak,
  computeCharacterSheet,
  computeUnlockedAchievements,
  checkAndEmitLevelUp,
  checkAndEmitAchievementUnlocks,
  checkAndEmitStreakMilestone,
  checkAndEmitDueDateNotifications,
} from "@/lib/gamification";
```

New:

```ts
import {
  calcTaskXP,
  calculateStreak,
  computeCharacterSheet,
  computeUnlockedAchievements,
  checkAndEmitLevelUp,
  checkAndEmitAchievementUnlocks,
  checkAndEmitStreakMilestone,
  checkAndEmitDueDateNotifications,
  type CharacterSheet,
} from "@/lib/gamification";
```

- [ ] **Step 2: Update the `allTimeTasks` doc comment, and add `characterSheet`/`unlockedAchievements` to `TasksContextValue`**

Old:

```ts
  /**
   * Lifetime task set (every non-deleted task ever, not just the 200-cap interactive window) —
   * use this for anything that claims to be an all-time total: Character Sheet XP/level/skills,
   * achievement tiers, longest-ever streak, completion rate, focus hours. Anything genuinely
   * windowed (current streak, this-week recap, trailing throughput) should keep using `tasks`.
   */
  allTimeTasks: Task[];
  activityLogs: ActivityLogClient[];
```

New:

```ts
  /**
   * Lifetime task set (every non-deleted task ever, not just the 200-cap interactive window).
   * As of Phase 2, its only remaining consumer is TaskFormSheet's relation-trashed check —
   * Character Sheet, achievements, and statistics all get their lifetime totals server-computed
   * now (see character-sheet-data.ts / statistics-data.ts / achievements-data.ts) and no longer
   * read this array. Anything genuinely windowed (current streak, this-week recap, trailing
   * throughput) already correctly used `tasks` instead, unaffected by this.
   */
  allTimeTasks: Task[];
  /** Server-computed, kept fresh by every mutation response that can change it (see updateTask/
   * createTask/claimDailyQuest below) — never recomputed client-side from a task array. */
  characterSheet: CharacterSheet;
  unlockedAchievements: Record<string, { unlocked: boolean; unlockedAt: string | null }>;
  activityLogs: ActivityLogClient[];
```

- [ ] **Step 3: Add the two new provider props**

Old:

```ts
export function TasksProvider({
  initialTasks,
  initialAllDoneTasks,
  initialActivityLogs,
  initialBonusXp,
  initialBonusCoins,
  initialPurchasedDecorations = [],
  initialPlacedDecorations = {},
  initialSavedFilters = [],
  initialLastQuestClaimedAt = null,
  initialActiveTimer = null,
  children,
}: {
  initialTasks: Task[];
  initialAllDoneTasks: Task[];
  initialActivityLogs: ActivityLogClient[];
  initialBonusXp: number;
  initialBonusCoins: number;
  initialPurchasedDecorations?: string[];
  initialPlacedDecorations?: Record<string, string | null>;
  initialSavedFilters?: SavedFilterClient[];
  initialLastQuestClaimedAt?: string | null;
  initialActiveTimer?: ActiveTimer | null;
  children: React.ReactNode;
}) {
```

New:

```ts
export function TasksProvider({
  initialTasks,
  initialAllDoneTasks,
  initialActivityLogs,
  initialBonusXp,
  initialBonusCoins,
  initialCharacterSheet,
  initialUnlockedAchievements,
  initialPurchasedDecorations = [],
  initialPlacedDecorations = {},
  initialSavedFilters = [],
  initialLastQuestClaimedAt = null,
  initialActiveTimer = null,
  children,
}: {
  initialTasks: Task[];
  initialAllDoneTasks: Task[];
  initialActivityLogs: ActivityLogClient[];
  initialBonusXp: number;
  initialBonusCoins: number;
  initialCharacterSheet: CharacterSheet;
  initialUnlockedAchievements: Record<string, { unlocked: boolean; unlockedAt: string | null }>;
  initialPurchasedDecorations?: string[];
  initialPlacedDecorations?: Record<string, string | null>;
  initialSavedFilters?: SavedFilterClient[];
  initialLastQuestClaimedAt?: string | null;
  initialActiveTimer?: ActiveTimer | null;
  children: React.ReactNode;
}) {
```

- [ ] **Step 4: Add the two new state variables**

Old:

```ts
  const [bonusXp, setBonusXp] = useState(initialBonusXp);
  const [bonusCoins, setBonusCoins] = useState(initialBonusCoins);
```

New:

```ts
  const [bonusXp, setBonusXp] = useState(initialBonusXp);
  const [bonusCoins, setBonusCoins] = useState(initialBonusCoins);
  const [characterSheet, setCharacterSheet] = useState<CharacterSheet>(initialCharacterSheet);
  const [unlockedAchievements, setUnlockedAchievements] = useState(initialUnlockedAchievements);
```

- [ ] **Step 5: Rewrite the task-completion block inside `updateTask` — remove client-side before/after scanning, keep the per-task XP toast and streak-milestone check unchanged**

Old:

```ts
        if (prev.status !== "done" && values.status === "done") {
          setJustCompletedAt(Date.now());
          const onTime = !prev.dueDate || new Date() <= new Date(`${prev.dueDate}T23:59:59`);
          const xp = calcTaskXP(values.priority, values.storyPoint, onTime);
          const cid = crypto.randomUUID();

          const oldStreak = calculateStreak(tasks);
          const updatedTasks = tasks.map((t) => t.id === id ? { ...t, status: "done" as const } : t);
          const newStreak = calculateStreak(updatedTasks);
          const streakExtended = newStreak > oldStreak;

          // Calculate old and new character sheets to detect level-up — uses the lifetime task
          // set (not just the 200-cap window) so level/XP totals aren't missing older completions.
          const updatedAllTimeTasks = allTimeTasks.map((t) => t.id === id ? { ...t, status: "done" as const } : t);
          const oldSheet = computeCharacterSheet(allTimeTasks, bonusXp);
          const newSheet = computeCharacterSheet(updatedAllTimeTasks, bonusXp);
          checkAndEmitLevelUp(oldSheet.globalXP, newSheet.globalXP);

          // Calculate old and new achievements to detect unlocks
          const dbProjects = projects as any[];
          const dbSprints = sprints as any[];
          const oldAchievements = computeUnlockedAchievements(allTimeTasks, dbProjects, dbSprints);
          const newAchievements = computeUnlockedAchievements(updatedAllTimeTasks, dbProjects, dbSprints);
          checkAndEmitAchievementUnlocks(oldAchievements, newAchievements);

          // Emit streak milestone notification
          checkAndEmitStreakMilestone(oldStreak, newStreak);
          emit({ type: "task:completed", taskId: id, title: values.title });

          setCompletions((c) => [...c, { id: cid, xp, title: values.title, streak: streakExtended ? newStreak : undefined }]);
          if (soundEnabled) {
            playChime();
          }
          setTimeout(() => {
            setCompletions((c) => c.filter((x) => x.id !== cid));
          }, streakExtended ? 2500 : 1500);
        }
```

New:

```ts
        if (prev.status !== "done" && values.status === "done") {
          setJustCompletedAt(Date.now());
          const onTime = !prev.dueDate || new Date() <= new Date(`${prev.dueDate}T23:59:59`);
          const xp = calcTaskXP(values.priority, values.storyPoint, onTime);
          const cid = crypto.randomUUID();

          const oldStreak = calculateStreak(tasks);
          const updatedTasks = tasks.map((t) => t.id === id ? { ...t, status: "done" as const } : t);
          const newStreak = calculateStreak(updatedTasks);
          const streakExtended = newStreak > oldStreak;

          // Level-up/achievement-unlock detection happens after the server round-trip below
          // (it needs the server's authoritative post-mutation values) — see the `apiUpdateTask`
          // response handling further down. Current-streak-milestone detection stays here,
          // unchanged: it only ever needed the recent-window `tasks`, never full history.
          checkAndEmitStreakMilestone(oldStreak, newStreak);
          emit({ type: "task:completed", taskId: id, title: values.title });

          setCompletions((c) => [...c, { id: cid, xp, title: values.title, streak: streakExtended ? newStreak : undefined }]);
          if (soundEnabled) {
            playChime();
          }
          setTimeout(() => {
            setCompletions((c) => c.filter((x) => x.id !== cid));
          }, streakExtended ? 2500 : 1500);
        }
```

- [ ] **Step 6: Update the response handling in `updateTask` to read `result.data.task` and adopt the returned character sheet**

Old:

```ts
        const result = await apiUpdateTask(id, input);
        if (!result.success) {
          notify(result.error.message, "error");
          // Rollback
          const oldValues: TaskFormValues = {
            title: oldTask.title,
            description: oldTask.description ?? undefined,
            project: oldTask.project,
            status: oldTask.status,
            type: oldTask.type,
            priority: oldTask.priority,
            effort: oldTask.effort,
            storyPoint: oldTask.storyPoint ?? undefined,
            startDate: oldTask.startDate ?? undefined,
            dueDate: oldTask.dueDate ?? undefined,
            sprint: oldTask.sprint,
            waitingOn: oldTask.waitingOn,
            reporter: oldTask.reporter,
            tags: oldTask.tags,
            relations: oldTask.relations,
            attachments: oldTask.attachments,
            deliverables: oldTask.deliverables,
          };
          dispatch({ type: "update", id, changedAt: new Date().toISOString(), values: oldValues });
          return false;
        }
        // Sync response to client state — only if this is the latest request for this task
        if (lastSyncTimeRef.current[id] === requestTime) {
          const dbProjects = projects as any[];
          const dbSprints = sprints as any[];
          const syncedTask = mapDbTaskToClient(result.data, dbProjects, dbSprints);
          dispatch({ type: "sync", task: syncedTask });
        }
        return true;
      },
```

New:

```ts
        const result = await apiUpdateTask(id, input);
        if (!result.success) {
          notify(result.error.message, "error");
          // Rollback
          const oldValues: TaskFormValues = {
            title: oldTask.title,
            description: oldTask.description ?? undefined,
            project: oldTask.project,
            status: oldTask.status,
            type: oldTask.type,
            priority: oldTask.priority,
            effort: oldTask.effort,
            storyPoint: oldTask.storyPoint ?? undefined,
            startDate: oldTask.startDate ?? undefined,
            dueDate: oldTask.dueDate ?? undefined,
            sprint: oldTask.sprint,
            waitingOn: oldTask.waitingOn,
            reporter: oldTask.reporter,
            tags: oldTask.tags,
            relations: oldTask.relations,
            attachments: oldTask.attachments,
            deliverables: oldTask.deliverables,
          };
          dispatch({ type: "update", id, changedAt: new Date().toISOString(), values: oldValues });
          return false;
        }
        // Sync response to client state — only if this is the latest request for this task
        if (lastSyncTimeRef.current[id] === requestTime) {
          const dbProjects = projects as any[];
          const dbSprints = sprints as any[];
          const syncedTask = mapDbTaskToClient(result.data.task, dbProjects, dbSprints);
          dispatch({ type: "sync", task: syncedTask });
        }
        // Level-up/achievement-unlock detection: "old" is whatever the client currently holds
        // (from before this mutation resolved), "new" is the server's authoritative post-mutation
        // value — no client-side array scanning needed anymore.
        if (result.data.characterSheet) {
          checkAndEmitLevelUp(characterSheet.globalXP, result.data.characterSheet.globalXP);
          setCharacterSheet(result.data.characterSheet);
        }
        if (result.data.unlockedAchievements) {
          checkAndEmitAchievementUnlocks(unlockedAchievements, result.data.unlockedAchievements);
          setUnlockedAchievements(result.data.unlockedAchievements);
        }
        return true;
      },
```

- [ ] **Step 7: Update `createTask`'s response handling**

Old:

```ts
        const result = await apiCreateTask(input);
        if (!result.success) {
          notify(result.error.message, "error");
        } else {
          const dbProjects = projects as any[];
          const dbSprints = sprints as any[];
          const clientTask = mapDbTaskToClient(result.data, dbProjects, dbSprints);
          dispatch({ type: "restore", task: clientTask });
        }
      },
      updateTask: async (id, values) => {
```

New:

```ts
        const result = await apiCreateTask(input);
        if (!result.success) {
          notify(result.error.message, "error");
        } else {
          const dbProjects = projects as any[];
          const dbSprints = sprints as any[];
          const clientTask = mapDbTaskToClient(result.data.task, dbProjects, dbSprints);
          dispatch({ type: "restore", task: clientTask });
          if (result.data.characterSheet) {
            checkAndEmitLevelUp(characterSheet.globalXP, result.data.characterSheet.globalXP);
            setCharacterSheet(result.data.characterSheet);
          }
          if (result.data.unlockedAchievements) {
            checkAndEmitAchievementUnlocks(unlockedAchievements, result.data.unlockedAchievements);
            setUnlockedAchievements(result.data.unlockedAchievements);
          }
        }
      },
      updateTask: async (id, values) => {
```

- [ ] **Step 8: Update `duplicateTask`'s response handling (it also calls `apiCreateTask`)**

Old:

```ts
        const result = await apiCreateTask(input);
        if (!result.success) {
          notify(result.error.message, "error");
          dispatch({ type: "delete", id: tempId });
          setSheet((s) => (s.task?.id === tempId ? { ...s, open: false } : s));
        } else {
          dispatch({ type: "replaceId", tempId, realId: result.data.id });
          setSheet((s) =>
            s.task?.id === tempId
              ? { ...s, task: { ...s.task, id: result.data.id } }
              : s
          );
        }
      },
```

New:

```ts
        const result = await apiCreateTask(input);
        if (!result.success) {
          notify(result.error.message, "error");
          dispatch({ type: "delete", id: tempId });
          setSheet((s) => (s.task?.id === tempId ? { ...s, open: false } : s));
        } else {
          dispatch({ type: "replaceId", tempId, realId: result.data.task.id });
          setSheet((s) =>
            s.task?.id === tempId
              ? { ...s, task: { ...s.task, id: result.data.task.id } }
              : s
          );
          if (result.data.characterSheet) {
            checkAndEmitLevelUp(characterSheet.globalXP, result.data.characterSheet.globalXP);
            setCharacterSheet(result.data.characterSheet);
          }
          if (result.data.unlockedAchievements) {
            checkAndEmitAchievementUnlocks(unlockedAchievements, result.data.unlockedAchievements);
            setUnlockedAchievements(result.data.unlockedAchievements);
          }
        }
      },
```

- [ ] **Step 9: Update `claimDailyQuest`'s response handling**

Old:

```ts
      claimDailyQuest: async (dateStr, xp, coins) => {
        const res = await apiClaimDailyQuest({ dateStr, xp, coins });
        if (res.success) {
          // Check for level-up before updating bonusXp state
          const dbProjects = projects as any[];
          const dbSprints = sprints as any[];
          const oldSheet = computeCharacterSheet(allTimeTasks, bonusXp);
          const newSheet = computeCharacterSheet(allTimeTasks, res.data.bonusXp);
          checkAndEmitLevelUp(oldSheet.globalXP, newSheet.globalXP);

          // Check for achievement unlocks
          const oldAchievements = computeUnlockedAchievements(allTimeTasks, dbProjects, dbSprints);
          const newAchievements = computeUnlockedAchievements(allTimeTasks, dbProjects, dbSprints);
          checkAndEmitAchievementUnlocks(oldAchievements, newAchievements);

          setBonusXp(res.data.bonusXp);
          setBonusCoins(res.data.bonusCoins);
          setLastQuestClaimedAt(res.data.lastQuestClaimedAt);
          notify("Daily quest claimed! +XP and +Coins!", "success");
          return true;
        } else {
          notify(res.error.message, "error");
          return false;
        }
      },
```

New:

```ts
      claimDailyQuest: async (dateStr, xp, coins) => {
        const res = await apiClaimDailyQuest({ dateStr, xp, coins });
        if (res.success) {
          if (res.data.characterSheet) {
            checkAndEmitLevelUp(characterSheet.globalXP, res.data.characterSheet.globalXP);
            setCharacterSheet(res.data.characterSheet);
          }
          if (res.data.unlockedAchievements) {
            checkAndEmitAchievementUnlocks(unlockedAchievements, res.data.unlockedAchievements);
            setUnlockedAchievements(res.data.unlockedAchievements);
          }

          setBonusXp(res.data.bonusXp);
          setBonusCoins(res.data.bonusCoins);
          setLastQuestClaimedAt(res.data.lastQuestClaimedAt);
          notify("Daily quest claimed! +XP and +Coins!", "success");
          return true;
        } else {
          notify(res.error.message, "error");
          return false;
        }
      },
```

- [ ] **Step 10: Reset `characterSheet`/`unlockedAchievements` in the "Reset All" flow**

Old:

```ts
      reset: async () => {
        dispatch({ type: "reset", tasks: initialTasksRef.current });
        setSheet({ open: false, mode: "create", task: null });
        setJustCompletedAt(null);
        setBonusXp(0);
        setBonusCoins(0);
        setPurchasedDecorations([]);
        setPlacedDecorations({});
        setSavedFilters([]);
        setLastQuestClaimedAt(null);
        setActiveTimer(null);
        await apiUpdateUserStats({ bonusXp: 0, bonusCoins: 0 });
      },
```

New:

```ts
      reset: async () => {
        dispatch({ type: "reset", tasks: initialTasksRef.current });
        setSheet({ open: false, mode: "create", task: null });
        setJustCompletedAt(null);
        setBonusXp(0);
        setBonusCoins(0);
        setCharacterSheet(computeCharacterSheet([], 0, 0));
        setUnlockedAchievements(computeUnlockedAchievements([], projects as any[], sprints as any[]));
        setPurchasedDecorations([]);
        setPlacedDecorations({});
        setSavedFilters([]);
        setLastQuestClaimedAt(null);
        setActiveTimer(null);
        await apiUpdateUserStats({ bonusXp: 0, bonusCoins: 0 });
      },
```

- [ ] **Step 11: Expose the two new fields on the context value and add them to the `useMemo` dependency array**

Old:

```ts
    () => ({
      tasks,
      allTimeTasks,
      createTask: async (values) => {
```

New:

```ts
    () => ({
      tasks,
      allTimeTasks,
      characterSheet,
      unlockedAchievements,
      createTask: async (values) => {
```

Old (dependency array):

```ts
    [
      tasks,
      allTimeTasks,
      activityLogs,
```

New:

```ts
    [
      tasks,
      allTimeTasks,
      characterSheet,
      unlockedAchievements,
      activityLogs,
```

- [ ] **Step 12: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "TasksProvider"`
Expected: no output.

- [ ] **Step 13: Commit**

```bash
git add src/components/providers/TasksProvider.tsx
git commit -m "feat: TasksProvider holds server-computed characterSheet, adopts it from mutation responses"
```

---

### Task 5: Update the 6 consumer components to read characterSheet from context

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/components/gamification/CharacterContent.tsx`
- Modify: `src/components/gamification/RoomDecoration.tsx`
- Modify: `src/components/gamification/SaveAndQuitOverlay.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `characterSheet: CharacterSheet` from `useTasks()` (Task 4).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: `Sidebar.tsx`**

Old:

```ts
import { computeCharacterSheet, getNextStreakMilestone, calculateStreak, completedAt, formatLocalDate } from "@/lib/gamification";
```

New:

```ts
import { getNextStreakMilestone, calculateStreak, completedAt, formatLocalDate } from "@/lib/gamification";
```

Old:

```ts
  const { tasks, allTimeTasks, openCreateForm, openEditForm, justCompleted, bonusXp, bonusCoins, updateTask } = useTasks();
```

New:

```ts
  const { tasks, characterSheet, openCreateForm, openEditForm, justCompleted, updateTask } = useTasks();
```

Old:

```ts
  const sheet = useMemo(() => computeCharacterSheet(allTimeTasks, bonusXp, bonusCoins), [allTimeTasks, bonusXp, bonusCoins]);
```

New:

```ts
  const sheet = characterSheet;
```

- [ ] **Step 2: `CharacterContent.tsx`**

Old:

```ts
import { computeCharacterSheet, SKILL_META, STATS, calculateStreak, completedAt } from "@/lib/gamification";
```

New:

```ts
import { SKILL_META, STATS, calculateStreak, completedAt } from "@/lib/gamification";
```

Old:

```ts
  const { tasks, allTimeTasks, bonusXp, bonusCoins } = useTasks();
```

New:

```ts
  const { tasks, characterSheet } = useTasks();
```

Old:

```ts
  const sheet = useMemo(() => computeCharacterSheet(allTimeTasks, bonusXp, bonusCoins), [allTimeTasks, bonusXp, bonusCoins]);
```

New:

```ts
  const sheet = characterSheet;
```

- [ ] **Step 3: `RoomDecoration.tsx`**

Old:

```ts
import { computeCharacterSheet } from "@/lib/gamification";
```

Delete this import line entirely (no other use of `computeCharacterSheet` remains in this file).

Old:

```ts
  const {
    allTimeTasks,
    bonusXp,
    bonusCoins,
    purchasedDecorations,
    placedDecorations,
    purchaseDecoration,
    placeDecoration,
  } = useTasks();
```

New:

```ts
  const {
    characterSheet,
    purchasedDecorations,
    placedDecorations,
    purchaseDecoration,
    placeDecoration,
  } = useTasks();
```

Old:

```ts
  // Compute live character sheet to get exact current coins total
  const sheet = computeCharacterSheet(allTimeTasks, bonusXp, bonusCoins);
  const currentCoins = sheet.totalCoins;
```

New:

```ts
  const currentCoins = characterSheet.totalCoins;
```

- [ ] **Step 4: `SaveAndQuitOverlay.tsx`**

Old:

```ts
import {
  calcTaskXP,
  calculateStreak,
  completedAt,
  computeCharacterSheet,
  formatLocalDate,
  getFarewell,
  isTaskOnTime,
  type CompanionMood,
} from "@/lib/gamification";
```

New:

```ts
import {
  calcTaskXP,
  calculateStreak,
  completedAt,
  formatLocalDate,
  getFarewell,
  isTaskOnTime,
  type CompanionMood,
} from "@/lib/gamification";
```

Old:

```ts
export function SaveAndQuitOverlay({ onClose }: { onClose: () => void }) {
  const { tasks, allTimeTasks } = useTasks();
  const [saving, setSaving] = useState(false);
  const [serverStats, setServerStats] = useState<{ bonusXp: number; bonusCoins: number } | null>(null);
  const savingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const quitRef = useRef<HTMLButtonElement>(null);
  const today = useMemo(() => todayStr(), []);

  useEffect(() => {
    const fetchStats = async () => {
      const { getUserStatsAction } = await import("@/lib/actions/user");
      const result = await getUserStatsAction();
      if (result.success) {
        setServerStats(result.data);
      }
    };
    void fetchStats();
  }, []);
```

New — the separate `getUserStatsAction` fetch-on-mount is gone; `characterSheet` from context is already fresh (Task 4 keeps it that way on every mutation):

```ts
export function SaveAndQuitOverlay({ onClose }: { onClose: () => void }) {
  const { tasks, characterSheet } = useTasks();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const quitRef = useRef<HTMLButtonElement>(null);
  const today = useMemo(() => todayStr(), []);
```

Old:

```ts
  const streakDays = useMemo(() => calculateStreak(tasks), [tasks]);
  const totalCoins = useMemo(
    () => {
      if (!serverStats) return 0;
      return computeCharacterSheet(allTimeTasks, serverStats.bonusXp, serverStats.bonusCoins).totalCoins;
    },
    [allTimeTasks, serverStats]
  );
```

New:

```ts
  const streakDays = useMemo(() => calculateStreak(tasks), [tasks]);
  const totalCoins = characterSheet.totalCoins;
```

- [ ] **Step 5: `settings/page.tsx`**

Old:

```ts
import { useMemo, useRef, useState, useCallback } from "react";
```

New — `useMemo` was only ever used for the `sheet` computation being removed below (confirmed via `grep -n "useMemo" "src/app/(dashboard)/settings/page.tsx"`, which shows exactly one other match: the `sheet` line itself):

```ts
import { useRef, useState, useCallback } from "react";
```

Old:

```ts
import { computeCharacterSheet } from "@/lib/gamification";
```

Delete this import line entirely.

Old:

```ts
  const { allTimeTasks, bonusXp, bonusCoins, reset: resetTasks } = useTasks();
```

New — `bonusXp`/`bonusCoins` are still needed for the Export payload (`bonus: { xp: bonusXp, coins: bonusCoins }`), so they stay:

```ts
  const { characterSheet, bonusXp, bonusCoins, reset: resetTasks } = useTasks();
```

Old:

```ts
  const sheet = useMemo(() => computeCharacterSheet(allTimeTasks, bonusXp, bonusCoins), [allTimeTasks, bonusXp, bonusCoins]);
```

New:

```ts
  const sheet = characterSheet;
```

- [ ] **Step 6: `dashboard/page.tsx`**

Old:

```ts
import { calcTaskCoins, calcTaskXP, completedAt, computeCharacterSheet, isTaskOnTime, calculateStreak } from "@/lib/gamification";
```

New:

```ts
import { calcTaskCoins, calcTaskXP, completedAt, isTaskOnTime, calculateStreak } from "@/lib/gamification";
```

Old:

```ts
  const { tasks, allTimeTasks, activityLogs, bonusXp, bonusCoins, lastQuestClaimedAt, claimDailyQuest } = useTasks();
  const { sprints } = useSprints();
  const sheet = useMemo(() => computeCharacterSheet(allTimeTasks, bonusXp, bonusCoins), [allTimeTasks, bonusXp, bonusCoins]);
```

New:

```ts
  const { tasks, characterSheet, activityLogs, lastQuestClaimedAt, claimDailyQuest } = useTasks();
  const { sprints } = useSprints();
  const sheet = characterSheet;
```

- [ ] **Step 7: Typecheck all six**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "Sidebar.tsx|CharacterContent.tsx|RoomDecoration.tsx|SaveAndQuitOverlay.tsx|settings/page.tsx|dashboard/page.tsx"`
Expected: no output.

- [ ] **Step 8: Run the existing test suite and build**

Run: `npx vitest run 2>&1 | tail -5`
Expected: `PASS (104) FAIL (0)`.

Run: `npx next build 2>&1 | tail -10`
Expected: `Errors: 0 | Warnings: 0`.

- [ ] **Step 9: Manual browser check**

Sign in, then: (a) complete a task and confirm the Sidebar XP bar updates instantly with no visible delay; (b) if the account is close to a level boundary, confirm the level-up toast still fires (otherwise, temporarily note the current XP/level and trust the code path — this is the same `checkAndEmitLevelUp` function, just fed server data now); (c) visit Character Sheet, confirm it matches the Sidebar's numbers; (d) visit Room Decoration, confirm the coin total matches; (e) open Save & Quit, confirm the coin stat card shows the right number; (f) claim the Daily Quest if available, confirm XP/coins update correctly afterward.

- [ ] **Step 10: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/gamification/CharacterContent.tsx src/components/gamification/RoomDecoration.tsx src/components/gamification/SaveAndQuitOverlay.tsx "src/app/(dashboard)/settings/page.tsx" "src/app/(dashboard)/dashboard/page.tsx"
git commit -m "refactor: read characterSheet from context instead of recomputing it per-component"
```

---

### Task 6: Full verification and docs update

**Files:**
- Modify: `docs/05-backlog.md`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing (terminal task).

- [ ] **Step 1: Full verification pass**

Run in sequence:
```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | tail -6
npx vitest run 2>&1 | tail -6
npx next build 2>&1 | tail -10
```
Expected: same 14 pre-existing errors in 6 test files as before this plan (no new ones), `PASS (104) FAIL (0)`, `Errors: 0 | Warnings: 0`.

- [ ] **Step 2: Confirm no remaining client-side `computeCharacterSheet`/`computeUnlockedAchievements` calls outside `TasksProvider.tsx`**

Run: `grep -rln "computeCharacterSheet\|computeUnlockedAchievements" src --include="*.tsx" --include="*.ts" | grep -v "gamification.ts\|character-sheet-data.ts\|achievements-data.ts\|TasksProvider.tsx\|\.test\."`
Expected: no output — every remaining call site is either the function's own definition, the two Phase 1 data layers, or `TasksProvider.tsx`'s `reset()` (the one place still allowed to call these directly, per Task 4 Step 10).

- [ ] **Step 3: Update `docs/05-backlog.md`**

Append a new row to the §8 findings table:

```markdown
| 18 | Character Sheet (XP/level/coins) and the level-up/achievement-unlock live-feedback mechanism were still client-computed from `allTimeTasks` after Phase 1 (deliberately deferred, see finding #17) | Architecture improvement (Phase 2, user-raised) | **Fixed** — new `getCharacterSheetData(ownerId)` helper (mirrors the Phase 1 pattern) computes the character sheet + achievement unlock state server-side, called once per page load (`layout.tsx`) and again inline from `updateTask`/`createTask`/`claimDailyQuestAction` after their DB write. `TasksProvider` adopts the server's returned value directly instead of scanning `allTimeTasks` before/after a mutation — closes the double-bookkeeping bug class (finding #1) at the architecture level, not just the one instance. The per-task "+XP" toast and current-streak-milestone detection are untouched — both were already correct, per-task/recent-window-only calculations with no dependency on full history. `allTimeTasks` stays in `TasksProvider`, narrowed to its one remaining consumer (`TaskFormSheet`'s relation-trashed check). See `docs/superpowers/specs/2026-08-03-server-computed-character-sheet-design.md` |
```

- [ ] **Step 4: Commit**

```bash
git add docs/05-backlog.md
git commit -m "docs: record server-computed Character Sheet migration (Phase 2)"
```
