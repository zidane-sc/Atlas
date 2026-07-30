"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { TYPE_ICON } from "@/lib/mock-data";
import { PriorityMark } from "@/components/tasks/PriorityMark";
import type { Task } from "@/types/task";

export function PinnedTaskFAB({
  tasks,
  onOpen,
  onUnpin,
}: {
  tasks: Task[];
  onOpen: (task: Task) => void;
  onUnpin: (taskId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (tasks.length === 0) return null;

  return (
    <>
      {/* FAB Button - Game-style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-40 flex items-center justify-center w-14 h-14 border-2 text-lg font-bold transition-all hover:shadow-md active:scale-95"
        style={{
          backgroundColor: "var(--color-primary-gold)",
          borderColor: "var(--color-primary-gold-dim)",
          boxShadow: "3px 3px 0 var(--color-primary-gold-dim)",
          color: "#000",
        }}
        title={`${tasks.length} pinned task${tasks.length > 1 ? "s" : ""}`}
      >
        <span>📌</span>
        {tasks.length > 1 && (
          <span
            className="absolute -top-2 -right-2 w-5 h-5 flex items-center justify-center text-xs font-bold"
            style={{
              backgroundColor: "var(--color-status-blocked)",
              borderRadius: "50%",
              border: "2px solid var(--color-primary-gold)",
            }}
          >
            {tasks.length}
          </span>
        )}
      </button>

      {/* Popup Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />
          <div
            className="fixed bottom-20 right-4 z-40 w-96 max-h-96 border-2 bg-card overflow-hidden flex flex-col"
            style={{
              borderColor: "var(--color-primary-gold)",
              boxShadow: "4px 4px 0 var(--color-primary-gold-dim)",
            }}
          >
            {/* Header */}
            <div
              className="px-3 py-2 border-b-2 border-border flex items-center justify-between"
              style={{ backgroundColor: "var(--color-bg-panel-alt)" }}
            >
              <span className="font-display text-xs tracking-widest uppercase" style={{ color: "var(--color-primary-gold)" }}>
                📌 PINNED ({tasks.length})
              </span>
              <button onClick={() => setIsOpen(false)} className="p-0.5 hover:text-destructive transition-colors">
                <X size={14} />
              </button>
            </div>

            {/* Task List */}
            <div className="overflow-y-auto flex-1 divide-y divide-border">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-2.5 hover:bg-primary/10 transition-colors flex gap-2 group cursor-pointer"
                  onClick={() => {
                    onOpen(task);
                    setIsOpen(false);
                  }}
                >
                  <span className="text-base shrink-0">{TYPE_ICON[task.type]}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-1">
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-1 flex-wrap">
                      <PriorityMark priority={task.priority} />
                      <span className="text-xs px-1.5 py-0.5 border border-border whitespace-nowrap text-xs font-bold" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
                        {task.status.replace(/_/g, " ").toUpperCase()}
                      </span>
                      {task.dueDate && <span className="text-xs text-muted-foreground">📅 {task.dueDate.slice(5)}</span>}
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUnpin(task.id);
                    }}
                    className="p-0.5 hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
