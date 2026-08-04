# Saved Views Edit (Rename + Update Filters) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users rename an existing saved view and overwrite its stored filters with the currently active filter bar state, without deleting and recreating it.

**Architecture:** Add one new Server Action (`updateFilterAction`) that mirrors the existing load→mutate→write-back shape of `deleteFilterAction`, wire it into `TasksProvider` the same way `saveFilter`/`deleteFilter` are wired, then add two independent UI affordances in `TaskFilterBar`: an inline rename control on each saved-view row, and a "Save View" → "Update View" state swap driven by a new `activeSavedViewId` + dirty-check.

**Tech Stack:** Next.js Server Actions (`"use server"`), Prisma (`Json` column), Zod validation, React (client component state), Vitest for the new action's unit tests.

## Global Constraints

- No changes to the `TaskFilters` shape or the `savedFilters` JSON column schema (spec: Data Model).
- All new error paths route through the existing `notify(message, "error")` toast channel in `TasksProvider` — no new error UI (spec: Error Handling).
- Name-collision check on update must exclude the view being edited itself (spec: Server Action step 4).
- No component tests for `TaskFilterBar` — no existing harness for it; verify manually in-browser (spec: Testing).
- Only `updateFilterAction` gets new test coverage; do not backfill tests for `saveFilterAction`/`deleteFilterAction` (spec: Testing, Out of Scope).

---

## File Structure

- Modify: `src/lib/actions/filters.ts` — add `updateFilterAction`.
- Create: `src/lib/actions/__tests__/filters.test.ts` — unit tests for `updateFilterAction`, with `@/lib/db` and `@/lib/auth` mocked (no existing action-level test in this repo mocks these — this test file establishes that pattern).
- Modify: `src/components/providers/TasksProvider.tsx` — add `updateFilter` to context type, implementation, and provider value.
- Modify: `src/components/tasks/TaskFilterBar.tsx` — add inline rename control per saved-view row, and `activeSavedViewId`/dirty-check driven Save↔Update button swap.

---

### Task 1: `updateFilterAction` server action + tests

**Files:**
- Modify: `src/lib/actions/filters.ts`
- Create: `src/lib/actions/__tests__/filters.test.ts`

**Interfaces:**
- Consumes: `ActionResult<T>` from `src/lib/actions/types.ts` (already imported in `filters.ts`); `SavedFilterClient`, `saveFilterInputSchema`, `taskFiltersSchema` already defined in `filters.ts:10-31`; `TaskFilters`, `EMPTY_TASK_FILTERS` from `src/lib/task-filters.ts`.
- Produces: `updateFilterAction(id: string, name: string, filters: TaskFilters): Promise<ActionResult<SavedFilterClient[]>>`, exported from `src/lib/actions/filters.ts`. Task 2 imports this as `apiUpdateFilter`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/actions/__tests__/filters.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateFilterAction, type SavedFilterClient } from "@/lib/actions/filters";
import { EMPTY_TASK_FILTERS } from "@/lib/task-filters";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockFindUnique = db.user.findUnique as unknown as ReturnType<typeof vi.fn>;
const mockUpdate = db.user.update as unknown as ReturnType<typeof vi.fn>;

function existingFilters(): SavedFilterClient[] {
  return [
    { id: "view-1", name: "My Bugs", filters: { ...EMPTY_TASK_FILTERS, types: ["bug"] } },
    { id: "view-2", name: "Sprint Work", filters: { ...EMPTY_TASK_FILTERS, tags: ["sprint"] } },
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { email: "dev@example.com" } });
});

