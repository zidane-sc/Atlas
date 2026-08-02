"use client";

import { useState } from "react";
import { useTasks } from "@/components/providers/TasksProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { KANBAN_COLUMNS, STATUS_COLOR_VAR, STATUS_LABEL, STATUS_SHAPE } from "@/lib/mock-data";
import type { Task, TaskStatus } from "@/types/task";
import { TaskCard } from "./TaskCard";
import { EmptyState } from "@/components/ui/EmptyState";

export function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const { openEditForm, updateTask } = useTasks();
  const { notify } = useNotifications();
  const [dragOverStatus, setDragOverStatus] = useState<TaskStatus | null>(null);

  const moveTask = async (task: Task, status: TaskStatus) => {
    if (task.status === status) return;
    const success = await updateTask(task.id, {
      title: task.title,
      description: task.description,
      project: task.project,
      status,
      type: task.type,
      priority: task.priority,
      effort: task.effort,
      storyPoint: task.storyPoint,
      dueDate: task.dueDate,
      waitingOn: task.waitingOn,
      sprint: task.sprint,
      reporter: task.reporter,
      tags: task.tags,
      relations: task.relations,
      attachments: task.attachments,
      deliverables: task.deliverables,
    });
    if (success) {
      notify(`${STATUS_LABEL[status]}: "${task.title}"`, "success");
    }
  };

  const onDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    setDragOverStatus(null);
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === taskId);
    if (task) moveTask(task, status);
  };

  return (
    <div className="h-full overflow-x-auto">
      <div className="flex h-full min-w-max gap-3 p-4">
        {KANBAN_COLUMNS.map((status) => {
          const columnTasks = tasks.filter((t) => t.status === status);
          const colorVar = STATUS_COLOR_VAR[status];
          const isDragOver = dragOverStatus === status;
          return (
            <div key={status} className="flex w-60 shrink-0 flex-col">
              <div className="mb-3 flex items-center gap-2 border-b-2 pb-2" style={{ borderColor: `var(${colorVar})` }}>
                <span style={{ color: `var(${colorVar})` }}>{STATUS_SHAPE[status]}</span>
                <span className="text-sm tracking-widest" style={{ color: `var(${colorVar})` }}>{STATUS_LABEL[status].toUpperCase()}</span>
                <span className="text-sm text-muted-foreground">({columnTasks.length})</span>
              </div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverStatus(status);
                }}
                onDragLeave={() => setDragOverStatus((s) => (s === status ? null : s))}
                onDrop={(e) => onDrop(e, status)}
                className="flex-1 space-y-2 overflow-y-auto border-2 p-1"
                style={{ borderColor: isDragOver ? "var(--color-primary-gold)" : "transparent" }}
              >
                {columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onSelect={openEditForm} onMoveStatus={moveTask} />
                ))}
                {columnTasks.length === 0 && (
                  <EmptyState icon="─" message={STATUS_LABEL[status]} variant="dashed" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
