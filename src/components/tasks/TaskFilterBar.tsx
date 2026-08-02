"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { useTasks } from "@/components/providers/TasksProvider";
import { STATUS_LABEL, STATUS_SHAPE, TYPE_ICON } from "@/lib/mock-data";
import { countActiveFilters, EMPTY_TASK_FILTERS, normalizeFilters, type TaskFilters } from "@/lib/task-filters";
import type { Priority, TaskStatus, TaskType } from "@/types/task";

const PRIORITIES: Priority[] = ["p0", "p1", "p2", "p3", "p4"];
const STATUSES = Object.keys(STATUS_LABEL) as TaskStatus[];
const TYPES = Object.keys(TYPE_ICON) as TaskType[];

function FilterDropdown<T extends string>({
  label,
  options,
  selected,
  onChange,
  renderOption,
}: {
  label: string;
  options: T[];
  selected: T[];
  onChange: (next: T[]) => void;
  renderOption: (option: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (option: T) => {
    onChange(selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option]);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 border px-2 py-1 text-sm transition-colors"
        style={{
          borderColor: selected.length ? "var(--color-primary-gold)" : "var(--color-border)",
          color: selected.length ? "var(--color-primary-gold)" : "var(--color-text-muted)",
          backgroundColor: "var(--color-bg-panel)",
        }}
      >
        {label}
        {selected.length > 0 && <span>({selected.length})</span>}
        <ChevronDown size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute top-full left-0 z-50 mt-1 max-h-64 w-48 overflow-y-auto border-2 border-primary bg-card p-1"
            style={{ boxShadow: "4px 4px 0 var(--color-bg-deep)" }}
          >
            {options.map((option) => {
              const checked = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => toggle(option)}
                  className="flex w-full items-center gap-2 px-2 py-1 text-left text-sm transition-colors hover:bg-secondary"
                  style={{ color: checked ? "var(--color-primary-gold)" : "var(--color-text-primary)" }}
                >
                  <span
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center border"
                    style={{ borderColor: checked ? "var(--color-primary-gold)" : "var(--color-border)", backgroundColor: checked ? "var(--color-primary-gold)" : "transparent" }}
                  >
                    {checked && <span style={{ color: "var(--color-bg-deep)", fontSize: "10px", lineHeight: 1 }}>✓</span>}
                  </span>
                  {renderOption(option)}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function OpToggle<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <button
      type="button"
      onClick={() => onChange(options[(index + 1) % options.length].value)}
      className="border px-1.5 py-1 text-sm font-bold transition-colors"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel)", color: "var(--color-text-muted)" }}
      title="Click to cycle operator"
    >
      {options[index]?.label ?? options[0].label}
    </button>
  );
}

export function TaskFilterBar({
  filters,
  onChange,
  projectNames,
  tagNames,
}: {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  projectNames: string[];
  tagNames: string[];
}) {
  const { savedFilters, saveFilter, deleteFilter } = useTasks();
  const [viewsOpen, setViewsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState("");

  const activeCount = countActiveFilters(filters);

  const handleSave = async () => {
    if (!saveName.trim()) return;
    const ok = await saveFilter(saveName.trim(), filters);
    if (ok) {
      setSaveName("");
      setIsSaving(false);
    }
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-2"
      style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
    >
      {/* Saved Views Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setViewsOpen((o) => !o)}
          className="flex items-center gap-1.5 border px-2 py-1 text-sm transition-colors text-muted-foreground hover:text-foreground"
          style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel)" }}
        >
          📑 Saved Views
          {savedFilters.length > 0 && <span className="ml-1 text-xs">({savedFilters.length})</span>}
          <ChevronDown size={10} />
        </button>
        {viewsOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setViewsOpen(false)} />
            <div
              className="absolute top-full left-0 z-50 mt-1 max-h-64 w-52 overflow-y-auto border-2 border-primary bg-card p-1"
              style={{ boxShadow: "4px 4px 0 var(--color-bg-deep)" }}
            >
              {savedFilters.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground text-center">No saved views.</div>
              ) : (
                savedFilters.map((view) => (
                  <div key={view.id} className="flex items-center justify-between gap-2 p-1 hover:bg-secondary">
                    <button
                      type="button"
                      onClick={() => {
                        onChange(normalizeFilters(view.filters));
                        setViewsOpen(false);
                      }}
                      className="flex-1 text-left text-sm text-foreground hover:text-primary truncate font-bold"
                    >
                      {view.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFilter(view.id)}
                      className="text-muted-foreground hover:text-destructive p-0.5"
                      title="Delete view"
                    >
                      <X size={12} style={{ color: "var(--color-priority-p0)" }} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-0.5">
        <OpToggle
          value={filters.statusOp}
          options={[{ value: "is", label: "IS" }, { value: "is_not", label: "≠" }]}
          onChange={(statusOp) => onChange({ ...filters, statusOp })}
        />
        <FilterDropdown
          label="Status"
          options={STATUSES}
          selected={filters.statuses}
          onChange={(statuses) => onChange({ ...filters, statuses })}
          renderOption={(s) => <span>{STATUS_SHAPE[s]} {STATUS_LABEL[s]}</span>}
        />
      </div>
      <div className="flex items-center gap-0.5">
        <OpToggle
          value={filters.priorityOp}
          options={[{ value: "any", label: "IS" }, { value: "gte", label: "≥" }, { value: "lte", label: "≤" }]}
          onChange={(priorityOp) => onChange({ ...filters, priorityOp })}
        />
        <FilterDropdown
          label="Priority"
          options={PRIORITIES}
          selected={filters.priorities}
          onChange={(priorities) => onChange({ ...filters, priorities: filters.priorityOp === "any" ? priorities : priorities.slice(-1) })}
          renderOption={(p) => <span>{p.toUpperCase()}</span>}
        />
      </div>
      <FilterDropdown
        label="Project"
        options={projectNames}
        selected={filters.projects}
        onChange={(projects) => onChange({ ...filters, projects })}
        renderOption={(p) => <span>{p}</span>}
      />
      <FilterDropdown
        label="Type"
        options={TYPES}
        selected={filters.types}
        onChange={(types) => onChange({ ...filters, types })}
        renderOption={(t) => <span>{TYPE_ICON[t]} {t}</span>}
      />
      <FilterDropdown
        label="Tag"
        options={tagNames}
        selected={filters.tags}
        onChange={(tags) => onChange({ ...filters, tags })}
        renderOption={(t) => <span>#{t}</span>}
      />

      <button
        type="button"
        onClick={() => onChange({ ...filters, combineMode: filters.combineMode === "AND" ? "OR" : "AND" })}
        className="border px-2 py-1 text-sm font-bold transition-colors"
        style={{ borderColor: "var(--color-primary-gold)", backgroundColor: "var(--color-bg-panel)", color: "var(--color-primary-gold)" }}
        title="Toggle how the active filters combine"
      >
        Match: {filters.combineMode}
      </button>

      <input
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder="Search title, #tag, project, attachment..."
        aria-label="Search title, tag, project, or attachment"
        className="min-w-[160px] flex-1 border px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel)" }}
      />

      {activeCount > 0 && (
        <div className="flex items-center gap-2">
          {isSaving ? (
            <div className="flex items-center gap-1.5 border border-primary bg-card p-0.5">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="View name..."
                className="px-1.5 py-0.5 text-xs text-foreground bg-secondary border border-border outline-none"
                style={{ fontFamily: "VT323, monospace" }}
                autoFocus
              />
              <button
                type="button"
                onClick={handleSave}
                className="px-2 py-0.5 text-xs font-bold bg-primary text-deep border border-primary hover:opacity-90 active:translate-y-0.5"
                style={{ backgroundColor: "var(--color-primary-gold)", color: "var(--color-bg-deep)" }}
              >
                SAVE
              </button>
              <button
                type="button"
                onClick={() => setIsSaving(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X size={10} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSaving(true)}
              className="flex items-center gap-1.5 border px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel)" }}
            >
              💾 Save View
            </button>
          )}

          <button
            type="button"
            onClick={() => onChange(EMPTY_TASK_FILTERS)}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={12} /> Clear ({activeCount})
          </button>
        </div>
      )}
    </div>
  );
}
