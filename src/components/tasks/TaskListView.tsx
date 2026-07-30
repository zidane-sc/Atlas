"use client";

import { useTasks } from "@/components/providers/TasksProvider";
import type { Task } from "@/types/task";
import { TaskCard } from "./TaskCard";
import { TaskRow } from "./TaskRow";
import { PriorityMark } from "./PriorityMark";
import { StatusBadge } from "./StatusBadge";

/** Generic task list, reused across Dashboard/Today/Waiting/Focus/List views. */
export function TaskListView({
  tasks,
  empty,
  variant = "card",
  showStatus = true,
}: {
  tasks: Task[];
  empty?: string;
  variant?: "card" | "row" | "compact";
  showStatus?: boolean;
}) {
  const { openEditForm } = useTasks();

  if (tasks.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{empty ?? "Nothing here."}</p>;
  }

  if (variant === "compact") {
    return (
      <div>
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => openEditForm(task)}
            className="flex cursor-pointer items-center gap-2 border-b border-border px-1 py-1.5 hover:bg-[var(--color-bg-panel-alt)]"
          >
            <PriorityMark priority={task.priority} />
            {showStatus && <StatusBadge status={task.status} />}
            <span className="flex-1 truncate text-sm">{task.title}</span>
            {!showStatus && task.waitingOn && (
              <span className="max-w-[80px] truncate text-sm" style={{ color: "var(--color-status-waiting-external)" }}>
                {task.waitingOn}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={variant === "card" ? "flex flex-col gap-2" : "flex flex-col border-2 border-border"}>
      {tasks.map((task) =>
        variant === "card" ? (
          <TaskCard key={task.id} task={task} onSelect={openEditForm} />
        ) : (
          <TaskRow key={task.id} task={task} onSelect={openEditForm} />
        )
      )}
    </div>
  );
}
