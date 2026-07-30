import type { Priority, Task, TaskStatus, TaskType } from "@/types/task";

/**
 * Combinable task query — OR within a facet (e.g. status=Blocked OR Waiting), AND across
 * facets (status AND priority AND project AND type AND text) — shared by every task view
 * (Kanban/List/Table/Calendar/Timeline/By Project/Archive) on the Tasks page.
 */
export interface TaskFilters {
  statuses: TaskStatus[];
  priorities: Priority[];
  projects: string[];
  types: TaskType[];
  query: string;
}

export const EMPTY_TASK_FILTERS: TaskFilters = {
  statuses: [],
  priorities: [],
  projects: [],
  types: [],
  query: "",
};

export function countActiveFilters(filters: TaskFilters): number {
  return (
    filters.statuses.length +
    filters.priorities.length +
    filters.projects.length +
    filters.types.length +
    (filters.query.trim() ? 1 : 0)
  );
}

export function applyTaskFilters(tasks: Task[], filters: TaskFilters): Task[] {
  const q = filters.query.trim().toLowerCase();
  return tasks.filter((t) => {
    if (filters.statuses.length && !filters.statuses.includes(t.status)) return false;
    if (filters.priorities.length && !filters.priorities.includes(t.priority)) return false;
    if (filters.projects.length && !filters.projects.includes(t.project)) return false;
    if (filters.types.length && !filters.types.includes(t.type)) return false;
    if (q && !t.title.toLowerCase().includes(q) && !t.tags.some((tag) => tag.includes(q))) return false;
    return true;
  });
}