describe("updateFilterAction", () => {
  it("renames a view, preserving its filters", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", savedFilters: existingFilters() });
    mockUpdate.mockResolvedValue({});

    const result = await updateFilterAction("view-1", "Renamed", existingFilters()[0].filters);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    const updated = result.data.find((f) => f.id === "view-1");
    expect(updated?.name).toBe("Renamed");
    expect(updated?.filters).toEqual(existingFilters()[0].filters);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { savedFilters: expect.any(Array) },
    });
  });

  it("updates filters, preserving id and name", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", savedFilters: existingFilters() });
    mockUpdate.mockResolvedValue({});

    const newFilters = { ...EMPTY_TASK_FILTERS, priorities: ["p0" as const] };
    const result = await updateFilterAction("view-1", "My Bugs", newFilters);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    const updated = result.data.find((f) => f.id === "view-1");
    expect(updated?.id).toBe("view-1");
    expect(updated?.name).toBe("My Bugs");
    expect(updated?.filters).toEqual(newFilters);
  });

  it("rejects when the new name collides with a different view", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", savedFilters: existingFilters() });

    const result = await updateFilterAction("view-1", "Sprint Work", existingFilters()[0].filters);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.code).toBe("CONFLICT");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("allows saving with the view's own unchanged name", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", savedFilters: existingFilters() });
    mockUpdate.mockResolvedValue({});

    const result = await updateFilterAction("view-1", "My Bugs", existingFilters()[0].filters);

    expect(result.success).toBe(true);
  });

  it("returns NOT_FOUND when the id doesn't match any saved view", async () => {
    mockFindUnique.mockResolvedValue({ id: "user-1", savedFilters: existingFilters() });

    const result = await updateFilterAction("missing-id", "Whatever", EMPTY_TASK_FILTERS);

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected failure");
    expect(result.error.code).toBe("NOT_FOUND");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/actions/__tests__/filters.test.ts`
Expected: FAIL — `updateFilterAction is not exported from "@/lib/actions/filters"` (or similar import error).

- [ ] **Step 3: Implement `updateFilterAction`**

Append to `src/lib/actions/filters.ts` (after `deleteFilterAction`, i.e. after line 126):

```ts
export async function updateFilterAction(
  id: string,
  name: string,
  filters: TaskFilters
): Promise<ActionResult<SavedFilterClient[]>> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  const parsed = saveFilterInputSchema.safeParse({ name, filters });
  if (!parsed.success) {
    return {
      success: false,
      error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid input." },
    };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, savedFilters: true },
    });

    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const currentFilters = (user.savedFilters as unknown as SavedFilterClient[]) || [];

    if (!currentFilters.some((f) => f.id === id)) {
      return { success: false, error: { code: "NOT_FOUND", message: "Saved view not found." } };
    }

    if (currentFilters.some((f) => f.id !== id && f.name.toLowerCase() === name.toLowerCase())) {
      return { success: false, error: { code: "CONFLICT", message: "A saved filter with this name already exists." } };
    }

    const updatedFilters = currentFilters.map((f) => (f.id === id ? { id, name, filters } : f));

    await db.user.update({
      where: { id: user.id },
      data: {
        savedFilters: updatedFilters as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      data: updatedFilters,
    };
  } catch (error) {
    console.error("Failed to update filter:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to update filter." } };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/actions/__tests__/filters.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/filters.ts src/lib/actions/__tests__/filters.test.ts
git commit -m "feat: add updateFilterAction for editing saved views"
```

---

### Task 2: Wire `updateFilter` into `TasksProvider`

**Files:**
- Modify: `src/components/providers/TasksProvider.tsx`

**Interfaces:**
- Consumes: `updateFilterAction` from `src/lib/actions/filters.ts` (Task 1), imported as `apiUpdateFilter`; existing `notify` helper already used by `saveFilter`/`deleteFilter` (`TasksProvider.tsx:711-732`); existing `SavedFilterClient`, `TaskFilters` types.
- Produces: `updateFilter: (id: string, name: string, filters: TaskFilters) => Promise<boolean>` on the `TasksContextValue`, consumed via `useTasks()` by Task 3 and Task 4.

- [ ] **Step 1: Update the import**

In `src/components/providers/TasksProvider.tsx:39`, change:

```ts
import { saveFilterAction as apiSaveFilter, deleteFilterAction as apiDeleteFilter } from "@/lib/actions/filters";
```

to:

```ts
import { saveFilterAction as apiSaveFilter, deleteFilterAction as apiDeleteFilter, updateFilterAction as apiUpdateFilter } from "@/lib/actions/filters";
```

- [ ] **Step 2: Add to the context type**

In `src/components/providers/TasksProvider.tsx:138-140`, change:

```ts
  savedFilters: SavedFilterClient[];
  saveFilter: (name: string, filters: TaskFilters) => Promise<boolean>;
  deleteFilter: (id: string) => Promise<boolean>;
```

to:

```ts
  savedFilters: SavedFilterClient[];
  saveFilter: (name: string, filters: TaskFilters) => Promise<boolean>;
  deleteFilter: (id: string) => Promise<boolean>;
  updateFilter: (id: string, name: string, filters: TaskFilters) => Promise<boolean>;
```

- [ ] **Step 3: Add the implementation to the provider value**

In `src/components/providers/TasksProvider.tsx:722-732`, after the `deleteFilter` method (right before the closing `},` at line 732), add:

```ts
      updateFilter: async (id, name, filters) => {
        const res = await apiUpdateFilter(id, name, filters);
        if (res.success) {
          setSavedFilters(res.data);
          notify("Saved view updated.", "success");
          return true;
        } else {
          notify(res.error.message, "error");
          return false;
        }
      },
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npx tsc --noEmit`
Expected: no new errors (existing errors, if any, unrelated to `TasksProvider.tsx`/`filters.ts` should be unaffected — confirm none appear on those two files).

- [ ] **Step 5: Commit**

```bash
git add src/components/providers/TasksProvider.tsx
git commit -m "feat: wire updateFilter into TasksProvider"
```

---

### Task 3: Inline rename on saved-view rows

**Files:**
- Modify: `src/components/tasks/TaskFilterBar.tsx`

**Interfaces:**
- Consumes: `updateFilter` from `useTasks()` (Task 2); existing `savedFilters` array and row markup at `TaskFilterBar.tsx:151-172`.
- Produces: no new exports — this is a self-contained UI change scoped to the saved-views dropdown row.

- [ ] **Step 1: Pull `updateFilter` out of `useTasks()`**

In `src/components/tasks/TaskFilterBar.tsx:108`, change:

```ts
  const { savedFilters, saveFilter, deleteFilter } = useTasks();
