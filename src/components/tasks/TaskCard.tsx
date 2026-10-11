"use client";

import { memo } from "react";
import type { DraggableProvided } from "@hello-pangea/dnd";
import { KANBAN_COLUMNS, STATUS_COLOR_VAR, STATUS_LABEL, STATUS_SHAPE, TYPE_ICON, MOCK_NOW } from "@/lib/mock-data";
import { formatDueDate, isOverdue } from "@/lib/task-utils";
import type { Task, TaskStatus } from "@/types/task";
import { PriorityMark } from "./PriorityMark";
import { TagPill } from "./TagPill";

function TaskCardComponent({
  task,
  onSelect,
  onMoveStatus,
  dragHandleRef,
  draggableProps,
  dragHandleProps,
  isDragging = false,
}: {
  task: Task;
  onSelect: (task: Task) => void;
  /** Keyboard-operable alternative to Kanban drag-and-drop — moving columns shouldn't require a mouse. */
  onMoveStatus?: (task: Task, status: TaskStatus) => void;
  dragHandleRef?: DraggableProvided["innerRef"];
  draggableProps?: DraggableProvided["draggableProps"];
  dragHandleProps?: DraggableProvided["dragHandleProps"];
  isDragging?: boolean;
}) {
  const overdue = isOverdue(task.dueDate, MOCK_NOW) && task.status !== "done";
  const dragging = isDragging;
  const isAgentTask =
    task.reporter === "agent" ||
    (task as any)?.metadata?.agentReporter === "agent" ||
    !!(task as any)?.metadata?.createdByAgent ||
    !!(task as any)?.waitingReason;

  return (
    // Not a <button> — a nested keyboard-operable status <select> requires div[role=button]
    // (button > select is invalid HTML). Enter on the card body still opens the editor;
    // Space/arrows are reserved by @hello-pangea/dnd's keyboard drag sensor (dragHandleProps).
    <div
      role="button"
      tabIndex={0}
      ref={dragHandleRef}
      {...draggableProps}
      {...dragHandleProps}
      onClick={() => onSelect(task)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onSelect(task);
        }
      }}
      style={{
        borderColor: dragging
          ? "var(--color-primary-gold)"
          : isAgentTask
            ? "rgba(16, 224, 224, 0.6)"
            : `var(${STATUS_COLOR_VAR[task.status]})`,
        backgroundColor: dragging
          ? "var(--color-bg-panel)"
          : isAgentTask
            ? "rgba(16, 224, 224, 0.04)"
            : "var(--color-bg-panel-alt)",
        opacity: dragging ? 0.75 : 1,
        boxShadow: isAgentTask ? "0 0 10px rgba(16, 224, 224, 0.15), 3px 3px 0 0 rgba(0,0,0,0.8)" : undefined,
        ...draggableProps?.style,
      }}
      className="quest-card flex w-full cursor-grab flex-col gap-1.5 p-2.5 text-left select-none animate-in fade-in zoom-in-95"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span aria-hidden className="text-sm shrink-0 leading-none">{TYPE_ICON[task.type]}</span>
          <span className="text-xs font-mono font-bold tracking-tight text-[var(--color-primary-gold)] truncate">{task.code}</span>
          {isAgentTask && (
            <span
              className="px-1 py-0 text-[9px] font-mono font-bold border border-cyan-500/40 bg-cyan-950/40 text-cyan-300"
              title="Spawned by Hermes Agent"
            >
              🤖 AI
            </span>
          )}
          {task.project && (
            <span className="hidden sm:inline-block max-w-[90px] truncate text-[9px] font-mono text-muted-foreground border border-border px-1 py-0 bg-secondary/40">
              {task.project}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <PriorityMark priority={task.priority} />
          {onMoveStatus && (
            <select
              aria-label={`Move "${task.title}" to a different status`}
              value={task.status}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => onMoveStatus(task, e.target.value as TaskStatus)}
              className="border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-foreground outline-none focus-visible:ring-1 focus-visible:ring-primary font-mono transition-colors cursor-pointer"
              style={{ color: `var(${STATUS_COLOR_VAR[task.status]})` }}
            >
              {KANBAN_COLUMNS.map((s) => (
                <option key={s} value={s}>{STATUS_SHAPE[s]} {STATUS_LABEL[s]}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      <p className="line-clamp-2 text-xs font-bold leading-tight text-foreground">{task.title}</p>
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40 font-mono">
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 2).map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </div>
        {task.dueDate && (
          <span className="shrink-0 text-[10px] font-mono font-bold" style={{ color: overdue ? "var(--color-status-blocked)" : "var(--color-text-muted)" }}>
            {overdue && "⚠ "}{formatDueDate(task.dueDate)}
          </span>
        )}
      </div>
      {task.size != null && (
        <div className="text-[9px] font-mono text-muted-foreground">
          SIZE: {task.size.toUpperCase()}
        </div>
      )}
      {task.status === "in_progress" && (task.waitingOn || task.waitingReason) && (
        <div className="text-[10px] font-mono text-amber-400 bg-amber-950/30 border border-amber-500/30 px-1 py-0.5 truncate">
          ⏸️ {task.waitingReason || task.waitingOn}
        </div>
      )}
    </div>
  );
}

export const TaskCard = memo(TaskCardComponent);
