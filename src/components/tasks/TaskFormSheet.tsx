"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Check, ChevronDown, Copy, Trash2, Info, Pin } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { BattleTimer } from "@/components/gamification/BattleTimer";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useTasks } from "@/components/providers/TasksProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { calcTaskCoins, calcTaskXP } from "@/lib/gamification";
import { PriorityMark } from "./PriorityMark";
import { StatusBadge } from "./StatusBadge";
import {
  ATTACHMENT_TYPES,
  DELIVERABLE_TYPES,
  EFFORT_OPTIONS,
  RELATION_TYPES,
  REPORTER_OPTIONS,
  SP_OPTIONS,
  taskFormSchema,
  type TaskFormValues,
} from "@/lib/schemas/task";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { useSprints } from "@/components/providers/SprintsProvider";
import { sortProjectsForPicker } from "@/lib/picker-sort";
import { sortSprintsForPicker } from "@/lib/picker-sort";
import { sortTasksForPicker } from "@/lib/picker-sort";
import { handleDropdownKeydown, type DropdownNavState } from "@/lib/dropdown-nav";
import { updateDrawerLastSelectedAction } from "@/lib/actions/user";
import { TaskNoteLinks } from "@/components/notes/TaskNoteLinks";
import { STATUS_LABEL, TYPE_ICON } from "@/lib/mock-data";
import type {
  AttachmentType,
  DeliverableType,
  Effort,
  Priority,
  RelationType,
  Task,
  TaskAttachment,
  TaskDeliverable,
  TaskRelation,
  TaskStatus,
  TaskType,
} from "@/types/task";

function Section({ title, shape, defaultOpen = false, children }: { title: string; shape: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="border-2 border-border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold tracking-widest text-foreground hover:bg-[var(--color-bg-panel-alt)] transition-colors">
        <span className="flex items-center gap-2">
          <span style={{ color: "var(--color-primary-gold)" }}>{shape}</span>
          <span>{title}</span>
        </span>
        <ChevronDown size={12} className="transition-transform duration-200 group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t-2 border-border px-3 py-3 text-sm">{children}</CollapsibleContent>
    </Collapsible>
  );
}

const EMPTY_FORM: Omit<TaskFormValues, "project"> = {
  title: "",
  status: "inbox",
  type: "coding",
  priority: "p2",
  reporter: "self",
  tags: [],
  relations: [],
  attachments: [],
  deliverables: [],
  startDate: undefined,
};

const LC = "mb-1 block text-sm tracking-widest text-muted-foreground uppercase";
const FIELD =
  "w-full border-2 border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary focus:border-primary";
const FIELD_ERROR =
  "w-full border-2 border-status-blocked bg-card px-3 py-1.5 text-sm text-status-blocked outline-none focus-visible:ring-2 focus-visible:ring-status-blocked";

