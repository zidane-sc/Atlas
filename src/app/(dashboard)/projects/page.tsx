"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/components/providers/TasksProvider";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { PixBar } from "@/components/ui/PixBar";
import { resolveColorVar } from "@/lib/color";

export default function Page() {
  const { tasks: allTasks } = useTasks();
  const { projects, openCreateForm, openEditForm } = useProjects();

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <h1 className="font-display" style={{ fontSize: "11px", color: "var(--color-primary-gold)" }}>◈ PROJECTS</h1>
        <Button size="sm" onClick={openCreateForm}><Plus size={12} /> New Project</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const projectTasks = allTasks.filter((t) => t.project === p.name);
            const completedTasks = projectTasks.filter((t) => t.status === "done").length;
            const inProgress = projectTasks.filter((t) => t.status === "in_progress").length;
            const waiting = projectTasks.filter((t) => t.status === "waiting_external").length;
            const blocked = projectTasks.filter((t) => t.status === "blocked").length;
            const pct = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0;
            return (
              <div
                key={p.id}
                onClick={() => openEditForm(p)}
                className="cursor-pointer border-2 border-l-4 bg-card p-5 transition-colors hover:border-primary"
                style={{ borderColor: "var(--color-border)", borderLeftColor: p.customColor || `var(${p.colorVar})` }}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xl">{p.emoji}</span>
                      <span className="text-base text-foreground">{p.name}</span>
                      <span className="text-sm text-muted-foreground">{p.category}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  </div>
                  <span
                    className="border px-1.5 py-0.5 text-sm whitespace-nowrap"
                    style={{ borderColor: resolveColorVar(p.colorVar), color: resolveColorVar(p.colorVar) }}
                  >
                    {p.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
                <PixBar value={completedTasks} max={projectTasks.length || 1} colorVar={p.colorVar} blocks={16} />
                <div className="mt-1 mb-3 text-sm text-muted-foreground">
                  {pct}% — {completedTasks}/{projectTasks.length}
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  {inProgress > 0 && <span style={{ color: "var(--color-status-in-progress)" }}>▶ {inProgress} in progress</span>}
                  {waiting > 0 && <span style={{ color: "var(--color-status-waiting-external)" }}>⏸ {waiting} waiting</span>}
                  {blocked > 0 && <span style={{ color: "var(--color-status-blocked)" }}>✕ {blocked} blocked</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
