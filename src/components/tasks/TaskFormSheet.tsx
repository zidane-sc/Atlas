"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, Copy, Trash2 } from "lucide-react";
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
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2.5 text-left text-base tracking-widest text-muted-foreground hover:bg-[var(--color-bg-panel-alt)]">
        <span className="flex items-center gap-2">
          <span style={{ color: "var(--color-primary-gold)" }}>{shape}</span>
          <span>{title}</span>
        </span>
        <ChevronDown size={12} className="transition-transform duration-200 group-data-[panel-open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t-2 border-border px-3 py-3 text-base">{children}</CollapsibleContent>
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
};

const LC = "mb-1 block text-base tracking-widest text-muted-foreground uppercase";
const FIELD =
  "w-full border-2 border-border bg-secondary px-3 py-1.5 text-base text-foreground outline-none focus:border-primary";

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
      <SheetContent className="w-full gap-0 overflow-y-auto border-l-2 border-border sm:max-w-md">
        {sheet.open && <TaskFormBody key={sheet.task?.id ?? "create"} mode={sheet.mode} task={sheet.task} />}
      </SheetContent>
    </Sheet>
  );
}

function TaskFormBody({ mode, task }: { mode: "create" | "edit"; task: Task | null }) {
  const { tasks, closeForm, createTask, updateTask, deleteTask, duplicateTask, activeTimer, startTimer, stopTimer } = useTasks();
  const { projects } = useProjects();
  const { sprints } = useSprints();
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

  const [relationType, setRelationType] = useState<RelationType>("related");
  const [relationTargetId, setRelationTargetId] = useState("");
  const [attachmentType, setAttachmentType] = useState<AttachmentType>("github_pr");
  const [attachmentLabel, setAttachmentLabel] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [deliverableType, setDeliverableType] = useState<DeliverableType>("pr");
  const [deliverableLabel, setDeliverableLabel] = useState("");
  const [tagInput, setTagInput] = useState("");

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (tag && !form.tags.includes(tag)) set("tags", [...form.tags, tag]);
    setTagInput("");
  };
  const removeTag = (tag: string) => set("tags", form.tags.filter((t) => t !== tag));

  const otherTasks = tasks.filter((t) => t.id !== task?.id);

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
    const deliverable: TaskDeliverable = { type: deliverableType, label: deliverableLabel.trim() };
    set("deliverables", [...form.deliverables, deliverable]);
    setDeliverableLabel("");
  };
  const removeDeliverable = (index: number) => set("deliverables", form.deliverables.filter((_, i) => i !== index));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = taskFormSchema.safeParse({
      ...form,
      description: form.description?.trim() || undefined,
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
    if (mode === "edit" && task) {
      updateTask(task.id, result.data);
    } else {
      createTask(result.data);
    }
    closeForm();
  };

  const previewXP = calcTaskXP(form.priority, form.storyPoint, true);
  const previewCoins = calcTaskCoins(form.priority, form.storyPoint);

  const isTiming = mode === "edit" && task != null && activeTimer?.taskId === task.id;
  const [liveSeconds, setLiveSeconds] = useState(0);
  useEffect(() => {
    if (!isTiming || !activeTimer) return;
    const id = setInterval(() => setLiveSeconds(Math.floor((Date.now() - activeTimer.startedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [isTiming, activeTimer]);
  // `task` is a snapshot from when the sheet opened — look up the live copy so a stopped
  // timer's freshly-added time shows immediately instead of waiting for a form reopen.
  const liveTask = task ? (tasks.find((t) => t.id === task.id) ?? task) : null;
  const totalSeconds = (liveTask?.timeSpentSeconds ?? 0) + (isTiming ? liveSeconds : 0);

  return (
    <form onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader
        className="flex-row items-center justify-between gap-2 space-y-0 border-b border-border py-3"
        style={{ backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <SheetTitle className="font-display" style={{ fontSize: "9px", color: "var(--color-primary-gold)" }}>
          {mode === "edit" ? "◈ QUEST DETAIL" : "+ NEW QUEST"}
        </SheetTitle>
        <SheetDescription className="sr-only">{mode === "edit" ? "Edit this quest." : "What needs to be done?"}</SheetDescription>
        {mode === "edit" && task && (
          <div className="mr-8 flex gap-1.5">
            <Button type="button" variant="ghost" size="icon-sm" title="Duplicate" onClick={() => duplicateTask(task.id)}>
              <Copy size={14} />
            </Button>
            <ConfirmButton title="Delete" confirmLabel="Delete?" onConfirm={() => deleteTask(task.id)}>
              <Trash2 size={14} style={{ color: "var(--color-status-blocked)" }} />
            </ConfirmButton>
          </div>
        )}
      </SheetHeader>

      <div className="flex items-center gap-4 border-b border-border px-4 py-2 text-base" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
        <span style={{ color: "var(--color-xp-gold)" }}>⚡ +{previewXP} XP on complete</span>
        <span style={{ color: "var(--color-coin)" }}>🪙 +{previewCoins} coins</span>
      </div>

      <div className="border-b border-border px-4 pt-4 pb-3">
        <label className={LC}>Quest Title *</label>
        <input
          className={FIELD}
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="What needs to be done?"
          autoFocus
        />
        {errors.title && <p className="mt-1 text-base" style={{ color: "var(--color-status-blocked)" }}>{errors.title}</p>}
      </div>
      <div className="flex items-center gap-4 border-b border-border px-4 py-2">
        <StatusBadge status={form.status} />
        <PriorityMark priority={form.priority} withLabel />
        <span className="text-base">{TYPE_ICON[form.type]}</span>
      </div>

      {mode === "edit" && task && (
        <BattleTimer
          task={liveTask ?? task}
          isTiming={isTiming}
          totalSeconds={totalSeconds}
          onStart={() => startTimer(task.id)}
          onStop={stopTimer}
        />
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 pt-3">
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
                <label className={LC}>Priority</label>
                <select aria-label="Priority" className={FIELD} value={form.priority} onChange={(e) => set("priority", e.target.value as Priority)}>
                  {(["p0", "p1", "p2", "p3", "p4"] as Priority[]).map((p) => (
                    <option key={p} value={p}>{p.toUpperCase()}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LC}>Type</label>
                <select aria-label="Type" className={FIELD} value={form.type} onChange={(e) => set("type", e.target.value as TaskType)}>
                  {(Object.keys(TYPE_ICON) as TaskType[]).map((t) => (
                    <option key={t} value={t}>{TYPE_ICON[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LC}>Effort</label>
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
              <div>
                <label className={LC}>Story Points</label>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LC}>Project</label>
                <select aria-label="Project" className={FIELD} value={form.project} onChange={(e) => set("project", e.target.value)}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.name}>{p.emoji} {p.name}</option>
                  ))}
                </select>
                {errors.project && <p className="mt-1 text-base" style={{ color: "var(--color-status-blocked)" }}>{errors.project}</p>}
              </div>
              <div>
                <label className={LC}>Due Date</label>
                <input
                  aria-label="Due Date"
                  type="date"
                  className={FIELD}
                  value={form.dueDate ?? ""}
                  onChange={(e) => set("dueDate", e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={LC}>Sprint</label>
              <select aria-label="Sprint" className={FIELD} value={form.sprint ?? ""} onChange={(e) => set("sprint", e.target.value || undefined)}>
                <option value="">—</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
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
              <div className="mb-2 flex flex-wrap gap-1">
                {form.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 border px-1.5 text-base text-muted-foreground" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}>
                    #{t}
                    <button type="button" onClick={() => removeTag(t)} style={{ color: "var(--color-status-blocked)" }}>✕</button>
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
            <div className="flex gap-2 border-t border-border pt-2">
              <select aria-label="Relation type" className={FIELD} value={relationType} onChange={(e) => setRelationType(e.target.value as RelationType)}>
                {RELATION_TYPES.map((rt) => (
                  <option key={rt} value={rt}>{humanize(rt)}</option>
                ))}
              </select>
              <select aria-label="Related quest" className={FIELD} value={relationTargetId} onChange={(e) => setRelationTargetId(e.target.value)}>
                <option value="">Select quest...</option>
                {otherTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
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
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground capitalize">{humanize(a.type)}</span>
                    <span className="flex-1 truncate text-right">{a.label}</span>
                    <button type="button" onClick={() => removeAttachment(i)} className="shrink-0" style={{ color: "var(--color-status-blocked)" }}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
          </div>
        </Section>

        <Section title="Deliverables" shape="◆">
          <div className="flex flex-col gap-2">
            {form.deliverables.length === 0 ? (
              <p className="text-muted-foreground">None yet.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {form.deliverables.map((d, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground capitalize">{humanize(d.type)}</span>
                    <span className="flex-1 truncate text-right">{d.label}</span>
                    <button type="button" onClick={() => removeDeliverable(i)} className="shrink-0" style={{ color: "var(--color-status-blocked)" }}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2 border-t border-border pt-2">
              <select aria-label="Deliverable type" className={FIELD} value={deliverableType} onChange={(e) => setDeliverableType(e.target.value as DeliverableType)}>
                {DELIVERABLE_TYPES.map((t) => (
                  <option key={t} value={t}>{humanize(t)}</option>
                ))}
              </select>
              <input aria-label="Deliverable label" className={FIELD} placeholder="Label" value={deliverableLabel} onChange={(e) => setDeliverableLabel(e.target.value)} />
              <Button type="button" size="sm" aria-label="Add deliverable" onClick={addDeliverable} disabled={!deliverableLabel.trim()}>Add</Button>
            </div>
          </div>
        </Section>

        {mode === "edit" && task && (
          <>
            <Section title="Comments" shape="💬">
              <div className="flex flex-col gap-2">
                <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto border-b border-border pb-2">
                  {(!task.comments || task.comments.length === 0) ? (
                    <li className="text-xs text-muted-foreground italic">No comments yet</li>
                  ) : (
                    task.comments.map((c) => (
                      <li key={c.id} className="flex flex-col gap-0.5 text-xs bg-muted/30 p-1.5 border border-border">
                        <div className="flex justify-between font-bold text-muted-foreground">
                          <span>{c.authorName}</span>
                          <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-foreground">{c.content}</p>
                      </li>
                    ))
                  )}
                </ul>
                <CommentInput taskId={task.id} />
              </div>
            </Section>

            <Section title="History" shape="◫">
              <ul className="flex flex-col gap-1">
                {task.statusHistory.map((h, i) => (
                  <li key={i} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {h.fromStatus ? STATUS_LABEL[h.fromStatus] : "Created"} → {STATUS_LABEL[h.toStatus]}
                    </span>
                    <span className="text-muted-foreground">{new Date(h.changedAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border p-4" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
        <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
        <Button type="submit"><Check size={12} />{mode === "edit" ? "Save Changes" : "Create Quest"}</Button>
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
    <form onSubmit={handleSubmit} className="flex gap-1.5 mt-1">
      <input
        aria-label="Add a comment"
        className="flex-1 text-xs bg-background border border-border px-2 py-1 text-foreground focus:outline-none focus:border-primary-gold"
        placeholder="Type a comment..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        disabled={loading}
      />
      <Button type="submit" size="sm" disabled={!content.trim() || loading}>
        Post
      </Button>
    </form>
  );
}
