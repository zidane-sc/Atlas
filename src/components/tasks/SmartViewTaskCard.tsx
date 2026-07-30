"use client";

import { PriorityMark } from "@/components/tasks/PriorityMark";
import { TYPE_ICON } from "@/lib/mock-data";
import { formatDueDate, isOverdue } from "@/lib/task-utils";
import { MOCK_NOW } from "@/lib/mock-data";
import { Pin } from "lucide-react";
import type { Task } from "@/types/task";

export function SmartViewTaskCard({ task, onSelect }: { task: Task; onSelect: (task: Task) => void }) {
  const isOverdueTask = isOverdue(task.dueDate, MOCK_NOW);
  const daysOverdue = task.dueDate ? Math.floor((new Date(MOCK_NOW).getTime() - new Date(task.dueDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div
      onClick={() => onSelect(task)}
      className="group border-2 p-3 transition-all cursor-pointer hover:bg-primary/15 active:scale-95 hover:shadow-lg relative"
      style={{
        borderColor: task.pinned ? "var(--color-primary-gold)" : isOverdueTask ? "var(--color-status-blocked)" : "var(--color-primary-gold)",
        backgroundColor: task.pinned ? "rgba(255,217,61,0.08)" : isOverdueTask ? "rgba(255,0,0,0.08)" : "transparent",
        borderWidth: task.pinned ? "3px" : "2px",
      }}
    >
      {/* Header: Type + Priority + Title + Pin */}
      <div className="flex items-start gap-2 mb-2">
        <span className="text-lg shrink-0">{TYPE_ICON[task.type]}</span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2">
            {task.title}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.pinned && <Pin size={14} style={{ color: "var(--color-primary-gold)", fill: "var(--color-primary-gold)" }} />}
          <PriorityMark priority={task.priority} />
        </div>
      </div>

      {/* Status + Due Date (prominent) */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="px-2 py-1 border text-xs font-bold"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-bg-panel-alt)",
          }}
        >
          {task.status.toUpperCase()}
        </span>

        {task.dueDate && (
          <span
            className="px-2 py-1 border font-bold text-xs"
            style={{
              borderColor: isOverdueTask ? "var(--color-status-blocked)" : "var(--color-border)",
              backgroundColor: isOverdueTask ? "var(--color-status-blocked)" : "transparent",
              color: isOverdueTask ? "white" : "var(--color-text-muted)",
            }}
          >
            {isOverdueTask ? `⚠ ${daysOverdue}d OVERDUE` : `📅 ${formatDueDate(task.dueDate)}`}
          </span>
        )}
      </div>

      {/* Stats: Effort + Story Points + Project */}
      <div className="grid grid-cols-3 gap-2 mb-2 text-center">
        {task.effort ? (
          <div className="border border-border p-1 bg-secondary/30">
            <div className="text-xs text-muted-foreground">EFFORT</div>
            <div className="text-sm font-bold">{task.effort.toUpperCase()}</div>
          </div>
        ) : (
          <div className="border border-border/30 p-1 bg-secondary/10">
            <div className="text-xs text-muted-foreground">—</div>
          </div>
        )}

        {task.storyPoint ? (
          <div className="border border-primary/50 p-1 bg-primary/10">
            <div className="text-xs text-muted-foreground">POINTS</div>
            <div className="text-sm font-bold" style={{ color: "var(--color-xp-gold)" }}>{task.storyPoint}</div>
          </div>
        ) : (
          <div className="border border-border/30 p-1 bg-secondary/10">
            <div className="text-xs text-muted-foreground">—</div>
          </div>
        )}

        {task.project ? (
          <div className="border border-border p-1 bg-secondary/30">
            <div className="text-xs text-muted-foreground">PROJECT</div>
            <div className="text-xs font-bold truncate">{task.project}</div>
          </div>
        ) : (
          <div className="border border-border/30 p-1 bg-secondary/10">
            <div className="text-xs text-muted-foreground">—</div>
          </div>
        )}
      </div>

      {/* Tags + Description */}
      <div className="space-y-1">
        {task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="text-xs px-1.5 py-0.5 border border-border text-primary" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
                #{tag}
              </span>
            ))}
            {task.tags.length > 3 && (
              <span className="text-xs px-1.5 py-0.5 text-muted-foreground">+{task.tags.length - 3}</span>
            )}
          </div>
        )}

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 italic border-t border-border/40 pt-1">
            {task.description}
          </p>
        )}
      </div>

      {/* Time spent indicator */}
      {task.timeSpentSeconds > 0 && (
        <div className="mt-2 pt-2 border-t border-border/40">
          <div className="text-xs text-muted-foreground">
            ⏱ {Math.floor(task.timeSpentSeconds / 3600)}h {Math.floor((task.timeSpentSeconds % 3600) / 60)}m spent
          </div>
        </div>
      )}
    </div>
  );
}
