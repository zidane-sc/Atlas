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