function humanize(value: string) {
  return value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Outer shell just renders the Sheet chrome. `key`-ing the form body to the active
 * task's id (or "create") lets a fresh mount seed its own state from props instead of
 * an effect resetting state after the fact — avoids react-hooks/set-state-in-effect.
 */
export function TaskFormSheet() {
  const { sheet, closeForm } = useTasks();
  return (
    <Sheet open={sheet.open} onOpenChange={(open) => !open && closeForm()}>
      <SheetContent className="w-full gap-0 overflow-y-auto border-l-2 border-border" style={{ width: "520px", maxWidth: "90vw" }}>
        {sheet.open && <TaskFormBody key={sheet.task?.id ?? "create"} mode={sheet.mode} task={sheet.task} />}
      </SheetContent>
    </Sheet>
  );
}

function TaskFormBody({ mode, task }: { mode: "create" | "edit"; task: Task | null }) {
  const { tasks, closeForm, createTask, updateTask, deleteTask, duplicateTask, togglePin, activeTimer, startTimer, stopTimer, switchPhase } = useTasks();
  const { projects } = useProjects();
  const { sprints } = useSprints();
  const { notify } = useNotifications();
  const [form, setForm] = useState<TaskFormValues>(() =>
    mode === "edit" && task
      ? {
          title: task.title,
          description: task.description,
          project: task.project,
          status: task.status,
          type: task.type,
          priority: task.priority,
          effort: task.effort,
          storyPoint: task.storyPoint,
          startDate: task.startDate,
          dueDate: task.dueDate,
          waitingOn: task.waitingOn,
          sprint: task.sprint,
          reporter: task.reporter ?? "self",
          tags: task.tags,
          relations: task.relations,
          attachments: task.attachments,
          deliverables: task.deliverables,
        }
      : { ...EMPTY_FORM, project: projects[0]?.name ?? "" }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof TaskFormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const [relationType, setRelationType] = useState<RelationType>("related");
  const [relationTargetId, setRelationTargetId] = useState("");
  const [attachmentType, setAttachmentType] = useState<AttachmentType>("github_pr");
  const [attachmentLabel, setAttachmentLabel] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [deliverableType, setDeliverableType] = useState<DeliverableType>("pr");
  const [deliverableLabel, setDeliverableLabel] = useState("");
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [relationSearch, setRelationSearch] = useState("");
  const [relationFocused, setRelationFocused] = useState(false);
  const relationInputRef = useRef<HTMLInputElement>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectFocused, setProjectFocused] = useState(false);
  const [projectSelectedIndex, setProjectSelectedIndex] = useState(-1);
  const projectInputRef = useRef<HTMLInputElement>(null);
  const [sprintSearch, setSprintSearch] = useState("");
  const [sprintFocused, setSprintFocused] = useState(false);
  const [sprintSelectedIndex, setSprintSelectedIndex] = useState(-1);
  const sprintInputRef = useRef<HTMLInputElement>(null);
  const [relationSelectedIndex, setRelationSelectedIndex] = useState(-1);
  const [editingAttachmentIndex, setEditingAttachmentIndex] = useState<number | null>(null);
  const [editingDeliverableIndex, setEditingDeliverableIndex] = useState<number | null>(null);

  const currentTask = useMemo(
    () => (task ? tasks.find((t) => t.id === task.id) || task : null),
    [task, tasks]
  );

  const otherTasks = useMemo(() => tasks.filter((t) => t.id !== task?.id), [tasks, task?.id]);

  const projectOptions = useMemo(() => {
    return projectSearch
      ? projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase()))
      : sortProjectsForPicker(projects).slice(0, 5);
  }, [projectSearch, projects]);

  const sprintOptions = useMemo(() => {
    return sprintSearch
      ? sprints.filter(s => s.name.toLowerCase().includes(sprintSearch.toLowerCase()))
      : sortSprintsForPicker(sprints).slice(0, 5);
  }, [sprintSearch, sprints]);

  const relationOptions = useMemo(() => {
    return relationSearch
      ? otherTasks.filter(t => t.title.toLowerCase().includes(relationSearch.toLowerCase()))
      : sortTasksForPicker(otherTasks).slice(0, 5);
  }, [relationSearch, otherTasks]);

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (tag && !form.tags.includes(tag)) set("tags", [...form.tags, tag]);
    setTagInput("");
  };
  const removeTag = (tag: string) => set("tags", form.tags.filter((t) => t !== tag));

  const addRelation = () => {
    const target = otherTasks.find((t) => t.id === relationTargetId);
    if (!target) return;
    const relation: TaskRelation = { relationType, taskId: target.id, title: target.title };
    set("relations", [...form.relations, relation]);
    setRelationTargetId("");
  };
  const removeRelation = (taskId: string) => set("relations", form.relations.filter((r) => r.taskId !== taskId));

  const addAttachment = () => {
    if (!attachmentLabel.trim()) return;
    const attachment: TaskAttachment = { type: attachmentType, label: attachmentLabel.trim(), url: attachmentUrl.trim() };
    set("attachments", [...form.attachments, attachment]);
    setAttachmentLabel("");
    setAttachmentUrl("");
  };
  const removeAttachment = (index: number) => set("attachments", form.attachments.filter((_, i) => i !== index));

  const addDeliverable = () => {
    if (!deliverableLabel.trim()) return;
    const deliverable: TaskDeliverable = { type: deliverableType, label: deliverableLabel.trim(), url: deliverableUrl.trim() || undefined };
    set("deliverables", [...form.deliverables, deliverable]);
    setDeliverableLabel("");
    setDeliverableUrl("");
  };
  const removeDeliverable = (index: number) => set("deliverables", form.deliverables.filter((_, i) => i !== index));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = taskFormSchema.safeParse({
      ...form,
      description: form.description?.trim() || undefined,
      startDate: form.startDate || undefined,
      dueDate: form.dueDate || undefined,
      waitingOn: form.waitingOn?.trim() || undefined,
      sprint: form.sprint?.trim() || undefined,
    });
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof TaskFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof TaskFormValues;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "edit" && task) {
        updateTask(task.id, result.data);
        notify(`✓ Updated: "${result.data.title}"`, "success");
      } else {
        createTask(result.data);
        notify(`✓ Created: "${result.data.title}"`, "success");
      }
    } finally {
      setSubmitting(false);
      closeForm();
    }
  };

  const previewXP = calcTaskXP(form.priority, form.storyPoint, true);
  const previewCoins = calcTaskCoins(form.priority, form.storyPoint);

  const { focusMinutes, breakMinutes } = useSettings();
  const isTiming = mode === "edit" && task != null && activeTimer?.taskId === task.id;
  const [liveSeconds, setLiveSeconds] = useState(0);
  useEffect(() => {
    if (!isTiming || !activeTimer) {
      Promise.resolve().then(() => setLiveSeconds(0));
      return;
    }
    const update = () => {
      const elapsed = Math.floor((Date.now() - activeTimer.startedAt) / 1000);
      setLiveSeconds(elapsed);

      const phaseLimitSeconds = activeTimer.phase === "focus" ? focusMinutes * 60 : breakMinutes * 60;
      if (elapsed >= phaseLimitSeconds) {
        switchPhase(task!.id);
      }
    };
    Promise.resolve().then(update);
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [isTiming, activeTimer, focusMinutes, breakMinutes, task, switchPhase]);
  // `task` is a snapshot from when the sheet opened — look up the live copy so a stopped
  // timer's freshly-added time shows immediately instead of waiting for a form reopen.
  const liveTask = task ? (tasks.find((t) => t.id === task.id) ?? task) : null;
  const totalSeconds = activeTimer?.phase === "break"
    ? Math.max(0, breakMinutes * 60 - liveSeconds)
    : (liveTask?.timeSpentSeconds ?? 0) + (isTiming ? liveSeconds : 0);

  return (
    <form onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader
        className="flex-row items-center justify-between gap-2 space-y-0 border-b border-border py-3"
        style={{ backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <div className="flex items-center gap-2">
          <SheetTitle className="font-display" style={{ fontSize: "9px", color: "var(--color-primary-gold)" }}>
            {mode === "edit" ? "◈ QUEST DETAIL" : "+ NEW QUEST"}
          </SheetTitle>
          {mode === "edit" && currentTask && (
            <span className="text-xs font-mono font-bold" style={{ color: "var(--color-primary-gold)", minWidth: "50px" }}>
              {currentTask.code}
            </span>
          )}
        </div>
        <SheetDescription className="sr-only">{mode === "edit" ? "Edit this quest." : "What needs to be done?"}</SheetDescription>
        {mode === "edit" && currentTask && (
          <div className="mr-8 flex gap-1.5">
            <Button type="button" variant="ghost" size="icon-sm" title={currentTask.pinned ? "Unpin" : "Pin"} onClick={() => togglePin(currentTask.id, !currentTask.pinned)}>
              <Pin size={14} style={{ color: currentTask.pinned ? "var(--color-primary-gold)" : "var(--color-text-muted)", fill: currentTask.pinned ? "var(--color-primary-gold)" : "none" }} />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" title="Duplicate" onClick={() => duplicateTask(currentTask.id)}>
              <Copy size={14} />
            </Button>
            <ConfirmButton title="Delete" confirmLabel="Delete?" onConfirm={() => deleteTask(currentTask.id)}>
              <Trash2 size={14} style={{ color: "var(--color-status-blocked)" }} />
            </ConfirmButton>
          </div>
        )}
      </SheetHeader>

      <div className="flex items-center gap-4 border-b border-border px-4 py-2 text-sm" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
        <span className="flex items-center gap-1" style={{ color: "var(--color-xp-gold)" }} title={`XP = (Priority * 20) + (Story Points * 5)\nP0: 100, P1: 80, P2: 60, P3: 40, P4: 20`}>
          ⚡ +{previewXP} XP on complete <Info size={12} className="opacity-50" style={{ cursor: "help" }} />
        </span>
        <span className="flex items-center gap-1" style={{ color: "var(--color-coin)" }} title="Coins = Priority * Story Points * 2">
          🪙 +{previewCoins} coins <Info size={12} className="opacity-50" style={{ cursor: "help" }} />
        </span>
      </div>

      <div className="border-b border-border px-4 pt-4 pb-3">
        <label className={LC}>Quest Title *</label>
        <input
          className={errors.title ? FIELD_ERROR : FIELD}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="What needs to be done?"
          autoFocus
        />
        {errors.title && <p className="mt-1 text-sm" style={{ color: "var(--color-status-blocked)" }}>{errors.title}</p>}
      </div>
      <div className="flex items-center gap-4 border-b border-border px-4 py-2">
        <StatusBadge status={form.status} />
        <PriorityMark priority={form.priority} withLabel />
        <span className="text-sm">{TYPE_ICON[form.type]}</span>
      </div>

      {mode === "edit" && task && (
        <BattleTimer
          task={liveTask ?? task}
          isTiming={isTiming}
          totalSeconds={totalSeconds}
          onStart={() => startTimer(task.id)}
          onStop={stopTimer}
          phase={activeTimer?.phase}
        />
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 pt-3 scroll-shadow">
        <Section title="Core" shape="■" defaultOpen>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LC}>Status</label>
                <select aria-label="Status" className={FIELD} value={form.status} onChange={(e) => set("status", e.target.value as TaskStatus)}>
                  {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`${LC} flex items-center gap-1`} title="P0=Urgent, P1=High, P2=Medium, P3=Low, P4=Minimal">
                  Priority <Info size={12} className="opacity-50" style={{ cursor: "help" }} />
                </label>
                <select aria-label="Priority" className={FIELD} value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
                  {(["p0", "p1", "p2", "p3", "p4"] as Priority[]).map((p) => (
                    <option key={p} value={p}>{p.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LC}>Type</label>
                <select aria-label="Type" className={FIELD} value={form.type} onChange={(e) => set("type", e.target.value as TaskType)}>
                  {(Object.keys(TYPE_ICON) as TaskType[]).map((t) => (
                    <option key={t} value={t}>{TYPE_ICON[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`${LC} flex items-center gap-1`} title="XS=<1hr, S=1-2hrs, M=2-4hrs, L=4-8hrs, XL=8-16hrs, XXL=>16hrs">
                  Effort <Info size={12} className="opacity-50" style={{ cursor: "help" }} />
                </label>
                <select
                  aria-label="Effort"
                  className={FIELD}
                  value={form.effort ?? ""}
                  onChange={(e) => set("effort", e.target.value === "" ? undefined : (e.target.value as Effort))}
                >
                  <option value="">—</option>
                  {EFFORT_OPTIONS.map((ef) => (
                    <option key={ef} value={ef}>{ef.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LC}>Start Date</label>
                <DatePicker
                  value={form.startDate}
                  onChange={(date) => set("startDate", date)}
                />
              </div>
              <div>
                <label className={LC}>Due Date</label>
                <DatePicker
                  value={form.dueDate}
                  onChange={(date) => set("dueDate", date)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LC}>Reporter</label>
                <select
                  aria-label="Reporter"
                  className={FIELD}
                  value={form.reporter ?? "self"}
                  onChange={(e) => set("reporter", e.target.value as (typeof REPORTER_OPTIONS)[number])}
                >
                  {REPORTER_OPTIONS.map((r) => (
                    <option key={r} value={r}>{humanize(r)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`${LC} flex items-center gap-1`} title="Relative complexity/size. 0=Trivial, 21=Epic. Used to calculate rewards & estimate effort.">
                  Story Points <Info size={12} className="opacity-50" style={{ cursor: "help" }} />
                </label>
                <select
                  aria-label="Story Points"
                  className={FIELD}
                  value={form.storyPoint ?? ""}
                  onChange={(e) => set("storyPoint", e.target.value === "" ? undefined : Number(e.target.value))}
                >
                  <option value="">—</option>
                  {SP_OPTIONS.map((sp) => (
                    <option key={sp} value={sp}>{sp} SP</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LC}>Project</label>
                <div className="relative">
                  <input
                    ref={projectInputRef}
                    aria-label="Project"
                    className={FIELD}
                    placeholder="Search project..."
                    value={projectSearch || (form.project ? `${projects.find(p => p.name === form.project)?.emoji} ${form.project}` : "")}
                    onChange={(e) => {
                      const val = e.target.value;
                      setProjectSearch(val);
                      setProjectSelectedIndex(-1);
                      if (!projects.some(p => `${p.emoji} ${p.name}` === val)) {
                        set("project", "");
                      }
                    }}
                    onKeyDown={(e) => {
                      const newState = handleDropdownKeydown(
                        e,
                        { selected: projectSelectedIndex, total: projectOptions.length },
                        (idx) => {
                          const p = projectOptions[idx];
                          if (p) {
                            void updateDrawerLastSelectedAction("project", p.id);
                            set("project", p.name);
                            setProjectSearch("");
                          }
                        },
                        () => { projectInputRef.current?.blur(); setProjectFocused(false); }
                      );
                      setProjectSelectedIndex(newState.selected);
                    }}
                    onFocus={(e) => {
                      setProjectSearch("");
                      setProjectSelectedIndex(-1);
                      e.target.select();
                      setProjectFocused(true);
                    }}
                    onBlur={() => { setProjectFocused(false); setProjectSelectedIndex(-1); }}
                  />
                  {projectFocused && projectOptions.length > 0 && (
                    <ul className="border border-border max-h-20 overflow-y-auto bg-secondary text-xs absolute top-full left-0 right-0 z-10">
                      {projectOptions.map((p, idx) => (
                        <li
                          key={p.id}
                          className={`px-2 py-1 cursor-pointer border-b border-border last:border-b-0 ${projectSelectedIndex === idx ? "bg-primary/20 font-semibold" : "hover:bg-primary/10"}`}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setProjectSelectedIndex(idx)}
                          onClick={() => { void updateDrawerLastSelectedAction("project", p.id); set("project", p.name); setProjectSearch(""); setProjectFocused(false); projectInputRef.current?.blur(); }}
                        >
                          {p.emoji} {p.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {errors.project && <p className="mt-1 text-sm" style={{ color: "var(--color-status-blocked)" }}>{errors.project}</p>}
              </div>

            </div>

            <div>
              <label className={LC}>Sprint</label>
              <div className="relative">
                <input
                  ref={sprintInputRef}
                  aria-label="Sprint"
                  className={FIELD}
                  placeholder="Search sprint..."
                  value={sprintSearch || form.sprint || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSprintSearch(val);
                    setSprintSelectedIndex(-1);
                    if (!sprints.some(s => s.name === val)) {
                      set("sprint", undefined);
                    }
                  }}
                  onKeyDown={(e) => {
                    const newState = handleDropdownKeydown(
                      e,
                      { selected: sprintSelectedIndex, total: sprintOptions.length },
                      (idx) => {
                        const s = sprintOptions[idx];
                        if (s) {
                          void updateDrawerLastSelectedAction("sprint", s.id);
                          set("sprint", s.name);
                          setSprintSearch("");
                        }
                      },
                      () => { sprintInputRef.current?.blur(); setSprintFocused(false); }
                    );
                    setSprintSelectedIndex(newState.selected);
                  }}
                  onFocus={(e) => {
                    setSprintSearch("");
                    setSprintSelectedIndex(-1);
                    e.target.select();
                    setSprintFocused(true);
                  }}
                  onBlur={() => { setSprintFocused(false); setSprintSelectedIndex(-1); }}
                />
                {sprintFocused && sprintOptions.length > 0 && (
                  <ul className="border border-border max-h-20 overflow-y-auto bg-secondary text-xs absolute top-full left-0 right-0 z-10">
                    {sprintOptions.map((s, idx) => (
                      <li
                        key={s.id}
                        className={`px-2 py-1 cursor-pointer border-b border-border last:border-b-0 ${sprintSelectedIndex === idx ? "bg-primary/20 font-semibold" : "hover:bg-primary/10"}`}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setSprintSelectedIndex(idx)}
                        onClick={() => { void updateDrawerLastSelectedAction("sprint", s.id); set("sprint", s.name); setSprintSearch(""); setSprintFocused(false); sprintInputRef.current?.blur(); }}
                      >
                        {s.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {(form.status === "waiting_external" || form.status === "blocked") && (
              <div>
                <label className={LC}>{form.status === "blocked" ? "Blocked By" : "Waiting On"}</label>
                <input
                  aria-label={form.status === "blocked" ? "Blocked By" : "Waiting On"}
                  className={FIELD}
                  value={form.waitingOn ?? ""}
                  onChange={(e) => set("waitingOn", e.target.value)}
                  placeholder="Who / what / dependency..."
                />
              </div>
            )}

            <div>
              <label className={LC}>Description</label>
              <textarea
                aria-label="Description"
                className={`${FIELD} resize-none`}
                rows={4}
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Context, acceptance criteria..."
              />
            </div>

            <div>
              <label className={LC}>Tags</label>
              <div className="mb-3 flex flex-wrap gap-2">
                {form.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 border-2 px-2 py-1 text-xs font-medium text-foreground transition-colors"
                    style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="hover:opacity-70 transition-opacity"
                      style={{ color: "var(--color-status-blocked)" }}
                      title="Remove tag"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  aria-label="Tag"
                  className={`${FIELD} flex-1`}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addTag(); }
                  }}
                  placeholder="tag (Enter)"
                />
                <Button type="button" size="sm" aria-label="Add tag" onClick={addTag}>Add</Button>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Relations" shape="◈">
          <div className="flex flex-col gap-2">
            {form.relations.length === 0 ? (
              <p className="text-muted-foreground">No relations yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {form.relations.map((r) => (
                  <li key={r.taskId} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground capitalize">{humanize(r.relationType)}</span>
                    <span className="flex-1 truncate text-right">{r.title}</span>
                    <button type="button" onClick={() => removeRelation(r.taskId)} className="shrink-0" style={{ color: "var(--color-status-blocked)" }}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2 border-t border-border pt-2">
              <div className="flex gap-2">
                <select aria-label="Relation type" className="border-2 border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary w-32 shrink-0" value={relationType} onChange={(e) => setRelationType(e.target.value as RelationType)}>
                  {RELATION_TYPES.map((rt) => (
                    <option key={rt} value={rt}>{humanize(rt)}</option>
                  ))}
                </select>
                <input
                  ref={relationInputRef}
                  aria-label="Search quest"
                  className={FIELD}
                  placeholder="Search quest..."
                  value={relationSearch}
                  onChange={(e) => {
                    setRelationSearch(e.target.value);
                    setRelationSelectedIndex(-1);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && relationTargetId) {
                      e.preventDefault();
                      addRelation();
                      return;
                    }
                    const newState = handleDropdownKeydown(
                      e,
                      { selected: relationSelectedIndex, total: relationOptions.length },
                      (idx) => {
                        const t = relationOptions[idx];
                        if (t) {
                          void updateDrawerLastSelectedAction("task", t.id);
                          setRelationTargetId(t.id);
                          setRelationSearch("");
                        }
                      },
                      () => { relationInputRef.current?.blur(); setRelationFocused(false); }
                    );
                    setRelationSelectedIndex(newState.selected);
                  }}
                  onFocus={() => { setRelationFocused(true); setRelationSelectedIndex(-1); }}
                  onBlur={() => { setRelationFocused(false); setRelationSelectedIndex(-1); }}
                />
              </div>
              {relationFocused && relationOptions.length > 0 && (
                <ul className="border border-border max-h-20 overflow-y-auto bg-secondary text-xs">
                  {relationOptions.map((t, idx) => (
                    <li
                      key={t.id}
                      className={`px-2 py-1 cursor-pointer border-b border-border last:border-b-0 ${relationSelectedIndex === idx ? "bg-primary/20 font-semibold" : "hover:bg-primary/10"}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setRelationSelectedIndex(idx)}
                      onClick={() => { void updateDrawerLastSelectedAction("task", t.id); setRelationTargetId(t.id); setRelationSearch(""); setRelationFocused(false); relationInputRef.current?.blur(); }}
                    >
                      {t.title}
                    </li>
                  ))}
                </ul>
              )}
              {relationTargetId && (
                <div className="text-sm text-muted-foreground px-3 py-1.5 border border-border bg-muted/20">
                  Selected: <span className="font-medium">{otherTasks.find(t => t.id === relationTargetId)?.title}</span>
                </div>
              )}
              <Button type="button" size="sm" aria-label="Add relation" onClick={addRelation} disabled={!relationTargetId}>Add</Button>
            </div>
          </div>
        </Section>

        <Section title="Attachments" shape="▶">
          <div className="flex flex-col gap-2">
            {form.attachments.length === 0 ? (
              <p className="text-muted-foreground">None yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {form.attachments.map((a, i) => (
                  editingAttachmentIndex === i ? (
                    <li key={i} className="flex flex-col gap-2 border border-border p-2 bg-muted/20">
                      <div className="flex gap-2">
                        <select aria-label="Attachment type" className={FIELD} value={attachmentType} onChange={(e) => setAttachmentType(e.target.value as AttachmentType)}>
                          {ATTACHMENT_TYPES.map((t) => (
                            <option key={t} value={t}>{humanize(t)}</option>
                          ))}
                        </select>
                        <input aria-label="Attachment label" className={FIELD} placeholder="Label" value={attachmentLabel} onChange={(e) => setAttachmentLabel(e.target.value)} />
                      </div>
                      <input aria-label="Attachment URL" className={FIELD} placeholder="URL" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} />
                      <div className="flex gap-1 justify-end">
                        <Button type="button" size="sm" onClick={() => {
                          const newAttachments = [...form.attachments];
                          newAttachments[i] = { type: attachmentType, label: attachmentLabel, url: attachmentUrl };
                          set("attachments", newAttachments);
                          setEditingAttachmentIndex(null);
                          setAttachmentType("github_pr");
                          setAttachmentLabel("");
                          setAttachmentUrl("");
                        }}>Save</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingAttachmentIndex(null)}>Cancel</Button>
                      </div>
                    </li>
                  ) : (
                    <li key={i} className="flex flex-col gap-1 border border-border p-2 bg-muted/20 cursor-pointer hover:bg-muted/30" onClick={() => {
                      setAttachmentType(a.type);
                      setAttachmentLabel(a.label);
                      setAttachmentUrl(a.url || "");
                      setEditingAttachmentIndex(i);
                    }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground capitalize text-xs">{humanize(a.type)}</span>
                        <span className="flex-1 text-right text-sm">{a.label}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeAttachment(i); }} className="shrink-0" style={{ color: "var(--color-status-blocked)" }}>
                          ✕
                        </button>
                      </div>
                      {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary truncate hover:underline">{a.url}</a>}
                    </li>
                  )
                ))}
              </ul>
            )}
            {editingAttachmentIndex === null && (
              <div className="flex flex-col gap-2 border-t border-border pt-2">
                <div className="flex gap-2">
                  <select aria-label="Attachment type" className={FIELD} value={attachmentType} onChange={(e) => setAttachmentType(e.target.value as AttachmentType)}>
                    {ATTACHMENT_TYPES.map((t) => (
                      <option key={t} value={t}>{humanize(t)}</option>
                    ))}
                  </select>
                  <input aria-label="Attachment label" className={FIELD} placeholder="Label" value={attachmentLabel} onChange={(e) => setAttachmentLabel(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <input aria-label="Attachment URL" className={FIELD} placeholder="URL (optional)" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} />
                  <Button type="button" size="sm" aria-label="Add attachment" onClick={addAttachment} disabled={!attachmentLabel.trim()}>Add</Button>
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section title="Deliverables" shape="◆">
          <div className="flex flex-col gap-2">
            {form.deliverables.length === 0 ? (
              <p className="text-muted-foreground">None yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {form.deliverables.map((d, i) => (
                  editingDeliverableIndex === i ? (
                    <li key={i} className="flex flex-col gap-2 border border-border p-2 bg-muted/20">
                      <div className="flex gap-2">
                        <select aria-label="Deliverable type" className={FIELD} value={deliverableType} onChange={(e) => setDeliverableType(e.target.value as DeliverableType)}>
                          {DELIVERABLE_TYPES.map((t) => (
                            <option key={t} value={t}>{humanize(t)}</option>
                          ))}
                        </select>
                        <input aria-label="Deliverable label" className={FIELD} placeholder="Label" value={deliverableLabel} onChange={(e) => setDeliverableLabel(e.target.value)} />
                      </div>
                      <input aria-label="Deliverable URL" className={FIELD} placeholder="URL (optional)" value={deliverableUrl} onChange={(e) => setDeliverableUrl(e.target.value)} />
                      <div className="flex gap-1 justify-end">
                        <Button type="button" size="sm" onClick={() => {
                          const newDeliverables = [...form.deliverables];
                          newDeliverables[i] = { type: deliverableType, label: deliverableLabel, url: deliverableUrl || undefined };
                          set("deliverables", newDeliverables);
                          setEditingDeliverableIndex(null);
                          setDeliverableType("pr");
                          setDeliverableLabel("");
                          setDeliverableUrl("");
                        }}>Save</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingDeliverableIndex(null)}>Cancel</Button>
                      </div>
                    </li>
                  ) : (
                    <li key={i} className="flex flex-col gap-1 border border-border p-2 bg-muted/20 cursor-pointer hover:bg-muted/30" onClick={() => {
                      setDeliverableType(d.type);
                      setDeliverableLabel(d.label);
                      setDeliverableUrl(d.url || "");
                      setEditingDeliverableIndex(i);
                    }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground capitalize text-xs">{humanize(d.type)}</span>
                        <span className="flex-1 text-right text-sm">{d.label}</span>
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeDeliverable(i); }} className="shrink-0" style={{ color: "var(--color-status-blocked)" }}>
                          ✕
                        </button>
                      </div>
                      {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary truncate hover:underline">{d.url}</a>}
                    </li>
                  )
                ))}
              </ul>
            )}
            {editingDeliverableIndex === null && (
              <div className="flex flex-col gap-2 border-t border-border pt-2">
                <div className="flex gap-2">
                  <select aria-label="Deliverable type" className={FIELD} value={deliverableType} onChange={(e) => setDeliverableType(e.target.value as DeliverableType)}>
                    {DELIVERABLE_TYPES.map((t) => (
                      <option key={t} value={t}>{humanize(t)}</option>
                    ))}
                  </select>
                  <input aria-label="Deliverable label" className={FIELD} placeholder="Label" value={deliverableLabel} onChange={(e) => setDeliverableLabel(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <input aria-label="Deliverable URL" className={FIELD} placeholder="URL (optional)" value={deliverableUrl} onChange={(e) => setDeliverableUrl(e.target.value)} />
                  <Button type="button" size="sm" aria-label="Add deliverable" onClick={addDeliverable} disabled={!deliverableLabel.trim()}>Add</Button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {mode === "edit" && task && (
          <>
            <Section title="Comments" shape="💬">
              <div className="flex flex-col gap-2">
                <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto border-b border-border pb-2">
                  {(!liveTask?.comments || liveTask.comments.length === 0) ? (
                    <li className="text-xs text-muted-foreground italic">No comments yet</li>
                  ) : (
                    liveTask.comments.map((c) => (
                      <li key={c.id} className="flex flex-col gap-0.5 text-xs bg-muted/30 p-1.5 border border-border">
                        <div className="flex justify-between font-bold text-muted-foreground">
                          <span>{c.authorName}</span>
                          <span>{new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-foreground">{c.content}</p>
                      </li>
                    ))
                  )}
                </ul>
                <CommentInput taskId={task.id} />
              </div>
            </Section>

            <TaskNoteLinks taskId={task.id} />

            <Section title="History" shape="◫">
              <ul className="flex flex-col gap-1">
                {task.statusHistory.map((h, i) => (
                  <li key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {h.fromStatus ? STATUS_LABEL[h.fromStatus] : "Created"} → {STATUS_LABEL[h.toStatus]}
                    </span>
                    <span className="text-muted-foreground">{new Date(h.changedAt).toLocaleDateString()} {new Date(h.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border p-4" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
        <Button type="button" variant="ghost" onClick={closeForm} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "⋳ Saving..." : <><Check size={12} />{mode === "edit" ? "Save Changes" : "Create Quest"}</> }</Button>
      </div>
    </form>
  );
}

function CommentInput({ taskId }: { taskId: string }) {
  const { addComment } = useTasks();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || loading) return;
    setLoading(true);
    try {
      await addComment(taskId, content.trim());
      setContent("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-1.5 mt-1" autoComplete="off">
      <input
        aria-label="Add a comment"
        className="flex-1 text-xs bg-background border border-border px-2 py-1 text-foreground focus:outline-none focus:border-primary-gold"
        placeholder="Type a comment..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={loading}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e as any);
          }
        }}
      />
      <Button type="button" size="sm" disabled={!content.trim() || loading} onClick={(e) => {
        e.preventDefault();
        handleSubmit(e as any);
      }}>
        Post
      </Button>
    </form>
  );
}