```

to:

```ts
  const { savedFilters, saveFilter, deleteFilter, updateFilter } = useTasks();
```

- [ ] **Step 2: Add rename state and import the pencil icon**

In `src/components/tasks/TaskFilterBar.tsx:4`, change:

```ts
import { ChevronDown, X } from "lucide-react";
```

to:

```ts
import { ChevronDown, Pencil, X } from "lucide-react";
```

After the existing state declarations at `TaskFilterBar.tsx:109-111` (`viewsOpen`, `isSaving`, `saveName`), add:

```ts
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const commitRename = async (viewId: string) => {
    const trimmed = renameValue.trim();
    const view = savedFilters.find((v) => v.id === viewId);
    if (!trimmed || !view || trimmed === view.name) {
      setRenamingId(null);
      return;
    }
    const ok = await updateFilter(viewId, trimmed, view.filters);
    if (ok) setRenamingId(null);
  };
```

- [ ] **Step 3: Replace the saved-view row markup**

In `src/components/tasks/TaskFilterBar.tsx:151-172`, change:

```tsx
                savedFilters.map((view) => (
                  <div key={view.id} className="flex items-center justify-between gap-2 p-1 hover:bg-secondary">
                    <button
                      type="button"
                      onClick={() => {
                        onChange(normalizeFilters(view.filters));
                        setViewsOpen(false);
                      }}
                      className="flex-1 text-left text-sm text-foreground hover:text-primary truncate font-bold"
                    >
                      {view.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFilter(view.id)}
                      className="text-muted-foreground hover:text-destructive p-0.5"
                      title="Delete view"
                    >
                      <X size={12} style={{ color: "var(--color-priority-p0)" }} />
                    </button>
                  </div>
                ))
```

to:

```tsx
                savedFilters.map((view) =>
                  renamingId === view.id ? (
                    <div key={view.id} className="flex items-center gap-1 p-1">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(view.id);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        onBlur={() => commitRename(view.id)}
                        autoFocus
                        className="flex-1 min-w-0 border border-primary bg-secondary px-1.5 py-0.5 text-sm text-foreground outline-none"
                      />
                    </div>
                  ) : (
                    <div key={view.id} className="flex items-center justify-between gap-2 p-1 hover:bg-secondary">
                      <button
                        type="button"
                        onClick={() => {
                          onChange(normalizeFilters(view.filters));
                          setActiveSavedViewId(view.id);
                          setViewsOpen(false);
                        }}
                        className="flex-1 text-left text-sm text-foreground hover:text-primary truncate font-bold"
                      >
                        {view.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingId(view.id);
                          setRenameValue(view.name);
                        }}
                        className="text-muted-foreground hover:text-primary p-0.5"
                        title="Rename view"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteFilter(view.id)}
                        className="text-muted-foreground hover:text-destructive p-0.5"
                        title="Delete view"
                      >
                        <X size={12} style={{ color: "var(--color-priority-p0)" }} />
                      </button>
                    </div>
                  )
                )
```

Note: `setActiveSavedViewId` is introduced in Task 4 — this task's row-click handler references it because Task 4 changes the same block. If executing Task 3 standalone before Task 4 exists, temporarily omit the `setActiveSavedViewId(view.id)` line and add it back in Task 4's Step 2 (Task 4 restates the full block, so no double-edit is needed if done in order).

- [ ] **Step 4: Manual verification**

Run the dev server (`npm run dev`), open the Tasks page, save a view, open "Saved Views", click the pencil icon on a row, confirm it turns into a text input, edit the name, press Enter, confirm the row shows the new name and a "Saved view updated." toast appears. Also verify Escape cancels without changing the name, and that renaming to an existing view's name shows the "A saved filter with this name already exists." error toast without closing the input... actually on blur it will exit edit mode per `commitRename` only setting `renamingId(null)` when `ok` is true — on failure `renamingId` stays set so the input remains open for correction. Confirm this behavior matches what you see.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/TaskFilterBar.tsx
git commit -m "feat: add inline rename to saved views"
```

