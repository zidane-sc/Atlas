"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { Check, ChevronDown, Copy, Trash2, Info, Pin, Bot, Cpu, ExternalLink, Clock, Sparkles, Search, X, Pencil, Upload } from "lucide-react";
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
import { getTaskDetails, type TaskAgentDetails } from "@/lib/actions/tasks";
import type { TaskComment, TaskStatusLogEntry } from "@/types/task";
import { PriorityMark, PRIORITY_SHAPE_GLYPH } from "./PriorityMark";
import { StatusBadge } from "./StatusBadge";
import {
  ATTACHMENT_TYPES,
  DELIVERABLE_TYPES,
  RELATION_TYPES,
  REPORTER_OPTIONS,
  SIZE_OPTIONS,
  taskFormSchema,
  type TaskFormValues,
} from "@/lib/schemas/task";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { sortProjectsForPicker } from "@/lib/picker-sort";
import { sortTasksForPicker } from "@/lib/picker-sort";
import { handleDropdownKeydown, type DropdownNavState } from "@/lib/dropdown-nav";
import { updateDrawerLastSelectedAction } from "@/lib/actions/user";
import { STATUS_LABEL, STATUS_COLOR_VAR, STATUS_SHAPE, PRIORITY_COLOR_VAR, PRIORITY_SHAPE, TYPE_ICON } from "@/lib/mock-data";
import type {
  AttachmentType,
  DeliverableType,
  Priority,
  RelationType,
  Task,
  TaskAttachment,
  TaskDeliverable,
  TaskRelation,
  TaskStatus,
  TaskType,
  TaskSize,
  Reporter,
} from "@/types/task";

