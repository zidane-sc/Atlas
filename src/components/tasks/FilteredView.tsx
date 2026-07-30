"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/components/providers/TasksProvider";
import type { Task } from "@/types/task";
import { TaskRow } from "./TaskRow";

/** Matches reference-design's FilteredView — docs/03-design.md §10 (Today/Inbox/Waiting/Focus smart views). */
export function FilteredView({
  title,
  colorVar,
  icon: Icon,
  desc,
  tasks,
  empty,
  showNewQuest = true,
}: {
  title: string;
  colorVar: string;
  icon: React.ComponentType<{ size?: number }>;
  desc: string;
  tasks: Task[];
  empty: string;
  showNewQuest?: boolean;
}) {
  const { openEditForm, openCreateForm } = useTasks();

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between gap-4 px-6 py-3"
        style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <Icon size={12} />
            <h1 className="font-display" style={{ fontSize: "11px", color: `var(${colorVar})` }}>{title}</h1>
          </div>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-['VT323'] text-sm" style={{ color: `var(${colorVar})` }}>({tasks.length})</span>
          {showNewQuest && <Button size="sm" onClick={openCreateForm}><Plus size={12} /> New</Button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <div className="mb-3 text-3xl">{empty}</div>
            <div className="text-sm">Clear skies, adventurer.</div>
          </div>
        ) : (
          <div className="flex flex-col">
            {tasks.map((t) => (
              <TaskRow key={t.id} task={t} onSelect={openEditForm} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
