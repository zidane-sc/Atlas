"use client";

import { PriorityMark } from "@/components/tasks/PriorityMark";
import { TYPE_ICON } from "@/lib/mock-data";
import { formatDueDate, isOverdue } from "@/lib/task-utils";
import { MOCK_NOW } from "@/lib/mock-data";
import { Pin } from "lucide-react";
import type { Task } from "@/types/task";

export function SmartViewTaskCard({ task, onSelect }: { task: Task; onSelect: (task: Task) => void }) {
  const isOverdueTask = isOverdue(task.dueDate, MOCK_NOW) && task.status !== "done";
  const daysOverdue = task.dueDate ? Math.floor((new Date(MOCK_NOW).getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div
      onClick={() => onSelect(task)}
      className="group relative cursor-pointer border-2 p-2.5 transition-all hover:bg-primary/10 active:scale-[0.99] hover:shadow-[3px_3px_0_rgba(0,0,0,0.6)] flex flex-col justify-between"
      style={{
        borderColor: task.pinned ? "var(--color-primary-gold)" : isOverdueTask ? "var(--color-status-blocked)" : "var(--color-border)",
        backgroundColor: task.pinned ? "rgba(255,217,61,0.05)" : isOverdueTask ? "rgba(255,0,0,0.05)" : "var(--color-bg-panel)",
      }}
    >
      <div>
        {/* Top bar: Type + Code + Project + Pin + Priority */}
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm shrink-0" aria-hidden>{TYPE_ICON[task.type]}</span>
            <span className="font-mono text-xs font-bold text-[var(--color-primary-gold)] truncate">{task.code}</span>
            {task.project && (
              <span className="hidden sm:inline-block max-w-[110px] truncate text-xs text-muted-foreground border border-border px-1 py-0 bg-secondary/30">
                {task.project}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {task.pinned && <Pin size={13} style={{ color: "var(--color-primary-gold)", fill: "var(--color-primary-gold)" }} />}
            <PriorityMark priority={task.priority} />
          </div>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {task.title}
        </h3>
      </div>

      {/* Meta bottom bar */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs pt-1.5 border-t border-border/40 font-mono">
        <span
          className="px-1.5 py-0.5 border font-bold"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-bg-panel-alt)",
          }}
        >
          {task.status.toUpperCase()}
        </span>

        {task.dueDate && (
          <span
            className="px-1.5 py-0.5 border"
            style={{
              borderColor: isOverdueTask ? "var(--color-status-blocked)" : "var(--color-border)",
              backgroundColor: isOverdueTask ? "var(--color-status-blocked)" : "transparent",
              color: isOverdueTask ? "#fff" : "var(--color-text-muted)",
            }}
          >
            {isOverdueTask ? `⚠ ${daysOverdue}d` : formatDueDate(task.dueDate)}
          </span>
        )}

        {task.size && (
          <span className="px-1.5 py-0.5 border border-border text-muted-foreground">
            {task.size.toUpperCase()}
          </span>
        )}

        {task.tags && task.tags.length > 0 && (
          <span className="text-primary truncate max-w-[80px]">
            #{task.tags[0]}
            {task.tags.length > 1 && ` +${task.tags.length - 1}`}
          </span>
        )}

        {(task.timeSpentSeconds ?? 0) > 0 && (
          <span className="ml-auto text-muted-foreground">
            ⏱{Math.floor((task.timeSpentSeconds ?? 0) / 60)}m
          </span>
        )}
      </div>
    </div>
  );
}
