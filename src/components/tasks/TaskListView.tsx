"use client";

import { memo } from "react";
import { useTasks } from "@/components/providers/TasksProvider";
import type { Task } from "@/types/task";
import { TaskCard } from "./TaskCard";
import { TaskRow } from "./TaskRow";
import { PriorityMark } from "./PriorityMark";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { VirtualList } from "@/components/ui/VirtualList";

/** Generic task list, reused across Dashboard/Today/Waiting/Focus/List views. */
function TaskListViewComponent({
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
    if (variant === "compact") {
      return <EmptyState message={empty ?? "No quests"} variant="compact" />;
    }
    return <EmptyState message={empty ?? "No quests"} icon="📭" />;
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
            <span className="text-xs font-mono font-bold" style={{ color: "var(--color-primary-gold)", minWidth: "50px" }}>{task.code}</span>
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

  if (variant === "card" && tasks.length > 50) {
    return (
      <VirtualList
        items={tasks}
        itemHeight={140}
        containerHeight={600}
        renderItem={(task) => (
          <div className="px-2">
            <TaskCard task={task} onSelect={openEditForm} />
          </div>
        )}
        overscan={3}
        className="flex-1"
      />
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

export const TaskListView = memo(TaskListViewComponent);
