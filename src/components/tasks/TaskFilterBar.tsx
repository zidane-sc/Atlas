"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { STATUS_LABEL, STATUS_SHAPE, TYPE_ICON } from "@/lib/mock-data";
import { countActiveFilters, type TaskFilters } from "@/lib/task-filters";
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

export function TaskFilterBar({
  filters,
  onChange,
  projectNames,
}: {
  filters: TaskFilters;
  onChange: (filters: TaskFilters) => void;
  projectNames: string[];
}) {
  const activeCount = countActiveFilters(filters);

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-4 py-2"
      style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
    >
      <FilterDropdown
        label="Status"
        options={STATUSES}
        selected={filters.statuses}
        onChange={(statuses) => onChange({ ...filters, statuses })}
        renderOption={(s) => <span>{STATUS_SHAPE[s]} {STATUS_LABEL[s]}</span>}
      />
      <FilterDropdown
        label="Priority"
        options={PRIORITIES}
        selected={filters.priorities}
        onChange={(priorities) => onChange({ ...filters, priorities })}
        renderOption={(p) => <span>{p.toUpperCase()}</span>}
      />
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

      <input
        value={filters.query}
        onChange={(e) => onChange({ ...filters, query: e.target.value })}
        placeholder="Search title or #tag..."
        aria-label="Search title or tag"
        className="min-w-[160px] flex-1 border px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-bg-panel)" }}
      />

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => onChange({ statuses: [], priorities: [], projects: [], types: [], query: "" })}
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <X size={12} /> Clear ({activeCount})
        </button>
      )}
    </div>
  );
}
