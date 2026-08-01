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
import { useProjects } from "@/components/providers/ProjectsProvider";
import { PROJECT_CATEGORIES, PROJECT_COLOR_OPTIONS, projectFormSchema, type ProjectFormValues } from "@/lib/schemas/project";
import type { Project } from "@/types/gamification";

const EMPTY_FORM: ProjectFormValues = {
  name: "",
  code: "",
  emoji: "🚀",
  category: "Side Project",
  colorVar: PROJECT_COLOR_OPTIONS[2].colorVar,
  status: "active",
  customColor: undefined,
};

const LC = "mb-1 block text-sm tracking-widest text-muted-foreground uppercase";
const FIELD =
  "w-full border-2 border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary";

export function ProjectFormSheet() {
  const { sheet, closeForm } = useProjects();
  return (
    <Sheet open={sheet.open} onOpenChange={(open) => !open && closeForm()}>
      <SheetContent className="w-full gap-0 overflow-y-auto border-l-2 border-border sm:max-w-md">
        {sheet.open && <ProjectFormBody key={sheet.project?.id ?? "create"} mode={sheet.mode} project={sheet.project} />}
      </SheetContent>
    </Sheet>
  );
}

function ProjectFormBody({ mode, project }: { mode: "create" | "edit"; project: Project | null }) {
  const { closeForm, createProject, updateProject, deleteProject } = useProjects();
  const [form, setForm] = useState<ProjectFormValues>(() =>
    mode === "edit" && project
      ? {
          name: project.name,
          code: project.code || "",
          emoji: project.emoji,
          category: project.category as ProjectFormValues["category"],
          colorVar: project.colorVar,
          customColor: project.customColor,
          status: project.status,
          description: project.description,
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = projectFormSchema.safeParse({
      ...form,
      description: form.description?.trim() || undefined,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    if (mode === "edit" && project) {
      updateProject(project.id, result.data);
    } else {
      createProject(result.data);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex h-full flex-col">
      <SheetHeader className="flex-row items-center justify-between gap-2 space-y-0 border-b border-border py-3" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
        <div>
          <SheetTitle className="font-display" style={{ fontSize: "9px", color: "var(--color-primary-gold)" }}>
            {mode === "edit" ? "◈ EDIT PROJECT" : "+ NEW PROJECT"}
          </SheetTitle>
          <SheetDescription className="sr-only">Group tasks by area of life or work.</SheetDescription>
        </div>
        {mode === "edit" && project && (
          <div className="mr-8">
            <ConfirmButton title="Delete" confirmLabel="Delete?" onConfirm={() => deleteProject(project.id)}>
              <Trash2 size={14} style={{ color: "var(--color-status-blocked)" }} />
            </ConfirmButton>
          </div>
        )}
      </SheetHeader>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <div
          className="flex items-center gap-3 border-2 p-3"
          style={{ backgroundColor: "var(--color-bg-panel-alt)", borderColor: `var(${form.colorVar})`, borderLeftWidth: "4px" }}
        >
          <span style={{ fontSize: "24px" }}>{form.emoji || "🚀"}</span>
          <div>
            <div className="text-sm font-bold text-foreground">{form.name || "Project Name"}</div>
            <div className="text-sm text-muted-foreground">{form.category}</div>
          </div>
        </div>

        <div>
          <label className={LC}>Project Name *</label>
          <input
            aria-label="Project Name"
            className={FIELD}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. My New Project"
            autoFocus
          />
          {error && <p className="mt-1 text-xs" style={{ color: "var(--color-status-blocked)" }}>{error}</p>}
        </div>

        <div>
          <label className={LC}>Project Code (Optional)</label>
          <input
            aria-label="Project Code"
            className={FIELD}
            value={form.code || ""}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            placeholder="e.g. ATS, THX, CLI"
            maxLength={4}
          />
          <p className="mt-1 text-xs text-muted-foreground">2-4 uppercase letters/numbers. Used to prefix task codes.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LC}>Emoji</label>
            <input
              aria-label="Emoji"
              className={FIELD}
              style={{ fontSize: "20px" }}
              value={form.emoji}
              onChange={(e) => set("emoji", e.target.value.slice(-2) || "🚀")}
              placeholder="🚀"
            />
          </div>
          <div>
            <label className={LC}>Category</label>
            <select aria-label="Category" className={FIELD} value={form.category} onChange={(e) => set("category", e.target.value as ProjectFormValues["category"])}>
              {PROJECT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={LC}>Color</label>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {PROJECT_COLOR_OPTIONS.map((c) => (
              <button
                key={c.colorVar}
                type="button"
                title={c.label}
                onClick={() => {
                  set("colorVar", c.colorVar);
                  set("customColor", undefined);
                }}
                className="h-10 border-[3px] flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: `var(${c.colorVar})`,
                  borderColor: form.colorVar === c.colorVar && !form.customColor ? "var(--color-text-primary)" : "transparent",
                }}
              >
                {form.colorVar === c.colorVar && !form.customColor && "✓"}
              </button>
            ))}
          </div>

          <div className="mt-3">
            <label className={LC}>Custom Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={form.customColor || "#f0b429"}
                onChange={(e) => {
                  set("customColor", e.target.value);
                  set("colorVar", e.target.value);
                }}
                className="h-10 w-16 border-2 border-border cursor-pointer"
              />
              <input
                type="text"
                placeholder="#f0b429"
                value={form.customColor || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "" || /^#[0-9A-F]{6}$/i.test(val)) {
                    set("customColor", val || undefined);
                    if (val) set("colorVar", val);
                  }
                }}
                className={`flex-1 ${FIELD}`}
              />
            </div>
          </div>
        </div>

        <div>
          <label className={LC}>Status</label>
          <select aria-label="Status" className={FIELD} value={form.status} onChange={(e) => set("status", e.target.value as ProjectFormValues["status"])}>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div>
          <label className={LC}>Description</label>
          <textarea
            aria-label="Description"
            className={`${FIELD} resize-none`}
            rows={3}
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="What is this project about?"
          />
        </div>
      </div>

      <Separator />
      <div className="flex items-center justify-between p-4">
        <Button type="button" variant="ghost" onClick={closeForm}>Cancel</Button>
        <Button type="submit" disabled={!form.name.trim()}>
          <Check size={12} /> {mode === "edit" ? "Save Changes" : "Create Project"}
        </Button>
      </div>
    </form>
  );
}
