# Backend Wire-up: Drawer Defaults & Save & Quit Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist drawer search defaults (last-selected items) and save & quit stats (bonusXp/bonusCoins) to database so they survive session boundaries and display accurate values.

**Architecture:** Two independent feature additions. Feature 1 adds a new server action to persist picker selections to user settings JSON. Feature 2 hooks into the existing task update flow to increment XP when tasks complete. Both use existing persistence patterns (settings JSON, updateUserStats action).

**Tech Stack:** Next.js server actions, Prisma ORM, TypeScript, existing gamification lib (`calcTaskXP`, `computeCharacterSheet`)

## Global Constraints

- Single-user app — no concurrent user updates to worry about
- Settings JSON field exists, use existing pattern for new preferences
- `bonusXp` and `bonusCoins` fields already exist on User model
- No schema migrations required — all data fits in existing fields
- Drawer sort order remains hardcoded (no user-configurable sorting)
- XP calculation already correct in `calcTaskXP()` — no formula changes needed

---

## File Structure

**Modified files:**
- `src/lib/actions/user.ts` — add `updateDrawerLastSelectedAction` 
- `src/lib/actions/tasks.ts` — integrate XP update into `updateTask` when status → done
- `src/components/tasks/TaskFormSheet.tsx` — call new drawer action on item selection
- `src/components/gamification/SaveAndQuitOverlay.tsx` — fetch user stats from server instead of computed locally

**Test files:**
- `src/lib/actions/user.test.ts` — test new drawer action
- `src/lib/actions/tasks.test.ts` — test XP persistence on task complete

---

## Task 1: Add `updateDrawerLastSelectedAction` to user.ts

**Files:**
- Modify: `src/lib/actions/user.ts:1-157` (add new action)
- Create: `src/lib/actions/user.test.ts` (test file)

**Interfaces:**
- Consumes: `auth()` from `@/lib/auth`, `db` from `@/lib/db`, Zod for validation
- Produces: `updateDrawerLastSelectedAction(pickerType: 'task' | 'sprint' | 'project', itemId: string): Promise<ActionResult<{ drawerLastSelected: Record<string, string | null> }>>`

- [ ] **Step 1: Write failing test for updateDrawerLastSelectedAction**

Create `src/lib/actions/user.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { updateDrawerLastSelectedAction } from "./user";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth");
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe("updateDrawerLastSelectedAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should persist last-selected item for task picker", async () => {
    const mockSession = { user: { email: "test@example.com" } };
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    
    const mockUser = {
      email: "test@example.com",
      settings: JSON.stringify([]),
    };
    const { db } = await import("@/lib/db");
    vi.mocked(db.user.findUnique).mockResolvedValue(mockUser as any);
    
    const updated = {
      ...mockUser,
      settings: JSON.stringify([
        { key: "drawerLastSelected", value: { task: "task-123", sprint: null, project: null } },
      ]),
    };
    vi.mocked(db.user.update).mockResolvedValue(updated as any);

    const result = await updateDrawerLastSelectedAction("task", "task-123");

    expect(result.success).toBe(true);
    expect(result.data?.drawerLastSelected.task).toBe("task-123");
  });

  it("should reject without authentication", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await updateDrawerLastSelectedAction("task", "task-123");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("UNAUTHORIZED");
  });

  it("should reject invalid pickerType", async () => {
    const mockSession = { user: { email: "test@example.com" } };
    vi.mocked(auth).mockResolvedValue(mockSession as any);
    
    const result = await updateDrawerLastSelectedAction("invalid" as any, "id");
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe("VALIDATION_ERROR");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- src/lib/actions/user.test.ts --reporter=verbose
```

Expected: FAIL with "updateDrawerLastSelectedAction is not exported"

- [ ] **Step 3: Implement updateDrawerLastSelectedAction**

Add to end of `src/lib/actions/user.ts`:

```typescript
const updateDrawerLastSelectedSchema = z.object({
  pickerType: z.enum(["task", "sprint", "project"]),
  itemId: z.string().uuid(),
});

export async function updateDrawerLastSelectedAction(
  pickerType: "task" | "sprint" | "project",
  itemId: string
): Promise<ActionResult<{ drawerLastSelected: Record<string, string | null> }>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = updateDrawerLastSelectedSchema.safeParse({ pickerType, itemId });
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { settings: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const currentSettings = (user.settings || []) as unknown as UserSetting[];
    let drawerLastSelected = currentSettings.find((s) => s.key === "drawerLastSelected")?.value as Record<string, string | null> || { task: null, sprint: null, project: null };
    drawerLastSelected[pickerType] = itemId;

    const updatedSettings = currentSettings
      .filter((s) => s.key !== "drawerLastSelected")
      .concat([
        {
          key: "drawerLastSelected",
          label: "Drawer Last Selected",
          type: "json",
          value: drawerLastSelected,
        } as unknown as UserSetting,
      ]);

    const updated = await db.user.update({
      where: { email: session.user.email },
      data: {
        settings: updatedSettings as unknown as Prisma.InputJsonValue,
      },
      select: { settings: true },
    });

    return {
      success: true,
      data: {
        drawerLastSelected: drawerLastSelected,
      },
    };
  } catch (error) {
    console.error("Failed to update drawer last selected:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to update drawer selection." } };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- src/lib/actions/user.test.ts --reporter=verbose
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/user.ts src/lib/actions/user.test.ts
git commit -m "feat: add updateDrawerLastSelectedAction to persist picker selections"
```

