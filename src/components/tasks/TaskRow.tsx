import { MOCK_NOW, TYPE_ICON } from "@/lib/mock-data";
import { isDueToday, isOverdue, formatDueDate } from "@/lib/task-utils";
import type { Task } from "@/types/task";
import { PriorityMark } from "./PriorityMark";
import { StatusBadge } from "./StatusBadge";

/** Compact horizontal row for List/Table-style views — docs/03-design.md §10 (dense, not card-grid). */
export function TaskRow({ task, onSelect }: { task: Task; onSelect: (task: Task) => void }) {
  const overdue = isOverdue(task.dueDate, MOCK_NOW) && task.status !== "done";
  const today = isDueToday(task.dueDate, MOCK_NOW);
  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      className="flex w-full items-center gap-3 border-b border-border px-4 py-2 text-left transition-colors hover:bg-secondary"
    >
      <PriorityMark priority={task.priority} withLabel />
      <StatusBadge status={task.status} />
      <span className="text-xs font-mono font-bold" style={{ color: "var(--color-primary-gold)", minWidth: "60px" }}>{task.code}</span>
      <span className="flex-1 truncate text-sm text-foreground">{task.title}</span>
      <span className="mr-1 text-sm" aria-hidden>{TYPE_ICON[task.type]}</span>
      <span className="hidden max-w-[100px] truncate text-sm text-muted-foreground md:block">{task.project}</span>
      <span
        className="text-sm whitespace-nowrap"
        style={{ color: overdue ? "var(--color-status-blocked)" : today ? "var(--color-primary-gold)" : "var(--color-text-muted)" }}
      >
        {overdue && "⚠ "}
        {formatDueDate(task.dueDate)}
      </span>
    </button>
  );
}
