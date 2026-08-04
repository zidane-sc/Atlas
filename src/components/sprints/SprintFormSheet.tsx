"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/DatePicker";
import { useSprints } from "@/components/providers/SprintsProvider";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { SPRINT_STATUSES, sprintFormSchema, type SprintFormValues } from "@/lib/schemas/sprint";
import type { Sprint } from "@/types/gamification";

const SPRINT_STATUS_COLOR_VAR: Record<string, string> = {
  active: "--color-status-ready",
  completed: "--color-text-muted",
  planning: "--color-status-waiting-external",
};

const LC = "mb-1 block text-sm tracking-widest text-muted-foreground uppercase";
const FIELD =
  "w-full border-2 border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary";
const FIELD_ERROR =
  "w-full border-2 border-status-blocked bg-card px-3 py-1.5 text-sm text-status-blocked outline-none focus:border-status-blocked";

export function SprintFormSheet() {
  const { sheet, closeForm } = useSprints();
  return (
    <Sheet open={sheet.open} onOpenChange={(open) => !open && closeForm()}>
      <SheetContent className="w-full gap-0 overflow-y-auto border-l-2 border-border sm:max-w-md">
        {sheet.open && <SprintFormBody key={sheet.sprint?.id ?? "create"} mode={sheet.mode} sprint={sheet.sprint} />}
      </SheetContent>
    </Sheet>
  );
}

function SprintFormBody({ mode, sprint }: { mode: "create" | "edit"; sprint: Sprint | null }) {
  const { closeForm, createSprint, updateSprint, deleteSprint } = useSprints();
  const { projects } = useProjects();
  const [form, setForm] = useState<SprintFormValues>(() =>
    mode === "edit" && sprint
      ? {
          name: sprint.name,
          projectIds: sprint.projectIds,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
          status: sprint.status,
          goal: sprint.goal,
        }
      : {
          name: "",
          projectIds: [],
          startDate: "",
          endDate: "",
          status: "planning",
          goal: "",
        }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof SprintFormValues, string>>>({});

  const set = <K extends keyof SprintFormValues>(key: K, value: SprintFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = sprintFormSchema.safeParse({
      ...form,
      goal: form.goal?.trim() || undefined,
    });
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof SprintFormValues, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof SprintFormValues;
        fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    if (mode === "edit" && sprint) {
      updateSprint(sprint.id, result.data);
    } else {
      createSprint(result.data);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b border-border py-3" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
        <div>
          <SheetTitle className="font-display" style={{ fontSize: "9px", color: "var(--color-primary-gold)" }}>
            {mode === "edit" ? "◈ EDIT SPRINT" : "+ NEW SPRINT"}
          </SheetTitle>
          <SheetDescription className="sr-only">Group quests into a time-boxed push.</SheetDescription>
        </div>
        {mode === "edit" && sprint && (
          <div className="mr-8">
            <ConfirmButton title="Delete" confirmLabel="Delete?" onConfirm={() => deleteSprint(sprint.id)}>
              <Trash2 size={14} style={{ color: "var(--color-status-blocked)" }} />
            </ConfirmButton>
          </div>
        )}
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div
          className="flex items-center gap-3 border-2 p-3"
          style={{ backgroundColor: "var(--color-bg-panel-alt)", borderColor: `var(${SPRINT_STATUS_COLOR_VAR[form.status]})`, borderLeftWidth: "4px" }}
        >
          <div>
            <div className="text-sm font-bold text-foreground">{form.name || "Sprint Name"}</div>
            <div className="text-sm text-muted-foreground">{form.startDate || "—"} → {form.endDate || "—"}</div>
          </div>
        </div>

        <div>
          <label className={LC}>Sprint Name *</label>
          <input
            aria-label="Sprint Name"
            className={errors.name ? FIELD_ERROR : FIELD}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Sprint 9 — The Reckoning"
            autoFocus
          />
          {errors.name && <p className="mt-1 text-sm" style={{ color: "var(--color-status-blocked)" }}>{errors.name}</p>}
        </div>

        <div>
          <label className={LC}>Projects</label>
          <div className="mb-2 flex flex-wrap gap-2">
            {form.projectIds.map((id) => {
              const p = projects.find((p) => p.id === id);
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 border-2 px-2 py-1 text-xs font-medium text-foreground transition-colors"
                  style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
                >
                  {p ? `${p.emoji} ${p.name}` : "Unknown project"}
                  <button
                    type="button"
                    onClick={() => set("projectIds", form.projectIds.filter((pid) => pid !== id))}
                    className="hover:opacity-70 transition-opacity"
                    style={{ color: "var(--color-status-blocked)" }}
                    title="Remove project"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
          <select
            aria-label="Add project"
            className={errors.projectIds ? FIELD_ERROR : FIELD}
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id) set("projectIds", [...form.projectIds, id]);
            }}
          >
            <option value="">+ Add project…</option>
            {projects
              .filter((p) => !form.projectIds.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.name}
                </option>
              ))}
          </select>
          {errors.projectIds && <p className="mt-1 text-sm" style={{ color: "var(--color-status-blocked)" }}>{errors.projectIds}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LC}>Start Date</label>
            <DatePicker
              value={form.startDate}
              onChange={(date) => set("startDate", date)}
            />
            {errors.startDate && <p className="mt-1 text-sm" style={{ color: "var(--color-status-blocked)" }}>{errors.startDate}</p>}
          </div>
          <div>
            <label className={LC}>End Date</label>
            <DatePicker
              value={form.endDate}
              onChange={(date) => set("endDate", date)}
            />
            {errors.endDate && <p className="mt-1 text-sm" style={{ color: "var(--color-status-blocked)" }}>{errors.endDate}</p>}
          </div>
        </div>

        <div>
          <label className={LC}>Status</label>
          <select aria-label="Status" className={FIELD} value={form.status} onChange={(e) => set("status", e.target.value as SprintFormValues["status"])}>
            {SPRINT_STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={LC}>Goal</label>
          <textarea
            aria-label="Goal"
            className={`${FIELD} resize-none`}
            rows={3}
            value={form.goal ?? ""}
            onChange={(e) => set("goal", e.target.value)}
            placeholder="What does this sprint need to ship?"
          />
        </div>
      </div>

      <Separator />
      <div className="flex items-center justify-between p-4">
        <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
        <Button type="submit" disabled={!form.name.trim() || !form.startDate || !form.endDate}>
          <Check size={12} /> {mode === "edit" ? "Save Changes" : "Create Sprint"}
        </Button>
      </div>
    </form>
  );
}