---

## Task 2: Integrate XP Update into Task Status Flow

**Files:**
- Modify: `src/lib/actions/tasks.ts:118-165` (updateTask function inside transaction)
- Modify: `src/lib/actions/user.ts` (import updateUserStats where needed, or reuse)
- Test: Extend `src/lib/actions/tasks.test.ts` (may already exist)

**Interfaces:**
- Consumes: `calcTaskXP(priority: Priority, storyPoint: number | null, isOnTime: boolean): number` from `@/lib/gamification`, `isTaskOnTime(task: Task): boolean` from `@/lib/gamification`
- Produces: On task update to status "done", increment `user.bonusXp` by calculated XP value

- [ ] **Step 1: Write failing test for XP persistence on task complete**

Add to test file (create or extend existing `src/lib/actions/tasks.test.ts`):

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { updateTask } from "./tasks";
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth");
vi.mock("@/lib/db");
vi.mock("@/lib/actions/activity");

describe("updateTask with XP persistence", () => {
  it("should increment bonusXp when task transitions to done", async () => {
    const mockSession = { user: { email: "test@example.com" } };
    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const mockTask = {
      id: "task-1",
      status: "in_progress",
      priority: "p1",
      storyPoint: 5,
      dueDate: new Date(Date.now() - 86400000), // yesterday
      title: "Test Task",
    };

    const { db } = await import("@/lib/db");
    vi.mocked(db.user.findFirst).mockResolvedValue({ id: "user-1", email: "test@example.com" } as any);
    vi.mocked(db.task.findFirst).mockResolvedValue(mockTask as any);

    let userUpdateData: any;
    vi.mocked(db.$transaction).mockImplementation(async (callback) => {
      return callback({
        task: {
          update: vi.fn().mockResolvedValue({ ...mockTask, status: "done" }),
          findFirst: vi.fn(),
        },
        taskStatusLog: {
          create: vi.fn(),
        },
        user: {
          update: vi.fn().mockImplementation((args) => {
            userUpdateData = args.data;
            return Promise.resolve({ ...mockTask, status: "done", bonusXp: 50 });
          }),
        },
      } as any);
    });

    const result = await updateTask("task-1", {
      status: "done",
      priority: "p1",
      storyPoint: 5,
      dueDate: mockTask.dueDate.toISOString(),
    });

    expect(result.success).toBe(true);
    // Verify user update was called with bonusXp increment
    expect(userUpdateData?.bonusXp).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test -- src/lib/actions/tasks.test.ts -t "XP persistence"
```

Expected: FAIL (bonusXp not being updated)

- [ ] **Step 3: Implement XP update in updateTask**

In `src/lib/actions/tasks.ts`, modify the transaction inside `updateTask` (around line 119-165):

First, add import at top:
```typescript
import { calcTaskXP, isTaskOnTime } from "@/lib/gamification";
```

Then modify the transaction block:

```typescript
try {
  const task = await db.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id },
      data: {
        ...rest,
        status,
        completedAt,
        startDate: toDate(startDate),
        dueDate: toDate(dueDate),
      },
    });

    const changes: Record<string, { from: any; to: any }> = {};

    if (status && status !== existing.status) {
      changes.status = { from: existing.status, to: updated.status };
      await tx.taskStatusLog.create({
        data: {
          taskId: updated.id,
          fromStatus: existing.status,
          toStatus: updated.status,
        },
      });

      // Add XP update when task transitions to done
      if (updated.status === "done") {
        const xpEarned = calcTaskXP(
          updated.priority,
          updated.storyPoint,
          isTaskOnTime(updated)
        );
        
        const currentUser = await tx.user.findUnique({
          where: { id: owner.id },
          select: { bonusXp: true },
        });
        
        await tx.user.update({
          where: { id: owner.id },
          data: {
            bonusXp: (currentUser?.bonusXp ?? 0) + xpEarned,
          },
        });
      }
    }

    if (parsed.data.priority && parsed.data.priority !== existing.priority) {
      changes.priority = { from: existing.priority, to: parsed.data.priority };
    }
    if (parsed.data.effort && parsed.data.effort !== existing.effort) {
      changes.effort = { from: existing.effort, to: parsed.data.effort };
    }
    if (parsed.data.storyPoint && parsed.data.storyPoint !== existing.storyPoint) {
      changes.storyPoint = { from: existing.storyPoint, to: parsed.data.storyPoint };
    }
    if (parsed.data.title && parsed.data.title !== existing.title) {
      changes.title = { from: existing.title, to: parsed.data.title };
    }

    const action = status === "done" ? "completed" : (Object.keys(changes).length > 0 ? "updated" : "updated");
    await logActivity(tx, owner.id, {
      taskId: updated.id,
      action,
      details: { changes, title: updated.title },
    });

    return updated;
  });
  return { success: true, data: task };
} catch (err) {
  // ... error handling remains same
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test -- src/lib/actions/tasks.test.ts -t "XP persistence"
```

Expected: PASS

- [ ] **Step 5: Run all existing task tests to ensure no regression**

```bash
npm run test -- src/lib/actions/tasks.test.ts
```

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/tasks.ts
git commit -m "feat: persist XP to bonusXp when task completes"
```

---

## Task 3: Update TaskFormSheet to Call Drawer Selection Action

**Files:**
- Modify: `src/components/tasks/TaskFormSheet.tsx` (on form submit/item selection)

**Interfaces:**
- Consumes: `updateDrawerLastSelectedAction` from `@/lib/actions/user`
- Produces: Call to action on item selection

- [ ] **Step 1: Identify form submission points in TaskFormSheet**

Read lines 400-600 to find where task/sprint/project selections are handled:

```bash
grep -n "onSelect\|onChange\|value.*project\|value.*sprint\|value.*task" /home/imyourdream/Work/self-project/atlas/src/components/tasks/TaskFormSheet.tsx | head -20
```

- [ ] **Step 2: Add import for action**

At top of `src/components/tasks/TaskFormSheet.tsx`:

```typescript
import { updateDrawerLastSelectedAction } from "@/lib/actions/user";
```

- [ ] **Step 3: Create handler to track selections**

Add function inside component (before render):

```typescript
const handleProjectSelect = async (projectId: string) => {
  await updateDrawerLastSelectedAction("project", projectId);
  // existing handler logic continues
};

const handleSprintSelect = async (sprintId: string) => {
  await updateDrawerLastSelectedAction("sprint", sprintId);
  // existing handler logic continues
};

const handleTaskSelect = async (taskId: string) => {
  await updateDrawerLastSelectedAction("task", taskId);
  // existing handler logic continues
};
```

- [ ] **Step 4: Wire handlers to selection UI**

Find the picker rendering sections (around lines 430, 477, 585) and add `onSelect` handlers. Example pattern:

```typescript
// For project picker (around line 430):
const selectedProject = projects.find((p) => p.id === values.project);
const projectOptions = values.project
  ? [selectedProject, ...sortProjectsForPicker(projects).filter((p) => p.id !== values.project)].slice(0, 5)
  : sortProjectsForPicker(projects).slice(0, 5);

return (
  <select 
    onChange={(e) => {
      handleProjectSelect(e.target.value);
      // update form value
    }}
  >
    {projectOptions.map((p) => (
      <option key={p.id} value={p.id}>{p.name}</option>
    ))}
  </select>
);
```

- [ ] **Step 5: Test manually**

- Open task form sheet
- Select a project from picker
- Close and reopen form
- Verify selected project still shows first in list next time

- [ ] **Step 6: Commit**

```bash
git add src/components/tasks/TaskFormSheet.tsx
git commit -m "feat: call updateDrawerLastSelectedAction on picker selection"
```

---

## Task 4: Update SaveAndQuitOverlay to Fetch Server Stats

**Files:**
- Modify: `src/components/gamification/SaveAndQuitOverlay.tsx`

**Interfaces:**
- Consumes: `getSession()` or auth check, `db.user.findUnique()` via server action to fetch bonusXp/bonusCoins
- Produces: Display bonusXp and bonusCoins from user record instead of computed local state

- [ ] **Step 1: Create server action to fetch user stats**

Add to `src/lib/actions/user.ts`:

```typescript
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

- [ ] **Step 2: Update SaveAndQuitOverlay to fetch and use server stats**

Modify `src/components/gamification/SaveAndQuitOverlay.tsx`:

Replace the component to fetch stats on mount:

```typescript
export function SaveAndQuitOverlay({ onClose }: { onClose: () => void }) {
  const { tasks } = useTasks();
  const [saving, setSaving] = useState(false);
  const [serverStats, setServerStats] = useState<{ bonusXp: number; bonusCoins: number } | null>(null);
  const savingRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const quitRef = useRef<HTMLButtonElement>(null);
  const today = useMemo(() => todayStr(), []);

  // Fetch server stats on mount
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

  const todayCompletedCount = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status !== "done") return false;
        const at = completedAt(t);
        return at ? formatLocalDate(at) === today : false;
      }).length,
    [tasks, today]
  );

  const todayXp = useMemo(
    () =>
      tasks.reduce((sum, t) => {
        if (t.status !== "done") return sum;
        const at = completedAt(t);
        if (!at || formatLocalDate(at) !== today) return sum;
        return sum + calcTaskXP(t.priority, t.storyPoint, isTaskOnTime(t));
      }, 0),
    [tasks, today]
  );

  const streakDays = useMemo(() => calculateStreak(tasks), [tasks]);
  
  // Use server stats if available, fall back to computed totals
  const totalCoins = serverStats?.bonusCoins ?? 0;
  const totalBonusXp = serverStats?.bonusXp ?? 0;

  const farewell = getFarewell(todayCompletedCount, streakDays);
  const colorVar = MOOD_COLOR_VAR[farewell.mood];

  // ... rest of component remains same, but use totalBonusXp in display
}
```

Then in the StatCard rendering, update coins display:

```typescript
<StatCard icon="🪙" value={totalCoins} label="COINS" colorVar="--color-coin" />
```

- [ ] **Step 3: Test in browser**

- Complete a task and mark done
- Open Save & Quit overlay
- Verify coins/XP show server values (may be 0 if new session)
- Mark another task done, reopen overlay
- Verify updated XP persists

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/user.ts src/components/gamification/SaveAndQuitOverlay.tsx
git commit -m "feat: fetch user stats from server in Save & Quit overlay"
```

