"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PriorityMark } from "@/components/tasks/PriorityMark";
import { StatusBadge } from "@/components/tasks/StatusBadge";
import { useTasks } from "@/components/providers/TasksProvider";
import { useSprints } from "@/components/providers/SprintsProvider";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { PixBar } from "@/components/ui/PixBar";
import { formatDueDate } from "@/lib/task-utils";

const SPRINT_STATUS_COLOR_VAR: Record<string, string> = {
  active: "--color-status-ready",
  completed: "--color-text-muted",
  planning: "--color-status-waiting-external",
};

export default function Page() {
  const { tasks: allTasks, openEditForm } = useTasks();
  const { sprints, openCreateForm, openEditForm: openSprintEditForm } = useSprints();
  const { projects } = useProjects();
  const [selectedId, setSelectedId] = useState(
    () => sprints.find((s) => s.status === "active")?.id ?? sprints[0]?.id
  );
  const sprint = sprints.find((s) => s.id === selectedId) ?? sprints[0];
  const sprintTasks = sprint ? allTasks.filter((t) => t.sprint === sprint.name) : [];
  const done = sprintTasks.filter((t) => t.status === "done").length;
  const sprintProjects = sprint ? projects.filter((p) => sprint.projectIds.includes(p.id)) : [];

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6"
        style={{ backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <h1 className="font-display" style={{ fontSize: "11px", color: "var(--color-primary-gold)" }}>
          ⚡ SPRINTS
        </h1>
        <Button size="sm" onClick={openCreateForm}><Plus size={12} /> <span className="hidden sm:inline">New Sprint</span></Button>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <div className="flex shrink-0 overflow-x-auto border-b border-border md:w-60 md:flex-col md:overflow-x-hidden md:overflow-y-auto md:border-b-0 md:border-r">
          {sprints.map((s) => {
            const colorVar = SPRINT_STATUS_COLOR_VAR[s.status];
            const active = s.id === selectedId;
            const sprintProjs = projects.filter((p) => s.projectIds.includes(p.id));
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="shrink-0 border-r border-border px-4 py-3 text-left transition-colors md:w-full md:border-r-0 md:border-b"
                style={{
                  backgroundColor: active ? "var(--color-bg-panel)" : "transparent",
                  borderLeft: active ? "2px solid var(--color-primary-gold)" : "2px solid transparent",
                }}
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="border px-1 text-xs" style={{ color: `var(${colorVar})`, borderColor: `var(${colorVar})` }}>
                    {s.status.toUpperCase()}
                  </span>
                  {sprintProjs.map((proj) => (
                    <span key={proj.id} className="text-[10px] text-muted-foreground opacity-80 truncate max-w-[100px]">
                      {proj.emoji} {proj.name}
                    </span>
                  ))}
                </div>
                <div className="text-sm text-foreground whitespace-nowrap">{s.name}</div>
                <div className="hidden text-sm text-muted-foreground whitespace-nowrap md:block">{formatDueDate(s.startDate)} → {formatDueDate(s.endDate)}</div>
              </button>
            );
          })}
        </div>

        {sprint && (
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mb-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {sprintProjects.map((project) => (
                  <span
                    key={project.id}
                    className="border px-2 py-0.5 text-xs font-semibold tracking-wider rounded-sm"
                    style={{
                      color: project.customColor || `var(${project.colorVar})`,
                      borderColor: project.customColor || `var(${project.colorVar})`,
                      backgroundColor: "rgba(0, 0, 0, 0.15)",
                    }}
                  >
                    {project.emoji} {project.name.toUpperCase()}
                  </span>
                ))}
                <span
                  className="border px-2 py-0.5 text-sm"
                  style={{ color: `var(${SPRINT_STATUS_COLOR_VAR[sprint.status]})`, borderColor: `var(${SPRINT_STATUS_COLOR_VAR[sprint.status]})` }}
                >
                  {sprint.status.toUpperCase()}
                </span>
                <h2 className="text-base" style={{ color: "var(--color-xp-gold)" }}>{sprint.name}</h2>
                <button
                  type="button"
                  onClick={() => openSprintEditForm(sprint)}
                  title="Edit sprint"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Pencil size={12} />
                </button>
              </div>
              {sprint.goal && <p className="mb-4 text-sm text-muted-foreground italic">&quot;{sprint.goal}&quot;</p>}
              <div className="mb-3 flex gap-6 text-sm text-muted-foreground">
                <span>{formatDueDate(sprint.startDate)} — {formatDueDate(sprint.endDate)}</span>
                <span style={{ color: "var(--color-status-ready)" }}>{done}/{sprintTasks.length} done</span>
              </div>
              <PixBar value={done} max={sprintTasks.length || 1} colorVar="--color-status-ready" blocks={20} />
            </div>

            {sprintTasks.length === 0 ? (
              <p className="py-12 text-center text-base text-muted-foreground">[ NO QUESTS ]</p>
            ) : (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm" style={{ color: "var(--color-primary-gold)" }}>▸</span>
                  <span className="text-sm tracking-widest uppercase text-muted-foreground">
                    Sprint Quests ({sprintTasks.length})
                  </span>
                  <div className="h-px flex-1" style={{ backgroundColor: "var(--color-border)" }} />
                </div>
                <div className="flex flex-col">
                  {sprintTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openEditForm(t)}
                      className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left hover:bg-secondary"
                    >
                      <StatusBadge status={t.status} />
                      <PriorityMark priority={t.priority} />
                      <span className="flex-1 truncate text-sm text-foreground">{t.title}</span>
                      <span className="hidden text-sm text-muted-foreground sm:inline">{t.storyPoint ?? 0} SP</span>
                      <span className="hidden text-sm text-muted-foreground sm:inline">{t.dueDate ?? "—"}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