function Section({ title, shape, defaultOpen = false, children }: { title: string; shape: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="border-2 border-border">
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-semibold tracking-widest text-foreground hover:bg-[var(--color-bg-panel-alt)] transition-colors cursor-pointer select-none">
        <span className="flex items-center gap-2">
          <span style={{ color: "var(--color-primary-gold)" }}>{shape}</span>
          <span>{title}</span>
        </span>
        <ChevronDown size={14} className="transition-transform duration-200 group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t-2 border-border px-3 py-3 text-sm">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function CopyButton({ text, label, className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      title="Copy to clipboard"
      className={className || "inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-cyan-400 p-1 rounded cursor-pointer transition-colors"}
    >
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      {label && <span>{copied ? "Copied" : label}</span>}
    </button>
  );
}

function formatDuration(startedAt: string, endedAt?: string | null) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hours}h ${remainMins}m`;
}

const EMPTY_FORM: Omit<TaskFormValues, "project"> = {
  title: "",
  status: "backlog",
  type: "coding",
  priority: "medium",
  reporter: "self",
  tags: [],
  relations: [],
  attachments: [],
  deliverables: [],
  startDate: undefined,
  size: undefined,
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
      <SheetContent
        className="w-full inset-0 max-w-full sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[520px] sm:max-w-[520px] gap-0 overflow-y-auto border-l-2 border-border p-0 rounded-none"
      >
        {sheet.open && <TaskFormBody key={sheet.task?.id ?? "create"} mode={sheet.mode} task={sheet.task} />}
      </SheetContent>
    </Sheet>
  );
}

function TaskFormBody({ mode, task }: { mode: "create" | "edit"; task: Task | null }) {
  const { tasks, allTimeTasks, closeForm, openEditForm, createTask, updateTask, deleteTask, duplicateTask, togglePin, activeTimer, startTimer, stopTimer, switchPhase, lastSyncEvent } = useTasks();
  const { projects } = useProjects();
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
          size: task.size,
          startDate: task.startDate,
          dueDate: task.dueDate,
          waitingOn: task.waitingOn,
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

  const [relationType, setRelationType] = useState<RelationType>("relates_to");
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
  const relationPickerRef = useRef<HTMLDivElement>(null);
  const [relationSelectedIndex, setRelationSelectedIndex] = useState(-1);
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectSelectedIndex, setProjectSelectedIndex] = useState(-1);
  const projectPickerRef = useRef<HTMLDivElement>(null);
  const projectSearchInputRef = useRef<HTMLInputElement>(null);
  const [editingAttachmentIndex, setEditingAttachmentIndex] = useState<number | null>(null);
  const [editingDeliverableIndex, setEditingDeliverableIndex] = useState<number | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const currentTask = useMemo(
    () => (task ? tasks.find((t) => t.id === task.id) || task : null),
    [task, tasks]
  );

  const otherTasks = useMemo(() => tasks.filter((t) => t.id !== task?.id), [tasks, task?.id]);
  // Relations store a denormalized (taskId, title) snapshot with no live FK check — a related
  // task that's since been trashed just renders its stale cached title forever with no signal
  // (docs/05-backlog.md §8 finding #5). allTimeTasks is the best available existence check since
  // it covers more history than the 200-cap `tasks`, though very old non-done targets outside
  // both lists could still show a false "trashed" — an accepted, documented edge case.
  const liveTaskIds = useMemo(() => new Set(allTimeTasks.map((t) => t.id)), [allTimeTasks]);

  // Full status history + comments are no longer part of the bulk task fetch (performance —
  // docs/05-backlog.md §8 finding #16), so fetch them on-demand here, the only place either
  // is displayed.
  const [taskDetail, setTaskDetail] = useState<{
    tags?: string[];
    relations?: any[];
    attachments?: any[];
    deliverables?: any[];
    statusHistory: TaskStatusLogEntry[];
    comments: TaskComment[];
    agent?: TaskAgentDetails;
  } | null>(null);
  const [taskDetailLoading, setTaskDetailLoading] = useState(mode === "edit" && !!task);
  const [showCheckpointHistory, setShowCheckpointHistory] = useState(false);

  const refreshTaskDetail = async () => {
    if (!task) return;
    try {
      const result = await getTaskDetails(task.id);
      if (result.success) {
        setTaskDetail(result.data);
      }
    } catch (err) {
      console.warn("Failed to refresh task details:", err);
    }
  };

  useEffect(() => {
    if (mode !== "edit" || !task) return;
    let cancelled = false;
    setTaskDetailLoading(true);
    (async () => {
      try {
        const result = await getTaskDetails(task.id);
        if (!cancelled && result.success) {
          setTaskDetail(result.data);
          // Sync live attachments/deliverables/relations into form state if present
          if (result.data.attachments && result.data.attachments.length > 0) {
            setForm((prev) => ({ ...prev, attachments: result.data.attachments }));
          }
          if (result.data.deliverables && result.data.deliverables.length > 0) {
            setForm((prev) => ({ ...prev, deliverables: result.data.deliverables }));
          }
          if (result.data.relations && result.data.relations.length > 0) {
            setForm((prev) => ({ ...prev, relations: result.data.relations }));
          }
        }
      } catch (err) {
        console.warn("Failed to load task details:", err);
      } finally {
        if (!cancelled) {
          setTaskDetailLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, task?.id]);

  // Live auto-refresh when an SSE update for this specific task arrives (e.g. from MCP)
  useEffect(() => {
    if (!lastSyncEvent || !task) return;
    const targetId = lastSyncEvent.data?.taskId || lastSyncEvent.data?.id;
    if (targetId === task.id) {
      void refreshTaskDetail();
    }
  }, [lastSyncEvent, task?.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (projectPickerRef.current && !projectPickerRef.current.contains(e.target as Node)) {
        setIsProjectPickerOpen(false);
      }
    };
    if (isProjectPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isProjectPickerOpen]);

  const filteredProjects = useMemo(() => {
    const list = sortProjectsForPicker(projects);
    if (!projectSearch.trim()) return list;
    const q = projectSearch.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        p.category.toLowerCase().includes(q)
    );
  }, [projectSearch, projects]);

  const selectedProject = useMemo(() => {
    return projects.find((p) => p.name === form.project);
  }, [projects, form.project]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (relationPickerRef.current && !relationPickerRef.current.contains(e.target as Node)) {
        setRelationFocused(false);
      }
    };
    if (relationFocused) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [relationFocused]);

  const relationOptions = useMemo(() => {
    const q = relationSearch.trim().toLowerCase();
    if (!q) return sortTasksForPicker(otherTasks).slice(0, 8);
    return otherTasks
      .filter((t) => t.title.toLowerCase().includes(q) || (t.code && t.code.toLowerCase().includes(q)))
      .slice(0, 8);
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
    const deliverable: TaskDeliverable = { type: deliverableType, label: deliverableLabel.trim(), urlOrContent: deliverableUrl.trim() || undefined };
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

  const previewXP = calcTaskXP(form.priority, form.size, true);
  const previewCoins = calcTaskCoins(form.priority, form.size);

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

  const isAgentTask = Boolean(
    task && (
      task.reporter === "agent" ||
      (task as any)?.metadata?.agentReporter === "agent" ||
      !!(task as any)?.metadata?.createdByAgent ||
      !!(task as any)?.waitingReason ||
      ((taskDetail?.agent?.runs?.length ?? 0) > 0) ||
      ((taskDetail?.agent?.checkpoints?.length ?? 0) > 0)
    )
  );

  return (
    <form onSubmit={onSubmit} className="flex flex-col">
      <SheetHeader
        className="flex-row items-center justify-between gap-2 space-y-0 border-b border-border py-3 px-4"
        style={{ backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <div className="flex items-center gap-2">
          <SheetTitle className="font-display" style={{ fontSize: "13px", color: "var(--color-primary-gold)" }}>
            {mode === "edit" ? "◈ QUEST DETAIL" : "+ NEW QUEST"}
          </SheetTitle>
          {mode === "edit" && currentTask && (
            <span className="text-sm font-mono font-bold" style={{ color: "var(--color-primary-gold)", minWidth: "50px" }}>
              {currentTask.code}
            </span>
          )}
          {isAgentTask && (
            <span className="px-2 py-0.5 text-xs font-mono font-bold border border-cyan-500/50 bg-cyan-950/60 text-cyan-300 flex items-center gap-1">
              <Bot size={13} /> MCP SPAWNED
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
        <span className="flex items-center gap-1" style={{ color: "var(--color-xp-gold)" }} title={`XP = (Base XP + SP * 10) * (On-Time 1.2x)\nBase XP: P0: 100, P1: 60, P2: 30, P3: 15, P4: 5`}>
          ⚡ +{previewXP} XP on complete <Info size={12} className="opacity-50" style={{ cursor: "help" }} />
        </span>
        <span className="flex items-center gap-1" style={{ color: "var(--color-coin)" }} title={`Coins = Story Points + Priority Bonus\nBonus: P0: +5, P1: +3, P2: +1, P3/P4: 0`}>
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

      {mode === "edit" && task && liveTask && (
        <div className="shrink-0">
          <BattleTimer
            task={liveTask}
            isTiming={isTiming}
            totalSeconds={totalSeconds}
            onStart={() => startTimer(task.id)}
            onStop={stopTimer}
            phase={activeTimer?.phase}
          />
        </div>
      )}

      {/* Form body */}
      <div className="flex flex-col gap-3 p-4 pt-3 pb-24">
        <Section title="Core" shape="■" defaultOpen={true}>
          <div className="flex flex-col gap-4">
            {/* 1. Status Segmented Buttons */}
            <div>
              <label className={LC}>Status</label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((s) => {
                  const isSelected = form.status === s;
                  const colorVar = STATUS_COLOR_VAR[s];
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set("status", s)}
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-mono font-bold border-2 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-secondary text-foreground shadow-[2px_2px_0_rgba(0,0,0,0.8)]"
                          : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                      style={{
                        borderColor: isSelected ? `var(${colorVar})` : undefined,
                        color: isSelected ? `var(${colorVar})` : undefined,
                      }}
                    >
                      <span className="text-sm leading-none" style={{ color: `var(${colorVar})` }}>{STATUS_SHAPE[s]}</span>
                      <span className="truncate">{STATUS_LABEL[s]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Priority & Complexity Size Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Priority */}
              <div>
                <label className={`${LC} flex items-center justify-between`}>
                  <span>Priority</span>
                  <span className="text-[11px] font-normal text-muted-foreground">P0 · P1 · P2</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["high", "medium", "low"] as Priority[]).map((p) => {
                    const isSelected = form.priority === p;
                    const colorVar = PRIORITY_COLOR_VAR[p];
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => set("priority", p)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-mono font-bold border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-secondary text-foreground shadow-[2px_2px_0_rgba(0,0,0,0.8)]"
                            : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                        style={{
                          borderColor: isSelected ? `var(${colorVar})` : undefined,
                          color: isSelected ? `var(${colorVar})` : undefined,
                        }}
                      >
                        <span>{PRIORITY_SHAPE_GLYPH[PRIORITY_SHAPE[p]]}</span>
                        <span>{p.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Size */}
              <div>
                <label className={`${LC} flex items-center justify-between`}>
                  <span>Complexity / Size</span>
                  <span className="text-[11px] font-normal text-muted-foreground">XS(&lt;1h) · M(2-4h) · XL</span>
                </label>
                <div className="grid grid-cols-6 gap-1">
                  {[undefined, ...SIZE_OPTIONS].map((sz) => {
                    const isSelected = form.size === sz;
                    return (
                      <button
                        key={sz ?? "none"}
                        type="button"
                        onClick={() => set("size", sz)}
                        className={`py-2 text-center text-xs font-mono font-bold border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/15 text-primary shadow-[2px_2px_0_rgba(0,0,0,0.8)]"
                            : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                      >
                        {sz ? sz.toUpperCase() : "—"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Quest Type Chip Grid */}
            <div>
              <label className={LC}>Quest Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(Object.keys(TYPE_ICON) as TaskType[]).map((t) => {
                  const isSelected = form.type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("type", t)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 text-xs font-mono border-2 transition-all cursor-pointer ${
                        isSelected
                          ? "border-primary bg-primary/15 text-foreground font-bold shadow-[2px_2px_0_rgba(0,0,0,0.8)]"
                          : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      <span className="text-base shrink-0">{TYPE_ICON[t]}</span>
                      <span className="truncate">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Dynamic Project & Due Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Dynamic Project Picker */}
              <div className="relative" ref={projectPickerRef}>
                <label className={LC}>Project *</label>
                <button
                  type="button"
                  onClick={() => setIsProjectPickerOpen((o) => !o)}
                  className={`w-full flex items-center justify-between p-2.5 border-2 bg-secondary text-left transition-colors cursor-pointer ${
                    isProjectPickerOpen ? "border-primary ring-1 ring-primary" : errors.project ? "border-status-blocked" : "border-border"
                  }`}
                  style={{
                    borderLeftColor: selectedProject ? (selectedProject.customColor || `var(${selectedProject.colorVar})`) : undefined,
                    borderLeftWidth: selectedProject ? "4px" : "2px"
                  }}
                >
                  {selectedProject ? (
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">{selectedProject.emoji}</span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-foreground truncate flex items-center gap-1.5">
                          <span>{selectedProject.name}</span>
                          {selectedProject.code && (
                            <span className="text-xs font-mono font-normal text-muted-foreground px-1 border border-border/60 bg-card">
                              {selectedProject.code}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono text-muted-foreground capitalize">
                          [{selectedProject.category}] · {selectedProject.status}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>📂</span>
                      <span>Select project...</span>
                    </span>
                  )}
                  <ChevronDown size={14} className={`text-muted-foreground transition-transform duration-200 shrink-0 ${isProjectPickerOpen ? "rotate-180 text-primary" : ""}`} />
                </button>

                {/* Project Popover */}
                {isProjectPickerOpen && (
                  <div
                    className="absolute top-full left-0 right-0 z-50 mt-1 max-h-72 overflow-hidden flex flex-col border-2 border-primary bg-[var(--color-bg-panel)] shadow-[4px_4px_0_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-100"
                  >
                    {/* Search filter in project dropdown */}
                    <div className="p-2 border-b border-border bg-secondary/80 flex items-center gap-2">
                      <Search size={14} className="text-muted-foreground shrink-0" />
                      <input
                        ref={projectSearchInputRef}
                        type="text"
                        placeholder="Filter projects by name or code..."
                        value={projectSearch}
                        onChange={(e) => {
                          setProjectSearch(e.target.value);
                          setProjectSelectedIndex(-1);
                        }}
                        onKeyDown={(e) => {
                          const newState = handleDropdownKeydown(
                            e,
                            { selected: projectSelectedIndex, total: filteredProjects.length },
                            (idx) => {
                              const p = filteredProjects[idx];
                              if (p) {
                                void updateDrawerLastSelectedAction("project", p.id);
                                set("project", p.name);
                                setProjectSearch("");
                                setIsProjectPickerOpen(false);
                              }
                            },
                            () => setIsProjectPickerOpen(false)
                          );
                          setProjectSelectedIndex(newState.selected);
                        }}
                        className="w-full bg-transparent text-xs font-mono text-foreground outline-none placeholder:text-muted-foreground"
                        autoFocus
                      />
                      {projectSearch && (
                        <button type="button" onClick={() => setProjectSearch("")} className="text-muted-foreground hover:text-foreground">
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto max-h-56 p-1 space-y-1">
                      {filteredProjects.length === 0 ? (
                        <div className="p-4 text-center text-xs font-mono text-muted-foreground italic">
                          No project matching &quot;{projectSearch}&quot;
                        </div>
                      ) : (
                        filteredProjects.map((p, idx) => {
                          const isSelected = form.project === p.name;
                          const isHighlighted = projectSelectedIndex === idx;
                          return (
                            <div
                              key={p.id}
                              onClick={() => {
                                set("project", p.name);
                                void updateDrawerLastSelectedAction("project", p.id);
                                setIsProjectPickerOpen(false);
                                setProjectSearch("");
                              }}
                              onMouseEnter={() => setProjectSelectedIndex(idx)}
                              className={`flex items-center justify-between p-2 border transition-all cursor-pointer ${
                                isSelected
                                  ? "border-primary bg-primary/15 text-foreground font-semibold"
                                  : isHighlighted
                                  ? "border-border bg-secondary text-foreground"
                                  : "border-transparent hover:border-border hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                              }`}
                              style={{
                                borderLeftColor: p.customColor || `var(${p.colorVar})`,
                                borderLeftWidth: "3px"
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base shrink-0">{p.emoji}</span>
                                <div className="min-w-0">
                                  <div className="text-xs font-mono font-bold text-foreground truncate flex items-center gap-1.5">
                                    <span>{p.name}</span>
                                    {p.code && <span className="text-[10px] text-muted-foreground font-normal">({p.code})</span>}
                                  </div>
                                  {p.description && (
                                    <div className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                                      {p.description}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-[10px] font-mono px-1.5 py-0.2 border border-border/50 bg-secondary text-muted-foreground">
                                  {p.category}
                                </span>
                                {isSelected && <Check size={14} className="text-primary font-bold" />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
                {errors.project && <p className="mt-1 text-sm" style={{ color: "var(--color-status-blocked)" }}>{errors.project}</p>}
              </div>

              {/* Due Date Picker */}
              <div>
                <label className={`${LC} flex items-center justify-between`}>
                  <span>Due Date</span>
                  {form.dueDate && (
                    <button
                      type="button"
                      onClick={() => set("dueDate", undefined)}
                      className="text-xs font-mono text-muted-foreground hover:text-red-400 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </label>
                <DatePicker
                  value={form.dueDate}
                  onChange={(date) => set("dueDate", date ? date : undefined)}
                />
              </div>
            </div>

            {/* 5. Description */}
            <div>
              <label className={LC}>Description</label>
              <textarea
                aria-label="Description"
                className={`${FIELD} resize-none font-sans text-sm leading-relaxed`}
                rows={4}
                value={form.description ?? ""}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Context, acceptance criteria, reproduction steps..."
              />
            </div>

            {/* 6. Reporter & Optional Waiting On */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className={LC}>Reporter</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {REPORTER_OPTIONS.map((r) => {
                    const isSelected = (form.reporter ?? "self") === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => set("reporter", r)}
                        className={`flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-mono border-2 transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/15 text-foreground font-bold shadow-[2px_2px_0_rgba(0,0,0,0.8)]"
                            : "border-border/60 bg-secondary/30 text-muted-foreground hover:border-border hover:text-foreground"
                        }`}
                      >
                        <span>{r === "agent" ? "🤖" : r === "self" ? "👤" : "👥"}</span>
                        <span>{humanize(r)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {form.status === "in_progress" ? (
                <div>
                  <label className={LC}>Waiting On / Blocker</label>
                  <input
                    aria-label="Waiting On"
                    className={FIELD}
                    value={form.waitingOn ?? ""}
                    onChange={(e) => set("waitingOn", e.target.value)}
                    placeholder="Who / what / PR review..."
                  />
                </div>
              ) : <div />}
            </div>

            {/* 7. Tags */}
            <div>
              <label className={LC}>Tags</label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {form.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1.5 border border-border bg-secondary/50 px-2 py-0.5 text-xs font-mono text-foreground"
                  >
                    #{t}
                    <button
                      type="button"
                      onClick={() => removeTag(t)}
                      className="hover:opacity-70 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                      title="Remove tag"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                {form.tags.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">No tags yet.</span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  aria-label="Tag"
                  className={`${FIELD} flex-1`}
                  placeholder="Add tag (e.g. backend, bugfix)..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button type="button" size="sm" onClick={addTag} disabled={!tagInput.trim()}>
                  Add
                </Button>
              </div>
            </div>
          </div>
        </Section>

        <Section title={`Relations ${form.relations.length ? `(${form.relations.length})` : ""}`} shape="◈" defaultOpen={form.relations.length > 0}>
          <div className="flex flex-col gap-3">
            {form.relations.length === 0 ? (
              <div className="p-3 border-2 border-dashed border-border/80 bg-secondary/20 text-center select-none">
                <p className="text-xs font-mono text-muted-foreground italic">
                  🔗 No quest dependencies or related tickets linked yet.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {form.relations.map((r) => {
                  const targetTask = tasks.find((t) => t.id === r.taskId) || allTimeTasks.find((t) => t.id === r.taskId);
                  const isGone = !liveTaskIds.has(r.taskId);
                  return (
                    <li
                      key={r.taskId}
                      className="flex items-center justify-between gap-2 p-2 bg-secondary/40 border border-border text-xs font-mono hover:bg-secondary/70 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`text-[10px] uppercase font-bold px-1.5 py-0.5 border shrink-0 ${
                            r.relationType === "blocks"
                              ? "border-red-500/50 text-red-400 bg-red-950/30"
                              : r.relationType === "duplicates"
                              ? "border-purple-500/50 text-purple-400 bg-purple-950/30"
                              : "border-cyan-500/50 text-cyan-400 bg-cyan-950/30"
                          }`}
                        >
                          {r.relationType === "blocks" ? "⛔ BLOCKS" : r.relationType === "duplicates" ? "📑 DUPLICATES" : "🔗 RELATES TO"}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (targetTask) openEditForm(targetTask);
                          }}
                          className={`truncate text-left hover:underline cursor-pointer flex items-center gap-1.5 ${
                            isGone ? "text-muted-foreground italic" : "text-foreground font-medium"
                          }`}
                          title={r.title}
                        >
                          {targetTask?.code && (
                            <span className="text-[var(--color-primary-gold)] font-bold shrink-0">
                              [{targetTask.code}]
                            </span>
                          )}
                          <span className="truncate">{r.title}{isGone && " (trashed)"}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {targetTask && (
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.2 border shrink-0"
                            style={{
                              borderColor: `var(${STATUS_COLOR_VAR[targetTask.status]})`,
                              color: `var(${STATUS_COLOR_VAR[targetTask.status]})`
                            }}
                          >
                            {STATUS_LABEL[targetTask.status]}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeRelation(r.taskId)}
                          className="p-1 hover:text-red-400 text-muted-foreground font-bold transition-colors cursor-pointer"
                          title="Remove relation"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Link Quest Form */}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-muted-foreground uppercase">
                <span>+ Link Another Quest</span>
                <span className="text-[10px] font-normal lowercase">search by code or title</span>
              </div>

              {/* Relation Type segmented selector */}
              <div className="flex flex-wrap gap-1">
                {RELATION_TYPES.map((rt) => (
                  <button
                    key={rt}
                    type="button"
                    onClick={() => setRelationType(rt)}
                    className={`px-2.5 py-1 text-xs font-mono font-bold border transition-all cursor-pointer ${
                      relationType === rt
                        ? "border-primary bg-primary/20 text-foreground shadow-[1px_1px_0_rgba(0,0,0,0.8)]"
                        : "border-border/70 bg-secondary text-muted-foreground hover:border-border hover:text-foreground"
                    }`}
                  >
                    {rt === "blocks" ? "⛔ Blocks" : rt === "relates_to" ? "🔗 Relates to" : "📑 Duplicates"}
                  </button>
                ))}
              </div>

              {/* Selected Target Preview or Search Box */}
              {relationTargetId ? (
                (() => {
                  const target = otherTasks.find(t => t.id === relationTargetId);
                  return (
                    <div className="flex items-center justify-between gap-2 p-2.5 border-2 border-primary bg-primary/10">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base">🔗</span>
                        <div className="min-w-0">
                          <div className="text-xs font-mono font-bold text-foreground truncate flex items-center gap-1.5">
                            {target?.code && <span className="text-[var(--color-primary-gold)]">[{target.code}]</span>}
                            <span>{target?.title || "Selected Task"}</span>
                          </div>
                          {target && (
                            <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                              {target.project || "No Project"} · {STATUS_LABEL[target.status]} · {target.priority.toUpperCase()}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button type="button" size="sm" onClick={addRelation} className="font-bold">
                          Add Link
                        </Button>
                        <button
                          type="button"
                          onClick={() => { setRelationTargetId(""); setRelationSearch(""); }}
                          className="text-xs font-mono text-muted-foreground hover:text-red-400 px-2 py-1 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="relative" ref={relationPickerRef}>
                  <div className="relative flex items-center">
                    <Search size={14} className="absolute left-2.5 text-muted-foreground pointer-events-none" />
                    <input
                      ref={relationInputRef}
                      aria-label="Search quest to link"
                      className={`${FIELD} pl-8`}
                      placeholder="Search quest by code (e.g. ATS-28) or title..."
                      value={relationSearch}
                      onChange={(e) => {
                        setRelationSearch(e.target.value);
                        setRelationSelectedIndex(-1);
                        setRelationFocused(true);
                      }}
                      onFocus={() => {
                        setRelationFocused(true);
                        setRelationSelectedIndex(-1);
                      }}
                      onKeyDown={(e) => {
                        const newState = handleDropdownKeydown(
                          e,
                          { selected: relationSelectedIndex, total: relationOptions.length },
                          (idx) => {
                            const t = relationOptions[idx];
                            if (t) {
                              void updateDrawerLastSelectedAction("task", t.id);
                              setRelationTargetId(t.id);
                              setRelationSearch("");
                              setRelationFocused(false);
                            }
                          },
                          () => setRelationFocused(false)
                        );
                        setRelationSelectedIndex(newState.selected);
                      }}
                    />
                    {relationSearch && (
                      <button
                        type="button"
                        onClick={() => { setRelationSearch(""); setRelationFocused(false); }}
                        className="absolute right-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {relationFocused && relationOptions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto border-2 border-primary bg-[var(--color-bg-panel)] shadow-[4px_4px_0_rgba(0,0,0,0.8)] p-1 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      {relationOptions.map((t, idx) => (
                        <div
                          key={t.id}
                          onMouseEnter={() => setRelationSelectedIndex(idx)}
                          onClick={() => {
                            void updateDrawerLastSelectedAction("task", t.id);
                            setRelationTargetId(t.id);
                            setRelationSearch("");
                            setRelationFocused(false);
                          }}
                          className={`flex items-center justify-between p-2 border transition-all cursor-pointer ${
                            relationSelectedIndex === idx
                              ? "border-primary bg-primary/20 text-foreground"
                              : "border-transparent hover:border-border hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {t.code && (
                              <span className="text-xs font-mono font-bold text-[var(--color-primary-gold)] shrink-0">
                                {t.code}
                              </span>
                            )}
                            <span className="text-xs font-mono font-medium text-foreground truncate">
                              {t.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 ml-2 font-mono text-[10px]">
                            {t.project && (
                              <span className="px-1 py-0.2 border border-border/50 bg-secondary text-muted-foreground truncate max-w-[80px]">
                                {t.project}
                              </span>
                            )}
                            <span
                              className="px-1 py-0.2 border"
                              style={{
                                borderColor: `var(${STATUS_COLOR_VAR[t.status]})`,
                                color: `var(${STATUS_COLOR_VAR[t.status]})`
                              }}
                            >
                              {STATUS_LABEL[t.status]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Section>

        <Section title={`Attachments ${form.attachments.length ? `(${form.attachments.length})` : ""}`} shape="▶" defaultOpen={form.attachments.length > 0}>
          <div className="flex flex-col gap-3">
            {form.attachments.length === 0 ? (
              <div className="p-3 border-2 border-dashed border-border/80 bg-secondary/20 text-center select-none">
                <p className="text-xs font-mono text-muted-foreground italic">
                  📎 No links, PRs, or file attachments added yet.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {form.attachments.map((a, i) => {
                  const isEditing = editingAttachmentIndex === i;
                  if (isEditing) {
                    return (
                      <div key={i} className="flex flex-col gap-2 p-3 border-2 border-primary bg-secondary/80">
                        <div className="text-xs font-mono font-bold text-primary flex items-center justify-between">
                          <span>✏️ Edit Attachment #{i + 1}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {ATTACHMENT_TYPES.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setAttachmentType(t)}
                              className={`px-2 py-1 text-xs font-mono font-bold border transition-all cursor-pointer ${
                                attachmentType === t
                                  ? "border-primary bg-primary/20 text-foreground shadow-[1px_1px_0_rgba(0,0,0,0.8)]"
                                  : "border-border/70 bg-secondary text-muted-foreground hover:border-border hover:text-foreground"
                              }`}
                            >
                              {t === "github_pr" ? "🐙 PR" : t === "github_issue" ? "🎯 Issue" : t === "link" ? "🔗 Link" : t === "file" ? "📁 File" : "📦 Other"}
                            </button>
                          ))}
                        </div>
                        <input
                          aria-label="Attachment label"
                          className={FIELD}
                          placeholder="Label / Title"
                          value={attachmentLabel}
                          onChange={(e) => setAttachmentLabel(e.target.value)}
                        />
                        <input
                          aria-label="Attachment URL"
                          className={FIELD}
                          placeholder="URL"
                          value={attachmentUrl}
                          onChange={(e) => setAttachmentUrl(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end pt-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const newAttachments = [...form.attachments];
                              newAttachments[i] = { type: attachmentType, label: attachmentLabel, url: attachmentUrl };
                              set("attachments", newAttachments);
                              setEditingAttachmentIndex(null);
                              setAttachmentType("github_pr");
                              setAttachmentLabel("");
                              setAttachmentUrl("");
                            }}
                          >
                            Save Changes
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingAttachmentIndex(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 p-2 border border-border bg-secondary/40 text-xs font-mono hover:bg-secondary/70 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 border border-border/80 bg-secondary text-[10px] font-bold text-muted-foreground shrink-0 uppercase">
                          {a.type === "github_pr" ? "🐙 PR" : a.type === "github_issue" ? "🎯 Issue" : a.type === "link" ? "🔗 Link" : a.type === "file" ? "📁 File" : "📦 Other"}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate">{a.label}</div>
                          {a.url && (
                            <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                              <a
                                href={a.url.startsWith("http") ? a.url : `https://${a.url}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline truncate max-w-[220px]"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {a.url}
                              </a>
                              <CopyButton text={a.url} />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setAttachmentType(a.type);
                            setAttachmentLabel(a.label);
                            setAttachmentUrl(a.url || "");
                            setEditingAttachmentIndex(i);
                          }}
                          className="p-1 hover:text-primary text-muted-foreground transition-colors cursor-pointer"
                          title="Edit attachment"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAttachment(i)}
                          className="p-1 hover:text-red-400 text-muted-foreground transition-colors cursor-pointer"
                          title="Delete attachment"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Add Attachment Form Box */}
            {editingAttachmentIndex === null && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <div className="text-xs font-mono font-bold text-muted-foreground uppercase">
                  + Add Attachment / Link
                </div>
                <div className="flex flex-wrap gap-1">
                  {ATTACHMENT_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAttachmentType(t)}
                      className={`px-2 py-1 text-xs font-mono font-bold border transition-all cursor-pointer ${
                        attachmentType === t
                          ? "border-primary bg-primary/20 text-foreground shadow-[1px_1px_0_rgba(0,0,0,0.8)]"
                          : "border-border/70 bg-secondary text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      {t === "github_pr" ? "🐙 PR" : t === "github_issue" ? "🎯 Issue" : t === "link" ? "🔗 Link" : t === "file" ? "📁 File" : "📦 Other"}
                    </button>
                  ))}
                </div>
                <input
                  aria-label="Attachment label"
                  className={FIELD}
                  placeholder="Label / Title (e.g. PR #5129, Figma Design, Spec RFC)"
                  value={attachmentLabel}
                  onChange={(e) => setAttachmentLabel(e.target.value)}
                />
                <div className="flex gap-2">
                  <input
                    aria-label="Attachment URL"
                    className={FIELD}
                    placeholder="URL (optional for files)"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                  />
                  {attachmentType === "file" && (
                    <label className="cursor-pointer border-2 border-border bg-secondary px-3 py-1.5 text-xs font-bold font-mono text-foreground hover:bg-secondary/80 flex items-center gap-1.5 shrink-0 transition-colors">
                      <Upload size={13} />
                      <span>{isUploadingFile ? "..." : "Upload"}</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploadingFile(true);
                          try {
                            const fd = new FormData();
                            fd.append("file", file);
                            const res = await fetch("/api/upload", { method: "POST", body: fd });
                            const json = await res.json();
                            if (json.success) {
                              setAttachmentUrl(json.url);
                              if (!attachmentLabel.trim()) setAttachmentLabel(file.name);
                              notify("File uploaded!", "success");
                            } else {
                              notify(json.error || "Upload failed", "error");
                            }
                          } catch {
                            notify("Upload failed", "error");
                          } finally {
                            setIsUploadingFile(false);
                          }
                        }}
                      />
                    </label>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={addAttachment}
                    disabled={!attachmentLabel.trim() || isUploadingFile}
                    className="font-bold shrink-0"
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Section>

        <Section title={`Deliverables ${form.deliverables.length ? `(${form.deliverables.length})` : ""}`} shape="◆" defaultOpen={form.deliverables.length > 0}>
          <div className="flex flex-col gap-3">
            {form.deliverables.length === 0 ? (
              <div className="p-3 border-2 border-dashed border-border/80 bg-secondary/20 text-center select-none">
                <p className="text-xs font-mono text-muted-foreground italic">
                  🏆 No deliverables or completed work artifacts registered yet.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {form.deliverables.map((d, i) => {
                  const isEditing = editingDeliverableIndex === i;
                  if (isEditing) {
                    return (
                      <div key={i} className="flex flex-col gap-2 p-3 border-2 border-primary bg-secondary/80">
                        <div className="text-xs font-mono font-bold text-primary flex items-center justify-between">
                          <span>✏️ Edit Deliverable #{i + 1}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {DELIVERABLE_TYPES.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setDeliverableType(t)}
                              className={`px-2.5 py-1 text-xs font-mono font-bold border transition-all cursor-pointer ${
                                deliverableType === t
                                  ? "border-primary bg-primary/20 text-foreground shadow-[1px_1px_0_rgba(0,0,0,0.8)]"
                                  : "border-border/70 bg-secondary text-muted-foreground hover:border-border hover:text-foreground"
                              }`}
                            >
                              {t === "pr" ? "🐙 Pull Request" : t === "doc" ? "📄 Document" : t === "design" ? "🎨 Design" : "📦 Other"}
                            </button>
                          ))}
                        </div>
                        <input
                          aria-label="Deliverable label"
                          className={FIELD}
                          placeholder="Label (e.g. Implementation PR, Spec RFC)"
                          value={deliverableLabel}
                          onChange={(e) => setDeliverableLabel(e.target.value)}
                        />
                        <input
                          aria-label="Deliverable URL"
                          className={FIELD}
                          placeholder="URL or content (e.g. github.com/owner/repo/pull/1)"
                          value={deliverableUrl}
                          onChange={(e) => setDeliverableUrl(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end pt-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              const newDeliverables = [...form.deliverables];
                              newDeliverables[i] = { type: deliverableType, label: deliverableLabel, urlOrContent: deliverableUrl || undefined };
                              set("deliverables", newDeliverables);
                              setEditingDeliverableIndex(null);
                              setDeliverableType("pr");
                              setDeliverableLabel("");
                              setDeliverableUrl("");
                            }}
                          >
                            Save Changes
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingDeliverableIndex(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 p-2 border border-border bg-secondary/40 text-xs font-mono hover:bg-secondary/70 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 border border-primary/40 bg-primary/10 text-[10px] font-bold text-primary shrink-0 uppercase">
                          {d.type === "pr" ? "🐙 PR" : d.type === "doc" ? "📄 Doc" : d.type === "design" ? "🎨 Design" : "📦 Artifact"}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-foreground truncate">{d.label || "Untitled Deliverable"}</div>
                          {d.urlOrContent && (
                            <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                              {d.urlOrContent.startsWith("http") ? (
                                <a
                                  href={d.urlOrContent}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline truncate max-w-[220px]"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {d.urlOrContent}
                                </a>
                              ) : (
                                <span className="truncate max-w-[220px]">{d.urlOrContent}</span>
                              )}
                              <CopyButton text={d.urlOrContent} />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setDeliverableType(d.type);
                            setDeliverableLabel(d.label || "");
                            setDeliverableUrl(d.urlOrContent || "");
                            setEditingDeliverableIndex(i);
                          }}
                          className="p-1 hover:text-primary text-muted-foreground transition-colors cursor-pointer"
                          title="Edit deliverable"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDeliverable(i)}
                          className="p-1 hover:text-red-400 text-muted-foreground transition-colors cursor-pointer"
                          title="Delete deliverable"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Add Deliverable Form Box */}
            {editingDeliverableIndex === null && (
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <div className="text-xs font-mono font-bold text-muted-foreground uppercase">
                  + Add Deliverable Artifact
                </div>
                <div className="flex flex-wrap gap-1">
                  {DELIVERABLE_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDeliverableType(t)}
                      className={`px-2.5 py-1 text-xs font-mono font-bold border transition-all cursor-pointer ${
                        deliverableType === t
                          ? "border-primary bg-primary/20 text-foreground shadow-[1px_1px_0_rgba(0,0,0,0.8)]"
                          : "border-border/70 bg-secondary text-muted-foreground hover:border-border hover:text-foreground"
                      }`}
                    >
                      {t === "pr" ? "🐙 Pull Request" : t === "doc" ? "📄 Document" : t === "design" ? "🎨 Design" : "📦 Other"}
                    </button>
                  ))}
                </div>
                <input
                  aria-label="Deliverable label"
                  className={FIELD}
                  placeholder="Label (e.g. Implementation PR, Architecture RFC)"
                  value={deliverableLabel}
                  onChange={(e) => setDeliverableLabel(e.target.value)}
                />
                <div className="flex gap-2">
                  <input
                    aria-label="Deliverable URL"
                    className={FIELD}
                    placeholder="URL or summary (e.g. github.com/owner/repo/pull/1)"
                    value={deliverableUrl}
                    onChange={(e) => setDeliverableUrl(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    aria-label="Add deliverable"
                    onClick={addDeliverable}
                    disabled={!deliverableLabel.trim()}
                    className="font-bold shrink-0"
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {mode === "edit" && task && (
          <>
            {/* MCP Agent Telemetry & Checkpoints */}
            {isAgentTask && (
              <Section title="MCP Agent Telemetry & Runs" shape="⚡" defaultOpen={true}>
                <div className="flex flex-col gap-3 p-2.5 bg-primary/5 border-2 border-cyan-500/40 text-xs shadow-[2px_2px_0_rgba(16,224,224,0.15)] max-w-full overflow-hidden">
                  {taskDetailLoading && !taskDetail ? (
                    <div className="text-xs text-muted-foreground italic p-2 flex items-center gap-2">
                      <span className="text-sm">⚔️</span> Loading agent telemetry & runs…
                    </div>
                  ) : (
                    <>
                      {/* 1. Executive Status & Agent Deck */}
                      {(() => {
                        const runs = taskDetail?.agent?.runs ?? [];
                        const latestRun = runs[0];
                        const activeRun = runs.find((r) => r.status === "active");
                        const latestCp = taskDetail?.agent?.checkpoints?.[0];
                        const isIdling = Boolean(latestCp?.checkpointState === "waiting_external" || (task as any)?.waitingReason);
                        const isDone = Boolean(latestCp?.checkpointState === "finished" || task?.status === "done");

                        return (
                          <div className="p-3 bg-background/90 border border-cyan-500/30 flex flex-col gap-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-[var(--color-primary-gold)] flex items-center gap-1.5">
                                  <Bot size={15} className="text-cyan-400 shrink-0" />
                                  <span>{latestRun?.agentName || "Hermes Copilot"}</span>
                                </span>
                                {activeRun ? (
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-green-950/70 border border-green-500/60 text-green-300 font-mono font-bold text-xs">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                    LIVE RUNNING
                                  </span>
                                ) : isIdling ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-950/70 border border-amber-500/60 text-amber-300 font-mono font-bold text-xs">
                                    ⏸️ WAITING / IDLING
                                  </span>
                                ) : isDone ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-950/70 border border-cyan-500/60 text-cyan-300 font-mono font-bold text-xs">
                                    ✓ COMPLETED
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-secondary border border-border text-muted-foreground font-mono font-bold text-xs">
                                    {(latestRun?.status || "IN_PROGRESS").toUpperCase()}
                                  </span>
                                )}
                              </div>

                              {latestRun?.startedAt && (
                                <div className="text-xs font-mono text-muted-foreground flex items-center gap-1">
                                  <Clock size={12} className="text-cyan-400 shrink-0" />
                                  <span>
                                    {latestRun.endedAt
                                      ? `Duration: ${formatDuration(latestRun.startedAt, latestRun.endedAt)}`
                                      : `Active since ${new Date(latestRun.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Session Pointer & Origin Meta */}
                            {latestRun && (
                              <div className="pt-2 border-t border-border/50 flex flex-col gap-1.5 text-xs font-mono">
                                {latestRun.sessionTitle && (
                                  <div className="text-foreground text-sm font-bold flex items-center gap-1.5 truncate">
                                    <span className="text-cyan-400">💬</span>
                                    <span className="truncate">{latestRun.sessionTitle}</span>
                                  </div>
                                )}
                                <div className="flex items-center justify-between gap-2 flex-wrap text-muted-foreground">
                                  <span className="truncate max-w-[280px]" title={`${latestRun.chatName || latestRun.platform || 'Hermes'}${latestRun.threadName ? ` > #${latestRun.threadName}` : latestRun.threadId ? ` (#${latestRun.threadId})` : ''}`}>
                                    📍 {latestRun.chatName || latestRun.platform || "Hermes"}
                                    {latestRun.threadName ? ` > #${latestRun.threadName}` : latestRun.threadId ? ` (#${latestRun.threadId})` : ""}
                                  </span>
                                  {latestRun.sessionId && (
                                    <div className="flex items-center gap-1.5 bg-secondary/60 px-2 py-0.5 border border-border/60">
                                      <span className="text-muted-foreground">Session:</span>
                                      <span className="text-[var(--color-primary-gold)] font-bold select-all truncate max-w-[140px]" title={latestRun.sessionId}>
                                        {latestRun.sessionId}
                                      </span>
                                      <CopyButton text={latestRun.sessionId} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* 2. Linked External Sources (PR, Repo, Canonical Key) */}
                      {Boolean(taskDetail?.agent?.sources && taskDetail.agent.sources.length > 0) && (
                        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-background/80 border border-border min-w-0">
                          <span className="text-xs font-mono font-bold text-cyan-400 uppercase flex items-center gap-1 shrink-0">
                            <ExternalLink size={12} className="text-cyan-400" /> Linked Sources:
                          </span>
                          {taskDetail!.agent!.sources!.map((s) => {
                            const targetUrl = s.url || (s.canonicalKey.startsWith("http") ? s.canonicalKey : `https://${s.canonicalKey}`);
                            return (
                              <a
                                key={s.id}
                                href={targetUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary hover:bg-secondary/80 text-[var(--color-primary-gold)] hover:underline font-mono text-xs border border-border transition-colors truncate max-w-[280px]"
                                title={s.canonicalKey}
                              >
                                <span>{s.provider === "github_pr" ? "🐙 PR" : "🔗"}</span>
                                <span className="truncate">{s.canonicalKey}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}

                      {/* 3. Latest Checkpoint or Waiting Reason */}
                      {((taskDetail?.agent?.checkpoints?.length ?? 0) > 0 && taskDetail?.agent?.checkpoints?.[0]) ? (
                        <div className="p-3 bg-background/90 border border-cyan-500/30 flex flex-col gap-2 min-w-0">
                          <div className="font-mono font-bold text-xs text-cyan-400 uppercase flex items-center justify-between gap-1.5">
                            <span className="flex items-center gap-1.5 truncate">
                              <Sparkles size={13} className="shrink-0 text-cyan-400" /> Latest Checkpoint (Rev #{taskDetail.agent.checkpoints[0].revision})
                            </span>
                            {taskDetail.agent.checkpoints[0].checkpointState && (
                              <span
                                className={`text-xs font-mono font-bold px-2 py-0.5 border shrink-0 ${
                                  taskDetail.agent.checkpoints[0].checkpointState === "finished"
                                    ? "border-green-500/50 text-green-300 bg-green-950/40"
                                    : taskDetail.agent.checkpoints[0].checkpointState === "waiting_external"
                                    ? "border-amber-500/50 text-amber-300 bg-amber-950/40"
                                    : "border-cyan-500/50 text-cyan-300 bg-cyan-950/40"
                                }`}
                              >
                                {taskDetail.agent.checkpoints[0].checkpointState.toUpperCase()}
                              </span>
                            )}
                          </div>

                          <p className="p-2.5 bg-background/60 border border-border/80 text-foreground font-mono text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap">
                            {taskDetail.agent.checkpoints[0].summary}
                          </p>

                          {taskDetail.agent.checkpoints[0].nextStep && (
                            <div className="p-2 bg-cyan-950/20 border border-cyan-500/30 text-xs sm:text-sm font-mono text-cyan-300 flex items-start gap-1.5">
                              <span className="font-bold shrink-0">🎯 Next:</span>
                              <span className="break-words">{taskDetail.agent.checkpoints[0].nextStep}</span>
                            </div>
                          )}

                          {(taskDetail.agent.checkpoints[0].waitingReason || (task as any)?.waitingReason) && (
                            <div className="p-2 bg-amber-950/20 border border-amber-500/30 text-xs sm:text-sm font-mono text-amber-300 flex items-start gap-1.5">
                              <span className="font-bold shrink-0">⏸️ Idling:</span>
                              <span className="break-words">{taskDetail.agent.checkpoints[0].waitingReason || (task as any).waitingReason}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground pt-1.5 border-t border-border/40">
                            {taskDetail.agent.checkpoints[0].provenanceSource ? (
                              <div className="flex items-center gap-1.5 truncate max-w-[280px]">
                                <span>📌 Ref:</span>
                                <code className="bg-secondary px-1.5 py-0.5 border border-border text-[var(--color-primary-gold)] truncate" title={taskDetail.agent.checkpoints[0].provenanceSource}>
                                  {taskDetail.agent.checkpoints[0].provenanceSource}
                                </code>
                                <CopyButton text={taskDetail.agent.checkpoints[0].provenanceSource} />
                              </div>
                            ) : <span />}
                            <span>{new Date(taskDetail.agent.checkpoints[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      ) : (task as any)?.waitingReason ? (
                        <div className="p-3 bg-amber-950/20 border border-amber-500/30 text-xs sm:text-sm font-mono text-amber-300">
                          <span className="font-bold">⏸️ Idling Reason:</span> {(task as any).waitingReason}
                        </div>
                      ) : null}

                      {/* 4. Milestone Revision History Toggle */}
                      {Boolean((taskDetail?.agent?.checkpoints?.length ?? 0) > 1) && (
                        <div className="border-t border-border/40 pt-1.5">
                          <button
                            type="button"
                            onClick={() => setShowCheckpointHistory((v) => !v)}
                            className="flex items-center justify-between w-full text-xs font-mono text-muted-foreground hover:text-foreground py-1.5 px-2 bg-secondary/40 border border-border/50 cursor-pointer transition-colors"
                          >
                            <span className="font-bold">
                              📜 Milestone History ({taskDetail!.agent!.checkpoints.length} revisions)
                            </span>
                            <span className="text-cyan-400 font-bold">{showCheckpointHistory ? "▲ Hide" : "▼ Show"}</span>
                          </button>
                          {showCheckpointHistory && (
                            <div className="mt-1.5 space-y-2 max-h-56 overflow-y-auto pr-1">
                              {taskDetail!.agent!.checkpoints.slice(1).map((cp) => (
                                <div key={cp.id} className="p-2.5 bg-background/60 border border-border text-xs font-mono space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-bold text-cyan-400">Rev #{cp.revision}</span>
                                    <span className="text-muted-foreground">
                                      {new Date(cp.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-foreground leading-relaxed break-words whitespace-pre-wrap">{cp.summary}</p>
                                  {cp.nextStep && (
                                    <div className="text-xs text-cyan-300">▸ Next: {cp.nextStep}</div>
                                  )}
                                  {cp.waitingReason && (
                                    <div className="text-xs text-amber-400">⏸️ {cp.waitingReason}</div>
                                  )}
                                  {cp.provenanceSource && (
                                    <div className="text-xs text-muted-foreground">📌 {cp.provenanceSource}</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5. Resource & Token Economics Dashboard */}
                      {Boolean(taskDetail?.agent?.runs?.some((r) => r.usageEvents && r.usageEvents.length > 0)) && (
                        <div className="border-t border-border/40 pt-2 min-w-0">
                          {(() => {
                            const modelMap: Record<string, { prompt: number; completion: number; total: number; cost: number; provider: string }> = {};
                            let grandTotal = 0;
                            let grandPrompt = 0;
                            let grandCompletion = 0;
                            let totalCost = 0;

                            for (const r of taskDetail?.agent?.runs ?? []) {
                              for (const u of r.usageEvents ?? []) {
                                const key = u.model;
                                if (!modelMap[key]) {
                                  modelMap[key] = { prompt: 0, completion: 0, total: 0, cost: 0, provider: u.provider || "9Router" };
                                }
                                modelMap[key].prompt += u.promptTokens;
                                modelMap[key].completion += u.completionTokens;
                                modelMap[key].total += u.totalTokens;
                                modelMap[key].cost += u.costUsd || 0;
                                grandTotal += u.totalTokens;
                                grandPrompt += u.promptTokens;
                                grandCompletion += u.completionTokens;
                                totalCost += u.costUsd || 0;
                              }
                            }

                            return (
                              <div className="space-y-2">
                                <div className="font-mono font-bold text-xs text-cyan-400 uppercase flex items-center justify-between">
                                  <span className="flex items-center gap-1.5">
                                    <Cpu size={13} className="shrink-0" /> Token Economics & Cost:
                                  </span>
                                  <span className="text-xs text-muted-foreground font-normal">Real Telemetry</span>
                                </div>

                                {/* KPI Metrics Cards */}
                                <div className="grid grid-cols-2 gap-2 font-mono">
                                  <div className="p-2 bg-background/80 border border-border">
                                    <div className="text-xs font-bold text-muted-foreground">TOTAL TOKENS</div>
                                    <div className="text-sm sm:text-base font-bold text-[var(--color-primary-gold)] mt-0.5">
                                      ⚡ {grandTotal.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {grandPrompt.toLocaleString()} in · {grandCompletion.toLocaleString()} out
                                    </div>
                                  </div>
                                  <div className="p-2 bg-background/80 border border-border">
                                    <div className="text-xs font-bold text-muted-foreground">ESTIMATED COST</div>
                                    <div className="text-sm sm:text-base font-bold text-green-400 mt-0.5">
                                      ${totalCost.toFixed(4)}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">
                                      {Object.keys(modelMap).length} model{Object.keys(modelMap).length > 1 ? "s" : ""} used
                                    </div>
                                  </div>
                                </div>

                                {/* Models detail list */}
                                <div className="space-y-1.5">
                                  {Object.entries(modelMap).map(([mName, data]) => (
                                    <div key={mName} className="p-2 bg-background/60 border border-border/80 font-mono text-xs">
                                      <div className="flex items-center justify-between gap-1">
                                        <span className="font-bold text-foreground truncate" title={mName}>{mName}</span>
                                        <span className="text-xs font-bold px-1.5 py-0.5 bg-secondary text-cyan-400 border border-border/50 shrink-0">{data.provider}</span>
                                      </div>
                                      <div className="text-muted-foreground flex justify-between gap-1 mt-1 text-xs">
                                        <span>{data.prompt.toLocaleString()} prompt · {data.completion.toLocaleString()} comp</span>
                                        <span className="text-[var(--color-primary-gold)] font-bold">{data.total.toLocaleString()} tkn {data.cost > 0 && `(~$${data.cost.toFixed(4)})`}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </Section>
            )}

            <Section
              title={`Comments ${taskDetail?.comments?.length ? `(${taskDetail.comments.length})` : ""}`}
              shape="💬"
              defaultOpen={Boolean(taskDetail?.comments && taskDetail.comments.length > 0)}
            >
              <div className="flex flex-col gap-2">
                <ul className="flex flex-col gap-2 max-h-72 overflow-y-auto border-b border-border pb-2 pr-1">
                  {taskDetailLoading ? (
                    <li className="text-xs text-muted-foreground italic">Loading comments…</li>
                  ) : (!taskDetail?.comments || taskDetail.comments.length === 0) ? (
                    <li className="text-xs text-muted-foreground italic">No comments yet</li>
                  ) : (
                    taskDetail.comments.map((c) => {
                      const isAgent =
                        c.content.startsWith("⚡ [MCP]") ||
                        c.content.startsWith("🤖") ||
                        c.content.startsWith("🏁 [MCP") ||
                        c.authorName?.toLowerCase() === "hermes";
                      const cleanContent = c.content.replace(/^⚡ \[MCP\]:\s*/, "");

                      return (
                        <li
                          key={c.id}
                          className={`flex flex-col gap-1.5 p-2.5 border ${
                            isAgent
                              ? "bg-cyan-950/15 border-cyan-500/40"
                              : "bg-muted/30 border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <div className="flex items-center gap-2">
                              {isAgent ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-950 border border-cyan-500/60 text-cyan-300 font-bold text-xs">
                                  <Bot size={12} /> AGENT LOG
                                </span>
                              ) : null}
                              <span className="font-bold text-foreground text-xs sm:text-sm">{c.authorName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                              <span>
                                {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <CopyButton text={cleanContent} />
                            </div>
                          </div>
                          <div className={`leading-relaxed break-words whitespace-pre-wrap ${isAgent ? "font-mono text-xs sm:text-sm text-foreground" : "text-sm text-foreground"}`}>
                            {cleanContent}
                          </div>
                        </li>
                      );
                    })
                  )}
                </ul>
                <CommentInput taskId={task.id} onAdded={refreshTaskDetail} />
              </div>
            </Section>

            <Section title="History" shape="◫" defaultOpen={false}>
              <ul className="flex flex-col gap-1">
                {taskDetailLoading ? (
                  <li className="text-xs text-muted-foreground italic">Loading history…</li>
                ) : (
                  (taskDetail?.statusHistory ?? []).map((h, i) => (
                    <li key={i} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {h.fromStatus ? STATUS_LABEL[h.fromStatus] : "Created"} → {STATUS_LABEL[h.toStatus]}
                      </span>
                      <span className="text-muted-foreground">{new Date(h.changedAt).toLocaleDateString()} {new Date(h.changedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </li>
                  ))
                )}
              </ul>
            </Section>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border p-4 sticky bottom-0 z-20" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
        <Button type="button" variant="ghost" onClick={closeForm} disabled={submitting}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "⋳ Saving..." : <><Check size={12} />{mode === "edit" ? "Save Changes" : "Create Quest"}</> }</Button>
      </div>
    </form>
  );
}

function CommentInput({ taskId, onAdded }: { taskId: string; onAdded: () => void }) {
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
      onAdded();
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