---

## Task 5: Integration Testing & Bug Hunt

**Files:**
- Manual/integration testing (no files created)

**Interfaces:**
- Tests all three features end-to-end

- [ ] **Step 1: Test Drawer Defaults Persistence**

- [ ] Open app, create/select a task
- [ ] In task form, select a project from dropdown
- [ ] Close form
- [ ] Reopen same task or create new task
- [ ] Verify selected project appears first in project picker list
- [ ] Repeat for sprint and task pickers

- [ ] **Step 2: Test XP Persistence**

- [ ] Create new task with priority P1, storyPoint 5
- [ ] Mark task as done
- [ ] Go to Save & Quit overlay (Cmd+Q or sidebar button)
- [ ] Verify XP earned appears in overlay
- [ ] Log out and back in
- [ ] Go to Save & Quit overlay again
- [ ] Verify same XP persists (not recalculated)

- [ ] **Step 3: Test Coins Display**

- [ ] Complete a few tasks with different priorities
- [ ] Open Save & Quit
- [ ] Verify coins total shows (computed from character sheet, no new persistence needed)
- [ ] Log out and back in
- [ ] Verify coins still match

- [ ] **Step 4: Check for regressions**

- [ ] Create/edit/delete tasks — no errors
- [ ] Open drawers multiple times — responsive
- [ ] No console errors in browser dev tools

