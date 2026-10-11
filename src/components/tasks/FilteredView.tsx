"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/components/providers/TasksProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import type { Task } from "@/types/task";
import { SmartViewTaskCard } from "./SmartViewTaskCard";
import { TaskListView } from "./TaskListView";

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
  const { compactView } = useSettings();
  const sortedTasks = [...tasks].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between gap-4 px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <Icon size={12} />
            <h1 className="font-display" style={{ fontSize: "11px", color: `var(${colorVar})` }}>{title}</h1>
          </div>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold" style={{ color: `var(${colorVar})` }}>({tasks.length})</span>
          {showNewQuest && <Button size="sm" onClick={openCreateForm} className="h-7 text-xs"><Plus size={12} /> New</Button>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <div className="mb-2 font-mono text-xl">{empty}</div>
            <div className="text-xs">Clear skies, adventurer.</div>
          </div>
        ) : compactView ? (
          <div className="p-3 sm:p-4">
            <TaskListView tasks={sortedTasks} variant="compact" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 p-3 sm:p-4 auto-rows-max">
            {sortedTasks.map((t) => (
              <SmartViewTaskCard key={t.id} task={t} onSelect={openEditForm} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
