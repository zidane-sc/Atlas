"use client";

import { useState } from "react";
import { KANBAN_COLUMNS, STATUS_COLOR_VAR, STATUS_LABEL, STATUS_SHAPE, TYPE_ICON, MOCK_NOW } from "@/lib/mock-data";
import { formatDueDate, isOverdue } from "@/lib/task-utils";
import type { Task, TaskStatus } from "@/types/task";
import { PriorityMark } from "./PriorityMark";
import { TagPill } from "./TagPill";

export function TaskCard({
  task,
  onSelect,
  onMoveStatus,
}: {
  task: Task;
  onSelect: (task: Task) => void;
  /** Keyboard-operable alternative to Kanban drag-and-drop — moving columns shouldn't require a mouse. */
  onMoveStatus?: (task: Task, status: TaskStatus) => void;
}) {
  const overdue = isOverdue(task.dueDate, MOCK_NOW) && task.status !== "done";
  const [dragging, setDragging] = useState(false);

  return (
    // Not a <button> — a nested keyboard-operable status <select> requires div[role=button]
    // (button > select is invalid HTML). Enter/Space on the card body still opens the editor.
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      onClick={() => onSelect(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(task);
        }
      }}
      style={{ borderColor: `var(${STATUS_COLOR_VAR[task.status]})`, backgroundColor: "var(--color-bg-panel-alt)", opacity: dragging ? 0.4 : 1 }}
      className="pixel-panel flex w-full cursor-pointer flex-col gap-2 border-2 p-3 text-left transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span aria-hidden className="text-base leading-none">{TYPE_ICON[task.type]}</span>
        <div className="flex items-center gap-1.5">
          <PriorityMark priority={task.priority} />
          {onMoveStatus && (
            <select
              aria-label={`Move "${task.title}" to a different status`}
              value={task.status}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => onMoveStatus(task, e.target.value as TaskStatus)}
              className="border-2 border-border bg-secondary px-2 py-1 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary font-medium transition-colors cursor-pointer hover:bg-secondary/80"
              style={{ color: `var(${STATUS_COLOR_VAR[task.status]})` }}
            >
              {KANBAN_COLUMNS.map((s) => (
                <option key={s} value={s}>{STATUS_SHAPE[s]} {STATUS_LABEL[s]}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      <p className="line-clamp-2 text-sm leading-tight text-foreground">{task.title}</p>
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 2).map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </div>
        {task.dueDate && (
          <span className="shrink-0 text-sm" style={{ color: overdue ? "var(--color-status-blocked)" : "var(--color-text-muted)" }}>
            {overdue && "⚠ "}{formatDueDate(task.dueDate)}
          </span>
        )}
      </div>
      {task.storyPoint != null && task.storyPoint > 0 && (
        <div className="text-sm text-muted-foreground">
          {task.storyPoint} SP{task.effort ? ` · ${task.effort.toUpperCase()}` : ""}
        </div>
      )}
      {task.status === "waiting_external" && task.waitingOn && (
        <div className="text-sm" style={{ color: "var(--color-status-waiting-external)" }}>⏸ {task.waitingOn}</div>
      )}
      {task.status === "blocked" && task.waitingOn && (
        <div className="text-sm" style={{ color: "var(--color-status-blocked)" }}>✕ {task.waitingOn}</div>
      )}
    </div>
  );
}
