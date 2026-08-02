import type { Priority, Task, TaskStatus, TaskType } from "@/types/task";

const PRIORITY_ORDER: Priority[] = ["p0", "p1", "p2", "p3", "p4"];

export type StatusOp = "is" | "is_not";
export type PriorityOp = "any" | "gte" | "lte";
export type CombineMode = "AND" | "OR";

/**
 * Combinable task query, per docs/01-product.md §9.3 (`Project = ATS AND Priority >= P2
 * AND Status != Done AND Tag = Backend`) — OR within a facet's own selection (e.g.
 * status=Blocked OR Waiting), comparator operators on Status (is/is not) and Priority
 * (any of / at least as urgent / at most as urgent), and a global AND/OR toggle
 * (`combineMode`) for how the active facets combine with each other. Shared by every
 * task view (Kanban/List/Table/Calendar/Timeline/By Project/Archive) on the Tasks page.
 */
export interface TaskFilters {
  statuses: TaskStatus[];
  statusOp: StatusOp;
  priorities: Priority[];
  priorityOp: PriorityOp;
  projects: string[];
  types: TaskType[];
  tags: string[];
  query: string;
  combineMode: CombineMode;
}

export const EMPTY_TASK_FILTERS: TaskFilters = {
  statuses: [],
  statusOp: "is",
  priorities: [],
  priorityOp: "any",
  projects: [],
  types: [],
  tags: [],
  query: "",
  combineMode: "AND",
};

/**
 * Saved views persisted before `statusOp`/`priorityOp`/`tags`/`combineMode` existed are
 * missing those keys in their stored JSON — fill in the old defaults (any/is/AND, no tag
 * filter) rather than crashing or misreading an old multi-select as a new comparator.
 */
export function normalizeFilters(filters: TaskFilters): TaskFilters {
  return { ...EMPTY_TASK_FILTERS, ...filters };
}

export function countActiveFilters(rawFilters: TaskFilters): number {
  const filters = normalizeFilters(rawFilters);
  return (
    filters.statuses.length +
    filters.priorities.length +
    filters.projects.length +
    filters.types.length +
    filters.tags.length +
    (filters.query.trim() ? 1 : 0)
  );
}

/**
 * Universal search — docs/01-product.md §9.3: matches task title/tags, the task's
 * project name, and attachment labels/URLs, not just the title.
 */
function matchesQuery(t: Task, q: string): boolean {
  if (t.title.toLowerCase().includes(q)) return true;
  if (t.tags.some((tag) => tag.includes(q))) return true;
  if (t.project.toLowerCase().includes(q)) return true;
  if (t.attachments.some((a) => a.label.toLowerCase().includes(q) || a.url.toLowerCase().includes(q))) return true;
  return false;
}

function matchesStatus(t: Task, filters: TaskFilters): boolean {
  const inSet = filters.statuses.includes(t.status);
  return filters.statusOp === "is_not" ? !inSet : inSet;
}

function matchesPriority(t: Task, filters: TaskFilters): boolean {
  if (filters.priorityOp === "any") return filters.priorities.includes(t.priority);
  // gte/lte compare against the first selected priority as the threshold — P0 is most
  // urgent (index 0), so "at least as urgent as P2" means index <= index(P2).
  const threshold = PRIORITY_ORDER.indexOf(filters.priorities[0]);
  const taskIndex = PRIORITY_ORDER.indexOf(t.priority);
  return filters.priorityOp === "gte" ? taskIndex <= threshold : taskIndex >= threshold;
}

export function applyTaskFilters(tasks: Task[], rawFilters: TaskFilters): Task[] {
  const filters = normalizeFilters(rawFilters);
  const q = filters.query.trim().toLowerCase();

  const activeConditions: Array<(t: Task) => boolean> = [];
  if (filters.statuses.length) activeConditions.push((t) => matchesStatus(t, filters));
  if (filters.priorities.length) activeConditions.push((t) => matchesPriority(t, filters));
  if (filters.projects.length) activeConditions.push((t) => filters.projects.includes(t.project));
  if (filters.types.length) activeConditions.push((t) => filters.types.includes(t.type));
  if (filters.tags.length) activeConditions.push((t) => filters.tags.some((tag) => t.tags.includes(tag)));
  if (q) activeConditions.push((t) => matchesQuery(t, q));

  if (activeConditions.length === 0) return tasks;

  return tasks.filter((t) =>
    filters.combineMode === "OR"
      ? activeConditions.some((cond) => cond(t))
      : activeConditions.every((cond) => cond(t))
  );
}
