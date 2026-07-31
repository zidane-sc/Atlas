# Drawer Search Fields Default Results — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a quest-form drawer search field (Project, Sprint, relations "Search quest") is focused with an empty query, show a default list of up to 5 options instead of nothing.

**Architecture:** Add pure sort helpers in a new `src/lib/picker-sort.ts` (unit-tested with vitest), then wire focus-state + default-list rendering into the three existing search dropdowns in `src/components/tasks/TaskFormSheet.tsx`. All data is already client-side; no server changes.

**Tech Stack:** Next.js App Router, React 19 (client component), TypeScript, vitest (node env, `@/` alias to `src/`).

## Global Constraints

- Only file to change in the component: `src/components/tasks/TaskFormSheet.tsx`.
- Ordering for empty query:
  - Projects: status rank active=0, on_hold=1, completed=2, then name ascending.
  - Sprints: status rank active=0, planning=1, completed=2, then start date ascending.
  - Tasks (relations): incomplete first (status !== "done"), then title ascending.
- Empty query → limit 5 via `.slice(0, 5)`. With a query, existing substring filter is unchanged and unlimited (relations already limits to 5).
- Dropdown shows on focus; hides on blur. Selecting an item clears the query and hides the list.
- No data-model, server, or dependency changes.
- No comments in code.

---

### Task 1: Add sort helpers with unit tests

**Files:**
- Create: `src/lib/picker-sort.ts`
- Test: `src/lib/picker-sort.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 2–4):
  - `export function sortProjectsForPicker(projects: Project[]): Project[]` — returns a new array sorted by status rank then name ascending.
  - `export function sortSprintsForPicker(sprints: Sprint[]): Sprint[]` — returns a new array sorted by status rank then start date ascending.
  - `export function sortTasksForPicker(tasks: Task[]): Task[]` — returns a new array sorted incomplete-first then title ascending.
- `Project`, `Sprint` from `@/types/gamification`; `Task` from `@/types/task`. These imports already exist elsewhere in the codebase; do not modify the types.

- [ ] **Step 1: Write the failing test**

Create `src/lib/picker-sort.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sortProjectsForPicker, sortSprintsForPicker, sortTasksForPicker } from "@/lib/picker-sort";
import type { Project, Sprint } from "@/types/gamification";
import type { Task } from "@/types/task";

const project = (name: string, status: Project["status"]): Project => ({
  id: name,
  name,
  colorVar: "var(--color-primary)",
  emoji: "★",
  category: "work",
  description: "",
  status,
});

const sprint = (name: string, startDate: string, status: Sprint["status"]): Sprint => ({
  id: name,
  name,
  startDate,
  endDate: "2026-12-31",
  status,
  goal: "",
});

const task = (title: string, status: Task["status"]): Task => ({
  id: title,
  title,
  project: "P",
  status,
  type: "coding",
  priority: "p2",
  pinned: false,
  tags: [],
  relations: [],
  attachments: [],
  deliverables: [],
  statusHistory: [],
});