---

### Task 4: Load-then-update filter editing

**Files:**
- Modify: `src/components/tasks/TaskFilterBar.tsx`

**Interfaces:**
- Consumes: `updateFilter` from `useTasks()` (Task 2, already destructured in Task 3's Step 1); `savedFilters`, `filters`, `onChange` (existing component props/state).
- Produces: no new exports — completes the saved-view row click handler (`setActiveSavedViewId`) and changes the Save/Update button block.

- [ ] **Step 1: Add `activeSavedViewId` state and a dirty check**

After the `commitRename` function added in Task 3 Step 2, add:

```ts
  const [activeSavedViewId, setActiveSavedViewId] = useState<string | null>(null);
  const activeSavedView = savedFilters.find((v) => v.id === activeSavedViewId) ?? null;
  const isDirtyFromActiveView =
    activeSavedView !== null && JSON.stringify(filters) !== JSON.stringify(normalizeFilters(activeSavedView.filters));
```

- [ ] **Step 2: Ensure the row click sets `activeSavedViewId` and Clear resets it**

Confirm the saved-view row's click handler (from Task 3 Step 3) reads:

```tsx
                        onClick={() => {
                          onChange(normalizeFilters(view.filters));
                          setActiveSavedViewId(view.id);
                          setViewsOpen(false);
                        }}
```

(If Task 3 was applied with the `setActiveSavedViewId` line omitted per its note, add it now.)

In `src/components/tasks/TaskFilterBar.tsx:290` (the "Clear" button), change:

```tsx
            onClick={() => onChange(EMPTY_TASK_FILTERS)}
```

to:

```tsx
            onClick={() => {
              onChange(EMPTY_TASK_FILTERS);
              setActiveSavedViewId(null);
            }}
```

- [ ] **Step 3: Replace the Save/Update button block**

In `src/components/tasks/TaskFilterBar.tsx:248-296` (the `{activeCount > 0 && ( ... )}` block), change the non-`isSaving` branch — currently:

```tsx
          ) : (
            <button
              type="button"
              onClick={() => setIsSaving(true)}
              className="flex items-center gap-1.5 border px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel)" }}
            >
              💾 Save View
            </button>
          )}
```

to:

```tsx
          ) : activeSavedView && isDirtyFromActiveView ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  await updateFilter(activeSavedView.id, activeSavedView.name, filters);
                }}
                className="flex items-center gap-1.5 border px-2 py-1 text-sm font-bold transition-colors"
                style={{ borderColor: "var(--color-primary-gold)", backgroundColor: "var(--color-bg-panel)", color: "var(--color-primary-gold)" }}
              >
                💾 Update &quot;{activeSavedView.name}&quot;
              </button>
              <button
                type="button"
                onClick={() => setIsSaving(true)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Save as new
              </button>
            </div>
          ) : !activeSavedView ? (
            <button
              type="button"
              onClick={() => setIsSaving(true)}
              className="flex items-center gap-1.5 border px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel)" }}
            >
              💾 Save View
            </button>
          ) : null}
```

This preserves the original "Save View" button when no saved view is active, adds "Update"/"Save as new" when an active view has diverged, and shows nothing when an active view is loaded and unchanged.

- [ ] **Step 4: Manual verification**

Run the dev server, save a view, reload the page (or clear filters) so no view is active, then: click the saved view to load it (confirm no Save/Update button appears since nothing changed yet), change a filter (confirm the button becomes `💾 Update "<name>"` plus a `Save as new` link), click Update (confirm a "Saved view updated." toast appears and the button disappears since the view now matches), then repeat and click "Save as new" instead to confirm the original save-name flow still works and creates a second view without touching the first.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/TaskFilterBar.tsx
git commit -m "feat: add load-then-update editing for saved view filters"
```

---

## Self-Review Notes

- **Spec coverage:** Data Model (no change, confirmed) — Server Action (Task 1) — Provider (Task 2) — UI Rename (Task 3) — UI Edit Filters (Task 4) — Error Handling (reuses `notify`, covered in Tasks 2-4) — Testing (Task 1 only, per constraint) — Out of Scope items left untouched. No gaps.
- **Placeholder scan:** no TBD/TODO; all steps contain full code.
- **Type consistency:** `updateFilterAction(id, name, filters)` signature matches across Task 1 (definition), Task 2 (`apiUpdateFilter` call + context type), Tasks 3-4 (`updateFilter(...)` calls). `SavedFilterClient { id, name, filters }` used consistently. `activeSavedViewId`/`activeSavedView`/`isDirtyFromActiveView` names consistent between Task 4's Step 1 declaration and its Steps 2-3 usage, and Task 3's row click handler.