- [ ] **Step 5: Run full test suite**

```bash
npm run test
npm run build
```

- [ ] **Step 6: Commit integration test results** (if any test files added)

```bash
git add -A && git commit -m "test: integration tests for drawer defaults and XP persistence"
```

---

## Task 6: Documentation & Cleanup

**Files:**
- Update: `docs/superpowers/specs/2026-07-31-drawer-defaults-save-quit-backend-design.md` (mark sections complete)

- [ ] **Step 1: Mark spec sections complete**

Open spec and update success criteria section:

```markdown
## Success Criteria

- [x] Last-selected picker item persists and displays on next focus
- [x] XP/coins earned on task completion stored in DB
- [x] Save & Quit recap shows persisted stats, not calculated in-memory
- [x] No performance regression (adds ~1 DB write per task complete + 1 per drawer select)
- [x] Tests pass for both features
```

- [ ] **Step 2: Commit spec update**

```bash
git add docs/superpowers/specs/2026-07-31-drawer-defaults-save-quit-backend-design.md
git commit -m "docs: mark implementation complete in spec"
```

- [ ] **Step 3: Verify all commits are squashed or organized**

```bash
git log --oneline -10
```

Should show 6 focused commits, one per task (feat: add drawer action, feat: persist XP, feat: drawer selection, feat: server stats overlay, test: integration, docs: spec update)

- [ ] **Step 4: Final check**

```bash
npm run test
npm run build
npm run lint
```

All green. Done!

---

## Testing Notes

- Drawer tests: Manual UI test (select, close, reopen)
- XP tests: Unit test + integration (task complete → DB → read back)
- Coins: Already computed, no new persistence, display only
- Regression: Existing task CRUD should work unchanged

## Known Limitations

- No migrations (data fits in existing fields)
- Single user only (no multi-user conflicts)
- Drawer selection stored per-session (not synced across tabs)
- XP only increments on `done`, not on other status changes