describe("sortProjectsForPicker", () => {
  it("sorts by status rank then name", () => {
    const input = [
      project("Beta", "on_hold"),
      project("Gamma", "completed"),
      project("Alpha", "active"),
    ];
    expect(sortProjectsForPicker(input).map((p) => p.name)).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  it("does not mutate the input array", () => {
    const input = [project("Beta", "on_hold"), project("Alpha", "active")];
    sortProjectsForPicker(input);
    expect(input.map((p) => p.name)).toEqual(["Beta", "Alpha"]);
  });
});

describe("sortSprintsForPicker", () => {
  it("sorts by status rank then start date", () => {
    const input = [
      sprint("Sprint 3", "2026-03-01", "planning"),
      sprint("Sprint 1", "2026-01-01", "active"),
      sprint("Sprint 2", "2026-02-01", "active"),
      sprint("Sprint 4", "2026-04-01", "completed"),
    ];
    expect(sortSprintsForPicker(input).map((s) => s.name)).toEqual(["Sprint 1", "Sprint 2", "Sprint 3", "Sprint 4"]);
  });
});

describe("sortTasksForPicker", () => {
  it("sorts incomplete first then title", () => {
    const input = [
      task("Zeta", "done"),
      task("Alpha", "inbox"),
      task("Milo", "done"),
      task("Beta", "in_progress"),
    ];
    expect(sortTasksForPicker(input).map((t) => t.title)).toEqual(["Alpha", "Beta", "Milo", "Zeta"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/picker-sort.test.ts`
Expected: FAIL — module `@/lib/picker-sort` not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/picker-sort.ts`:

```ts
import type { Project, Sprint } from "@/types/gamification";
import type { Task } from "@/types/task";

const PROJECT_STATUS_RANK: Record<string, number> = { active: 0, on_hold: 1, completed: 2 };
const SPRINT_STATUS_RANK: Record<string, number> = { active: 0, planning: 1, completed: 2 };

export function sortProjectsForPicker(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) =>
      (PROJECT_STATUS_RANK[a.status] ?? 9) - (PROJECT_STATUS_RANK[b.status] ?? 9) ||
      a.name.localeCompare(b.name)
  );
}

export function sortSprintsForPicker(sprints: Sprint[]): Sprint[] {
  return [...sprints].sort(
    (a, b) =>
      (SPRINT_STATUS_RANK[a.status] ?? 9) - (SPRINT_STATUS_RANK[b.status] ?? 9) ||
      a.startDate.localeCompare(b.startDate)
  );
}

export function sortTasksForPicker(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) ||
      a.title.localeCompare(b.title)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/picker-sort.test.ts`
Expected: PASS (3 test suites, 4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/picker-sort.ts src/lib/picker-sort.test.ts
git commit -m "feat: add picker sort helpers for drawer search defaults"
```

---

### Task 2: Wire Project search field default list

**Files:**
- Modify: `src/components/tasks/TaskFormSheet.tsx`
- Imports (top of file, after line 38 `import { useSprints } from "@/components/providers/SprintsProvider";`): add `import { sortProjectsForPicker } from "@/lib/picker-sort";`

**Interfaces:**
- Consumes: `sortProjectsForPicker` from Task 1.

- [ ] **Step 1: Add focus state and input ref**

Update the React import (line 3) to include `useRef`:

```ts
import { useEffect, useState, useMemo, useRef } from "react";
```

In `TaskFormBody`, near the other `useState` calls (after line 142 `const [projectSearch, setProjectSearch] = useState("");`), add:

```ts
const [projectFocused, setProjectFocused] = useState(false);
const projectInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 2: Add onBlur to the Project input**

In the Project `<input>` (lines 397–413), add `ref={projectInputRef}`, keep the existing `setProjectSearch(""); e.target.select();` inside `onFocus` and add `setProjectFocused(true);`. Then add an `onBlur` handler. The input becomes:

```tsx
<input
  ref={projectInputRef}
  aria-label="Project"
  className={FIELD}
  placeholder="Search project..."
  value={projectSearch || (form.project ? `${projects.find(p => p.name === form.project)?.emoji} ${form.project}` : "")}
  onChange={(e) => {
    const val = e.target.value;
    setProjectSearch(val);
    if (!projects.some(p => `${p.emoji} ${p.name}` === val)) {
      set("project", "");
    }
  }}
  onFocus={(e) => {
    setProjectSearch("");
    e.target.select();
    setProjectFocused(true);
  }}
  onBlur={() => setProjectFocused(false)}
/>
```

- [ ] **Step 3: Render default list when focused with empty query**

Replace the dropdown block (lines 414–422). Change the render condition from `projectSearch &&` to `projectFocused &&`, choose items: filtered list when a query exists, otherwise `sortProjectsForPicker(projects).slice(0, 5)`, and blur the input on selection so the list hides:

```tsx
{projectFocused && (
  <ul className="border border-border max-h-20 overflow-y-auto bg-secondary text-xs absolute top-full left-0 right-0 z-10">
    {(projectSearch
      ? projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
      : sortProjectsForPicker(projects).slice(0, 5)
    ).map((p) => (
      <li key={p.id} className="px-2 py-1 cursor-pointer hover:bg-primary/10 border-b border-border last:border-b-0" onClick={() => { set("project", p.name); setProjectSearch(""); projectInputRef.current?.blur(); }}>
        {p.emoji} {p.name}
      </li>
    ))}
  </ul>
)}
```

Blurring the input on selection triggers `onBlur` → `setProjectFocused(false)`, hiding the list and matching the existing behavior of hiding the dropdown after picking.

- [ ] **Step 4: Verify**

Run: `npx vitest run` — all tests pass. Run: `npm run lint` — no new errors. Manually: open the quest form drawer (dev server), focus Project → shows up to 5 default options ordered active-first then name; type → filters; blur → hides.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/TaskFormSheet.tsx
git commit -m "feat: show default project options on drawer search focus"
```

---

### Task 3: Wire Sprint search field default list

**Files:**
- Modify: `src/components/tasks/TaskFormSheet.tsx`
- Imports: add `import { sortSprintsForPicker } from "@/lib/picker-sort";` alongside the Task 2 import.

**Interfaces:**
- Consumes: `sortSprintsForPicker` from Task 1.

- [ ] **Step 1: Add focus state and input ref**

After line 143 (`const [sprintSearch, setSprintSearch] = useState("");`), add:

```ts
const [sprintFocused, setSprintFocused] = useState(false);
const sprintInputRef = useRef<HTMLInputElement>(null);
```

(`useRef` is already imported from Task 2.)

- [ ] **Step 2: Add onFocus/onBlur to the Sprint input**

Modify the Sprint `<input>` (lines 438–454) to add `ref={sprintInputRef}`, keep the existing `setSprintSearch(""); e.target.select();` inside `onFocus` and add `setSprintFocused(true);`, and add `onBlur`:

```tsx
<input
  ref={sprintInputRef}
  aria-label="Sprint"
  className={FIELD}
  placeholder="Search sprint..."
  value={sprintSearch || form.sprint || ""}
  onChange={(e) => {
    const val = e.target.value;
    setSprintSearch(val);
    if (!sprints.some(s => s.name === val)) {
      set("sprint", undefined);
    }
  }}
  onFocus={(e) => {
    setSprintSearch("");
    e.target.select();
    setSprintFocused(true);
  }}
  onBlur={() => setSprintFocused(false)}
/>
```

- [ ] **Step 3: Render default list when focused with empty query**

Replace the dropdown block (lines 455–463). Change condition from `sprintSearch &&` to `sprintFocused &&`, items: filtered when query exists, otherwise `sortSprintsForPicker(sprints).slice(0, 5)`, and blur the input on selection:

```tsx
{sprintFocused && (
  <ul className="border border-border max-h-20 overflow-y-auto bg-secondary text-xs absolute top-full left-0 right-0 z-10">
    {(sprintSearch
      ? sprints.filter(s => s.name.toLowerCase().includes(sprintSearch.toLowerCase()))
      : sortSprintsForPicker(sprints).slice(0, 5)
    ).map((s) => (
      <li key={s.id} className="px-2 py-1 cursor-pointer hover:bg-primary/10 border-b border-border last:border-b-0" onClick={() => { set("sprint", s.name); setSprintSearch(""); sprintInputRef.current?.blur(); }}>
        {s.name}
      </li>
    ))}
  </ul>
)}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run` — all tests pass. Run: `npm run lint` — no new errors. Manually: focus Sprint → up to 5 default options (active first, then start date); type → filters; blur → hides.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/TaskFormSheet.tsx
git commit -m "feat: show default sprint options on drawer search focus"
```

---

### Task 4: Wire relations "Search quest" (task) field default list

**Files:**
- Modify: `src/components/tasks/TaskFormSheet.tsx`
- Imports: add `import { sortTasksForPicker } from "@/lib/picker-sort";` alongside the Task 2/3 imports.

**Interfaces:**
- Consumes: `sortTasksForPicker` from Task 1.

- [ ] **Step 1: Add focus state and input ref**

After line 141 (`const [relationSearch, setRelationSearch] = useState("");`), add:

```ts
const [relationFocused, setRelationFocused] = useState(false);
const relationInputRef = useRef<HTMLInputElement>(null);
```

(`useRef` is already imported from Task 2.)

- [ ] **Step 2: Add onFocus/onBlur to the Search quest input**

Modify the "Search quest" `<input>` (lines 543–555) to add `ref={relationInputRef}` and focus handlers:

```tsx
<input
  ref={relationInputRef}
  aria-label="Search quest"
  className={FIELD}
  placeholder="Search quest..."
  value={relationSearch}
  onChange={(e) => setRelationSearch(e.target.value)}
  onFocus={() => setRelationFocused(true)}
  onBlur={() => setRelationFocused(false)}
  onKeyDown={(e) => {
    if (e.key === "Enter" && relationTargetId) {
      e.preventDefault();
      addRelation();
    }
  }}
/>
```

- [ ] **Step 3: Render default list when focused with empty query**

Replace the dropdown block (lines 557–565). Change condition from `relationSearch &&` to `relationFocused &&`, items: filtered when query exists, otherwise `sortTasksForPicker(otherTasks)`, keep `.slice(0, 5)` for both branches, and blur the input on selection:

```tsx
{relationFocused && (
  <ul className="border border-border max-h-20 overflow-y-auto bg-secondary text-xs">
    {(relationSearch
      ? otherTasks.filter(t => t.title.toLowerCase().includes(relationSearch.toLowerCase()))
      : sortTasksForPicker(otherTasks)
    ).slice(0, 5).map((t) => (
      <li key={t.id} className="px-2 py-1 cursor-pointer hover:bg-primary/10 border-b border-border last:border-b-0" onClick={() => { setRelationTargetId(t.id); setRelationSearch(""); relationInputRef.current?.blur(); }}>
        {t.title}
      </li>
    ))}
  </ul>
)}
```

- [ ] **Step 4: Verify**

Run: `npx vitest run` — all tests pass. Run: `npm run lint` — no new errors. Manually: focus Search quest → up to 5 incomplete-first, title-sorted options; type → filters; blur → hides.

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/TaskFormSheet.tsx
git commit -m "feat: show default task options on drawer relation search focus"
```
