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
      className="quest-card flex w-full cursor-grab flex-col gap-2 p-3 text-left select-none animate-in fade-in zoom-in-95"
    >
      {/* Optional Top MCP Banner Header (clean & dedicated) */}
      {isAgentTask && (
        <div className="flex items-center justify-between px-2.5 py-1 -mx-3 -mt-3 mb-1 bg-cyan-950/70 border-b border-cyan-500/40 font-mono text-[9px] text-cyan-300">
          <span className="flex items-center gap-1.5 font-bold tracking-wider">
            ⚡ MCP SPAWNED
          </span>
          <span className="text-[8px] opacity-75 font-mono">HERMES</span>
        </div>
      )}

      {/* Primary Top Row: Code + Type + Priority + Status Move */}
      <div className="flex items-center justify-between gap-2 border-b border-border/30 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span aria-hidden className="text-sm shrink-0 leading-none">{TYPE_ICON[task.type]}</span>
          <span className="text-xs font-mono font-bold tracking-tight text-[var(--color-primary-gold)]">
            {task.code}
          </span>
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
              className="border border-border bg-secondary/80 px-1 py-0.5 text-[9px] text-foreground outline-none font-mono cursor-pointer"
              style={{ color: `var(${STATUS_COLOR_VAR[task.status]})` }}
            >
              {KANBAN_COLUMNS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Task Title (Prominent, High-Contrast & Clear) */}
      <h4 className="text-sm font-semibold leading-snug text-foreground line-clamp-3 my-0.5">
        {task.title}
      </h4>

      {/* Bottom meta row: Project pill + Tags + Due Date + Size */}
      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/40 font-mono text-[10px]">
        <div className="flex items-center gap-1.5 min-w-0">
          {task.project && (
            <span className="max-w-[90px] truncate px-1.5 py-0 border border-border bg-secondary/50 text-muted-foreground">
              {task.project}
            </span>
          )}
          {task.tags.slice(0, 1).map((t) => (
            <TagPill key={t} tag={t} />
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {task.size != null && (
            <span className="text-muted-foreground font-bold">
              {task.size.toUpperCase()}
            </span>
          )}
          {task.dueDate && (
            <span style={{ color: overdue ? "var(--color-status-blocked)" : "var(--color-text-muted)" }}>
              {overdue && "⚠ "}{formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Idling / Blocked Status strip */}
      {task.status === "in_progress" && (task.waitingOn || task.waitingReason) && (
        <div className="text-[10px] font-mono text-amber-400 bg-amber-950/40 border border-amber-500/40 px-2 py-1 leading-tight break-words">
          ⏸️ {task.waitingReason || task.waitingOn}
        </div>
      )}
    </div>
  );
}

export const TaskCard = memo(TaskCardComponent);
