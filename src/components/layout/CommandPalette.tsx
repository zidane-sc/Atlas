"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useCommandPalette } from "@/components/providers/CommandPaletteProvider";
import { useTasks } from "@/components/providers/TasksProvider";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { useSprints } from "@/components/providers/SprintsProvider";
import { PRIORITY_SHAPE_GLYPH } from "@/components/tasks/PriorityMark";
import { PRIORITY_SHAPE, STATUS_LABEL, STATUS_SHAPE } from "@/lib/mock-data";
import { NAV_ITEMS_FLAT } from "@/lib/nav-items";
import type { Task } from "@/types/task";
import type { TaskFormValues } from "@/lib/schemas/task";

/** Rebuilds the full editable field set from an existing task — same shape TaskFormSheet's
 * rollback path uses — so `updateTask` can flip just `status` without losing other fields. */
function taskToFormValues(t: Task, status: TaskFormValues["status"]): TaskFormValues {
  return {
    title: t.title,
    description: t.description,
    project: t.project,
    status,
    type: t.type,
    priority: t.priority,
    effort: t.effort,
    storyPoint: t.storyPoint,
    startDate: t.startDate,
    dueDate: t.dueDate,
    sprint: t.sprint,
    waitingOn: t.waitingOn,
    reporter: t.reporter,
    tags: t.tags,
    relations: t.relations,
    attachments: t.attachments,
    deliverables: t.deliverables,
  };
}

interface Item {
  key: string;
  label: string;
  sub?: string;
  shape: string;
  action: () => void;
}

/** Only mounted while open, so each open gets a fresh component instance — query/selection
 * reset for free via useState's initial value instead of an effect. */
export function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  if (!open) return null;
  return <CommandPaletteBody onClose={() => setOpen(false)} />;
}

function CommandPaletteBody({ onClose }: { onClose: () => void }) {
  const { tasks, openEditForm, openCreateForm, updateTask } = useTasks();
  const { projects, openEditForm: openProjectEditForm } = useProjects();
  const { sprints, openEditForm: openSprintEditForm } = useSprints();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();

    const navItems: Item[] = NAV_ITEMS_FLAT.filter((n) => !q || n.label.toLowerCase().includes(q)).map((n) => ({
      key: `nav-${n.href}`,
      label: n.label,
      sub: "Navigate",
      shape: "→",
      action: () => {
        router.push(n.href);
        onClose();
      },
    }));

    const matchedActiveTasks = tasks
      .filter((t) => t.status !== "done")
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.tags.some((tag) => tag.includes(q)))
      .slice(0, 8);

    // "Mark Done" only surfaces once the user searches, interleaved right after each task's
    // "open" item — same "don't clutter the default browsing list" rule the project/sprint
    // items below already follow (docs/05-backlog.md §8 finding #13: completing a task
    // previously always needed opening the edit form or the Kanban select).
    const taskItems: Item[] = matchedActiveTasks.flatMap((t) => {
      const openItem: Item = {
        key: `task-${t.id}`,
        label: t.title,
        sub: `${STATUS_SHAPE[t.status]} ${STATUS_LABEL[t.status]} · ${t.project}`,
        shape: PRIORITY_SHAPE_GLYPH[PRIORITY_SHAPE[t.priority]],
        action: () => {
          openEditForm(t);
          onClose();
        },
      };
      if (!q) return [openItem];
      const completeItem: Item = {
        key: `complete-${t.id}`,
        label: `Mark Done: ${t.title}`,
        sub: t.project,
        shape: "✓",
        action: () => {
          updateTask(t.id, taskToFormValues(t, "done"));
          onClose();
        },
      };
      return [openItem, completeItem];
    });

    const actionItems: Item[] = [
      { key: "action-new", label: "New Quest", sub: "Create a task", shape: "+", action: () => { openCreateForm(); onClose(); } },
    ].filter((a) => !q || a.label.toLowerCase().includes(q));

    // Projects/sprints only surface once the user actually searches — browsing them isn't
    // this palette's default job, unlike nav items and recent tasks.
    const projectItems: Item[] = q
      ? projects.filter((p) => p.name.toLowerCase().includes(q)).map((p) => ({
          key: `project-${p.id}`,
          label: p.name,
          sub: "Project",
          shape: p.emoji,
          action: () => { openProjectEditForm(p); onClose(); },
        }))
      : [];

    const sprintItems: Item[] = q
      ? sprints.filter((s) => s.name.toLowerCase().includes(q)).map((s) => ({
          key: `sprint-${s.id}`,
          label: s.name,
          sub: "Sprint",
          shape: "⚡",
          action: () => { openSprintEditForm(s); onClose(); },
        }))
      : [];

    return q
      ? [...taskItems, ...projectItems, ...sprintItems, ...navItems, ...actionItems]
      : [...actionItems, ...navItems, ...taskItems.slice(0, 5)];
  }, [query, tasks, projects, sprints, router, openEditForm, openProjectEditForm, openSprintEditForm, openCreateForm, updateTask, onClose]);

  const onQueryChange = (value: string) => {
    setQuery(value);
    setSelected(0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[selected]?.action();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-xl border-2 border-primary bg-card"
        style={{ boxShadow: "8px 8px 0 var(--color-bg-deep)" }}
      >
        <div className="flex items-center gap-3 border-b border-border bg-secondary px-4 py-3">
          <Search size={14} className="shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search quests, navigate, or take action..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none"
          />
          <kbd className="border px-1.5 text-sm text-muted-foreground" style={{ borderColor: "var(--color-border)" }}>ESC</kbd>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">[ NO RESULTS FOR &quot;{query}&quot; ]</div>
          ) : (
            items.map((item, i) => (
              <div
                key={item.key}
                onClick={item.action}
                onMouseEnter={() => setSelected(i)}
                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors"
                style={{
                  backgroundColor: i === selected ? "var(--color-bg-panel-alt)" : "transparent",
                  borderLeft: i === selected ? "2px solid var(--color-primary-gold)" : "2px solid transparent",
                }}
              >
                <span className="w-4 shrink-0 text-sm" style={{ color: "var(--color-primary-gold)" }}>
                  {item.key === "action-new" ? <Plus size={12} /> : item.shape}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-foreground">{item.label}</div>
                  {item.sub && <div className="text-sm text-muted-foreground">{item.sub}</div>}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-4 border-t border-border bg-secondary px-4 py-2 text-sm" style={{ color: "var(--color-dim)" }}>
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
