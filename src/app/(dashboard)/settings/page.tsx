"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { useTasks } from "@/components/providers/TasksProvider";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { useSprints } from "@/components/providers/SprintsProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { computeCharacterSheet } from "@/lib/gamification";
import { updateUserProfileAction } from "@/lib/actions/user";
import { getWorkspaceHistoryForExport, getTasksForExport, importWorkspaceData, type ActivityLogExport, type WorkSessionExport } from "@/lib/actions/import";
import type { Project, Sprint } from "@/types/gamification";
import type { Task } from "@/types/task";

const EXPORT_VERSION = 2;

interface AtlasExport {
  version: number;
  tasks: Task[];
  projects: Project[];
  sprints: Sprint[];
  settings: { reduceMotion: boolean };
  bonus: { xp: number; coins: number };
  /** Added in version 2 — absent on older export files, defaulted to [] on import. */
  workSessions?: WorkSessionExport[];
  activityLogs?: ActivityLogExport[];
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
  const { data: session, update: updateSession } = useSession();
  const { allTimeTasks, bonusXp, bonusCoins, reset: resetTasks } = useTasks();
  const { projects, reset: resetProjects } = useProjects();
  const { sprints, reset: resetSprints } = useSprints();
  const { settings, updateSetting, reduceMotion, setReduceMotion } = useSettings();
  const { notify } = useNotifications();
  const sheet = useMemo(() => computeCharacterSheet(allTimeTasks, bonusXp, bonusCoins), [allTimeTasks, bonusXp, bonusCoins]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(session?.user?.name ?? "");
  const [savingName, setSavingName] = useState(false);

  const getSetting = useCallback((key: string, defaultValue?: any): any => {
    const setting = settings.find((s) => s.key === key);
    if (setting !== undefined) return setting?.value;
    if (defaultValue !== undefined) return defaultValue;
    return false;
  }, [settings]);

  const handleSaveName = async () => {
    if (!nameInput.trim()) {
      notify("Name cannot be empty", "error");
      return;
    }
    setSavingName(true);
    const result = await updateUserProfileAction(nameInput);
    if (result.success) {
      await updateSession({ user: { ...session?.user, name: nameInput } });
      notify("Name updated!");
      setIsEditingName(false);
    } else {
      notify(result.error?.message ?? "Failed to update name", "error");
    }
    setSavingName(false);
  };

  const handleToggle = useCallback((key: string) => {
    const current = getSetting(key);
    void updateSetting(key, !current);
  }, [getSetting, updateSetting]);

  const onExport = async () => {
    const [history, tasksForExport] = await Promise.all([getWorkspaceHistoryForExport(), getTasksForExport()]);
    if (!tasksForExport.success) {
      notify(tasksForExport.error?.message ?? "Failed to export tasks.", "error");
      return;
    }
    const payload: AtlasExport = {
      version: EXPORT_VERSION,
      tasks: tasksForExport.data.tasks,
      projects,
      sprints,
      settings: { reduceMotion },
      bonus: { xp: bonusXp, coins: bonusCoins },
      workSessions: history.success ? history.data.workSessions : [],
      activityLogs: history.success ? history.data.activityLogs : [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "atlas-export.json";
    a.click();
    URL.revokeObjectURL(url);
    notify("Exported everything — tasks, projects, sprints, settings, focus timer history, activity log, and bonus XP/coins.");
  };

  const onImportFile = async (file: File) => {
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!isAtlasExport(data)) throw new Error("Not a recognized Atlas export file.");
      const result = await importWorkspaceData({
        tasks: data.tasks,
        projects: data.projects,
        sprints: data.sprints,
        bonus: data.bonus ?? { xp: 0, coins: 0 },
        workSessions: data.workSessions ?? [],
        activityLogs: data.activityLogs ?? [],
      });
      if (!result.success) throw new Error(result.error.message);
      if (data.settings) setReduceMotion(data.settings.reduceMotion);
      notify(`Imported ${data.tasks.length} tasks, ${data.projects.length} projects, ${data.sprints.length} sprints. Reloading…`);
      // A full workspace restore replaces everything the DB holds — every provider needs
      // to re-hydrate from fresh server data, which a client-side dispatch can't do for
      // all of them at once, so reload rather than trying to patch each provider's state.
      window.location.reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Import failed — file isn't valid JSON.", "error");
    }
  };

  const onResetAll = () => {
    resetTasks();
    resetProjects();
    resetSprints();
    notify("Reset to starting data.");
  };

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
        <Toggle checked={!!getSetting("notifications")} onChange={() => handleToggle("notifications")} label="Notifications" description="Overdue and sprint deadline alerts" />
        <Toggle checked={!!getSetting("soundEnabled")} onChange={() => handleToggle("soundEnabled")} label="Sound Effects" description="Subtle chimes on task complete and level-up" />
        <Toggle checked={!!reduceMotion} onChange={setReduceMotion} label="Reduce Motion" description="Shortens all animation durations" />
        <Toggle checked={!!getSetting("compactView")} onChange={() => handleToggle("compactView")} label="Compact View" description="Tighter spacing in list and table views" />

        <SectionDivider>Pomodoro Timer</SectionDivider>
        <div className="flex items-center justify-between border-b border-border py-3">
          <div>
            <div className="text-sm text-foreground">Focus Duration</div>
            <div className="text-sm text-muted-foreground">Minutes per focus interval</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={120}
              value={getSetting("focusMinutes", 25) as number}
              onChange={(e) => void updateSetting("focusMinutes", Math.max(1, Math.min(120, Number(e.target.value))))}
              className="w-16 border border-border bg-card px-2 py-1 text-center text-sm"
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>
        <div className="flex items-center justify-between border-b border-border py-3">
          <div>
            <div className="text-sm text-foreground">Break Duration</div>
            <div className="text-sm text-muted-foreground">Minutes per break interval</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={120}
              value={getSetting("breakMinutes", 5) as number}
              onChange={(e) => void updateSetting("breakMinutes", Math.max(1, Math.min(120, Number(e.target.value))))}
              className="w-16 border border-border bg-card px-2 py-1 text-center text-sm"
            />
            <span className="text-sm text-muted-foreground">min</span>
          </div>
        </div>

        <SectionDivider>App Preferences</SectionDivider>
        <div className="border-b border-border py-3">
          <div className="mb-1 text-sm text-foreground">Default View</div>
          <div className="mb-2 text-sm text-muted-foreground">Screen shown on app open</div>
          <select
            value={getSetting("defaultView") as string}
            onChange={(e) => void updateSetting("defaultView", e.target.value)}
            className="border-2 border-border bg-secondary px-2 py-1 text-sm text-foreground"
          >
            <option value="dashboard">Command Center</option>
            <option value="today">Today</option>
            <option value="focus">Focus</option>
            <option value="kanban">Kanban</option>
          </select>
        </div>

        <SectionDivider>Account</SectionDivider>
        <div className="border-b border-border py-3">
          <div className="mb-2 text-sm text-muted-foreground">Adventurer Name</div>
          {isEditingName ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 border border-border bg-card px-2 py-1 text-sm rounded"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs"
              >
                {savingName ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setIsEditingName(false);
                  setNameInput(session?.user?.name ?? "");
                }}
                className="px-3 py-1 border border-border rounded text-xs"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">{session?.user?.name ?? "Aric Stormcloak"}</span>
              <button
                onClick={() => {
                  setNameInput(session?.user?.name ?? "");
                  setIsEditingName(true);
                }}
                className="text-xs px-2 py-1 border border-border rounded hover:bg-primary/10"
              >
                Edit
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-b border-border py-2">
          <span className="text-sm text-muted-foreground">Coins</span>
          <span className="text-sm text-foreground">🪙 {sheet.totalCoins}</span>
        </div>

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
