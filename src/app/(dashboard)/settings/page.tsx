"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { useTasks } from "@/components/providers/TasksProvider";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { useSprints } from "@/components/providers/SprintsProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { computeCharacterSheet } from "@/lib/gamification";
import { dashboardMock } from "@/lib/mock-data";
import type { Project, Sprint } from "@/types/gamification";
import type { Task } from "@/types/task";

const EXPORT_VERSION = 1;

interface AtlasExport {
  version: number;
  tasks: Task[];
  projects: Project[];
  sprints: Sprint[];
  settings: { reduceMotion: boolean };
  bonus: { xp: number; coins: number };
}

function isAtlasExport(data: unknown): data is AtlasExport {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.tasks) && Array.isArray(d.projects) && Array.isArray(d.sprints);
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-5 mb-2 flex items-center gap-2">
      <span className="text-sm" style={{ color: "var(--color-primary-gold)" }}>▸</span>
      <span className="text-sm tracking-widest text-muted-foreground uppercase">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start justify-between border-b border-border py-3">
      <div>
        <div className="text-sm text-foreground">{label}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative mt-0.5 ml-4 h-5 w-11 shrink-0 border-2 transition-colors"
        style={{
          backgroundColor: checked ? "var(--color-primary-gold)" : "var(--color-bg-panel-alt)",
          borderColor: checked ? "var(--color-primary-gold)" : "var(--color-border)",
        }}
      >
        <span
          className="absolute top-0.5 left-0.5 h-3.5 w-3.5 bg-foreground transition-transform"
          style={{ transform: checked ? "translateX(22px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

export default function Page() {
  const { tasks, bonusXp, bonusCoins, reset: resetTasks, loadTasks } = useTasks();
  const { projects, reset: resetProjects, loadProjects } = useProjects();
  const { sprints, reset: resetSprints, loadSprints } = useSprints();
  const { reduceMotion, setReduceMotion } = useSettings();
  const { toast } = useToast();
  const sheet = useMemo(() => computeCharacterSheet(tasks, bonusXp, bonusCoins), [tasks, bonusXp, bonusCoins]);
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(true);
  const [compact, setCompact] = useState(false);
  const [autoArchive, setAutoArchive] = useState(true);
  const [defaultView, setDefaultView] = useState("dashboard");
  const importInputRef = useRef<HTMLInputElement>(null);

  const onExport = () => {
    const payload: AtlasExport = {
      version: EXPORT_VERSION,
      tasks,
      projects,
      sprints,
      settings: { reduceMotion },
      bonus: { xp: bonusXp, coins: bonusCoins },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "atlas-export.json";
    a.click();
    URL.revokeObjectURL(url);
    toast("Exported everything — tasks, projects, sprints, settings, and bonus XP/coins.");
  };

  const onImportFile = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!isAtlasExport(data)) throw new Error("Not a recognized Atlas export file.");
      loadTasks(data.tasks, data.bonus?.xp ?? 0, data.bonus?.coins ?? 0);
      loadProjects(data.projects);
      loadSprints(data.sprints);
      if (data.settings) setReduceMotion(data.settings.reduceMotion);
      toast(`Imported ${data.tasks.length} tasks, ${data.projects.length} projects, ${data.sprints.length} sprints.`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Import failed — file isn't valid JSON.", "error");
    }
  };

  const onResetAll = () => {
    resetTasks();
    resetProjects();
    resetSprints();
    toast("Reset to starting data.");
  };

  const account: [string, string][] = [
    ["Adventurer Name", "Aric Stormcloak"],
    ["Guild", "Squad Lead · Uni · Freelancer"],
    ["Streak", `${dashboardMock.streakDays} days`],
    ["Coins", `🪙 ${sheet.totalCoins}`],
  ];

  const shortcuts: [string, string][] = [
    ["Ctrl+K", "Open command palette"],
    ["Ctrl+N", "New quest"],
    ["Esc", "Close panel / palette"],
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-3" style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}>
        <h1 className="font-display" style={{ fontSize: "11px", color: "var(--color-primary-gold)" }}>⚙ SETTINGS</h1>
      </div>

      <div className="max-w-2xl flex-1 overflow-y-auto p-6">
        <SectionDivider>Experience</SectionDivider>
        <Toggle checked={notifications} onChange={setNotifications} label="Notifications" description="Overdue and sprint deadline alerts" />
        <Toggle checked={sound} onChange={setSound} label="Sound Effects" description="Subtle chimes on task complete and level-up" />
        <Toggle checked={reduceMotion} onChange={setReduceMotion} label="Reduce Motion" description="Shortens all animation durations" />
        <Toggle checked={compact} onChange={setCompact} label="Compact View" description="Tighter spacing in list and table views" />
        <Toggle checked={autoArchive} onChange={setAutoArchive} label="Auto-Archive" description="Archive completed tasks after 7 days" />

        <div className="border-b border-border py-3">
          <div className="mb-1 text-sm text-foreground">Default View</div>
          <div className="mb-2 text-sm text-muted-foreground">Screen shown on app open</div>
          <select
            value={defaultView}
            onChange={(e) => setDefaultView(e.target.value)}
            className="border-2 border-border bg-secondary px-2 py-1 text-sm text-foreground"
          >
            <option value="dashboard">Command Center</option>
            <option value="today">Today</option>
            <option value="focus">Focus</option>
            <option value="kanban">Kanban</option>
          </select>
        </div>

        <SectionDivider>Account</SectionDivider>
        {account.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between border-b border-border py-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm text-foreground">{value}</span>
          </div>
        ))}

        <SectionDivider>Keyboard Shortcuts</SectionDivider>
        {shortcuts.map(([key, desc]) => (
          <div key={key} className="flex items-center justify-between border-b border-border py-2">
            <span className="text-sm text-muted-foreground">{desc}</span>
            <span className="border border-border bg-card px-2 py-0 text-sm" style={{ color: "var(--color-primary-gold)" }}>{key}</span>
          </div>
        ))}

        <SectionDivider>Data</SectionDivider>
        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={onExport}>Export JSON</Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onImportFile(file);
            }}
          />
          <Button variant="secondary" onClick={() => importInputRef.current?.click()}>Import Data</Button>
          <ConfirmButton
            variant="destructive"
            size="default"
            confirmLabel="Reset everything?"
            onConfirm={onResetAll}
          >
            Reset All
          </ConfirmButton>
        </div>
      </div>
    </div>
  );
}
