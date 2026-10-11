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
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <h1 className="font-display" style={{ fontSize: "11px", color: "var(--color-primary-gold)" }}>◈ PROJECTS</h1>
        <Button size="sm" onClick={openCreateForm} className="h-7 text-xs"><Plus size={12} /> New Project</Button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl">
          {projects.map((p) => {
            const projectTasks = allTasks.filter((t) => t.project === p.name);
            const completedTasks = projectTasks.filter((t) => t.status === "done").length;
            const inProgress = projectTasks.filter((t) => t.status === "in_progress").length;
            const pct = projectTasks.length > 0 ? Math.round((completedTasks / projectTasks.length) * 100) : 0;
            return (
              <div
                key={p.id}
                onClick={() => openEditForm(p)}
                className="cursor-pointer border-2 border-l-4 bg-card p-3 sm:p-3.5 transition-colors hover:border-primary flex flex-col justify-between"
                style={{ borderColor: "var(--color-border)", borderLeftColor: p.customColor || `var(${p.colorVar})` }}
              >
                <div>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="mb-0.5 flex items-center gap-1.5">
                        <span className="text-base shrink-0">{p.emoji}</span>
                        <span className="text-xs font-bold text-foreground truncate">{p.name}</span>
                        <span className="text-[11px] text-muted-foreground font-mono">[{p.category}]</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                    </div>
                    <span
                      className="border px-1.5 py-0.5 text-[10px] font-mono font-bold whitespace-nowrap shrink-0"
                      style={{ borderColor: resolveColorVar(p.colorVar), color: resolveColorVar(p.colorVar) }}
                    >
                      {p.status.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/40">
                  <PixBar value={completedTasks} max={projectTasks.length || 1} colorVar={p.colorVar} blocks={16} />
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground font-mono">
                    <span>{pct}% ({completedTasks}/{projectTasks.length})</span>
                    {inProgress > 0 && <span style={{ color: "var(--color-status-in-progress)" }}>▶ {inProgress} active</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
