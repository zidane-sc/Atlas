"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { useTasks } from "@/components/providers/TasksProvider";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { updateUserProfileAction } from "@/lib/actions/user";
import { getWorkspaceHistoryForExport, getTasksForExport, importWorkspaceData, type ActivityLogExport, type WorkSessionExport } from "@/lib/actions/import";
import { validateImportPayload } from "@/lib/validation/import-validation";
import { ImportPreviewModal } from "@/components/ImportPreviewModal";
import { playChime, playRetroBlip } from "@/lib/audio";
import {
  listCredentialsAction,
  createCredentialAction,
  revokeCredentialAction,
  type CredentialSummary,
} from "@/lib/actions/integrations";
import type { Project, Sprint } from "@/types/gamification";
import type { Task } from "@/types/task";

const EXPORT_VERSION = 3;

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
  decorations?: { purchased: string[]; placed: Record<string, string | null> };
  savedFilters?: any[];
}

function isAtlasExport(data: unknown): data is AtlasExport {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  // Minimal checks - tasks, projects, sprints are required
  // Other fields optional for backwards compatibility
  return Array.isArray(d.tasks) && Array.isArray(d.projects) && Array.isArray(d.sprints);
}

function migrateExportFormat(data: AtlasExport): AtlasExport {
  // Backwards compatibility migrations for older export versions
  const version = (data as any).version || 1;

  // v1 -> v2: added workSessions and activityLogs
  // v2 -> v3: added decorations, savedFilters
  // No schema changes needed, just fill in defaults for missing fields

  return {
    ...data,
    bonus: data.bonus ?? { xp: 0, coins: 0 },
    workSessions: data.workSessions ?? [],
    activityLogs: data.activityLogs ?? [],
    decorations: data.decorations,
    savedFilters: data.savedFilters ?? [],
  };
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
  extra,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3">
      <div>
        <div className="text-sm font-medium text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      <div className="flex items-center gap-2">
        {extra}
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className="relative mt-0.5 ml-2 h-5 w-10 shrink-0 border-2 transition-colors cursor-pointer"
          style={{
            backgroundColor: checked ? "var(--color-primary-gold)" : "var(--color-bg-panel-alt)",
            borderColor: checked ? "var(--color-primary-gold)" : "var(--color-border)",
          }}
        >
          <span
            className="absolute top-0.5 left-0.5 h-3 w-3 bg-foreground transition-transform"
            style={{ transform: checked ? "translateX(18px)" : "translateX(0)" }}
          />
        </button>
      </div>
    </div>
  );
}

export default function Page() {
  const { data: session, update: updateSession } = useSession();
  const { characterSheet, bonusXp, bonusCoins, reset: resetTasks } = useTasks();
  const { projects, reset: resetProjects } = useProjects();
  const {
    settings,
    updateSetting,
    reduceMotion,
    setReduceMotion,
    soundEnabled,
    focusMinutes,
    breakMinutes,
    notificationsEnabled,
    compactView,
    defaultView,
  } = useSettings();
  const { notify } = useNotifications();
  const sheet = characterSheet;
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(session?.user?.name || "Zidane Sc");
  const [savingName, setSavingName] = useState(false);

  // MCP Integrations State
  const [credentials, setCredentials] = useState<CredentialSummary[]>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [keyScopePreset, setKeyScopePreset] = useState<"all" | "read-write" | "read-only">("all");
  const [keyExpiryDays, setKeyExpiryDays] = useState<number | null>(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [selectedClient, setSelectedClient] = useState<"claude-code" | "hermes" | "cursor" | "claude-desktop" | "windsurf">("claude-code");
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    void listCredentialsAction().then((res) => {
      if (res?.success && res.data) setCredentials(res.data);
    }).catch(() => {});
  }, []);

  const handleGenerateKey = async () => {
    setCreatingKey(true);
    try {
      let scopes = ["all"];
      if (keyScopePreset === "read-write") scopes = ["tasks:read", "tasks:write", "runs:write", "comments:write"];
      if (keyScopePreset === "read-only") scopes = ["tasks:read"];

      const res = await createCredentialAction(newKeyLabel, scopes, keyExpiryDays);
      if (res?.success) {
        setGeneratedKey(res.data.plainToken);
        setCredentials((prev) => [res.data.credential, ...prev]);
        notify("MCP API Key generated!", "success");
      } else {
        notify(res?.error?.message || "Failed to generate key", "error");
      }
    } catch (e: any) {
      notify(e?.message || "Error generating key", "error");
    } finally {
      setCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      const res = await revokeCredentialAction(id);
      if (res?.success) {
        setCredentials((prev) => prev.filter((c) => c.id !== id));
        notify("API Key revoked", "success");
      } else {
        notify(res?.error?.message || "Failed to revoke key", "error");
      }
    } catch (e: any) {
      notify(e?.message || "Error revoking key", "error");
    }
  };
  const [importPreviewOpen, setImportPreviewOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<{
    counts: { tasks: number; projects: number; sprints: number; workSessions: number; activityLogs: number };
    errors: Array<{ category: string; index: number; itemName: string | null; message: string }>;
    payload: any;
  } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

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
      sprints: [],
      settings: { reduceMotion },
      bonus: { xp: bonusXp, coins: bonusCoins },
      workSessions: history.success ? history.data.workSessions : [],
      activityLogs: history.success ? history.data.activityLogs : [],
      decorations: tasksForExport.data.decorations,
      savedFilters: tasksForExport.data.savedFilters,
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
      const rawData: unknown = JSON.parse(await file.text());
      if (!isAtlasExport(rawData)) throw new Error("Not a recognized Atlas export file.");

      const data = migrateExportFormat(rawData as AtlasExport);
      const version = (rawData as any).version || 1;
      if (version > EXPORT_VERSION) {
        console.warn(`Import file version ${version} is newer than current version ${EXPORT_VERSION}. Some data may be lost.`);
      }

      const importPayload = {
        tasks: data.tasks,
        projects: data.projects,
        sprints: data.sprints,
        bonus: data.bonus,
        workSessions: data.workSessions,
        activityLogs: data.activityLogs,
        decorations: data.decorations,
        savedFilters: data.savedFilters,
      };

      // Validate and show preview
      const validation = validateImportPayload(importPayload);
      setImportPreviewData({
        counts: validation.counts,
        errors: validation.errors,
        payload: importPayload,
      });
      setImportPreviewOpen(true);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Import failed — file isn't valid JSON.", "error");
    }
  };

  const onConfirmImport = async () => {
    if (!importPreviewData) return;
    setIsImporting(true);
    try {
      const result = await importWorkspaceData(importPreviewData.payload);
      if (!result.success) throw new Error(result.error.message);

      // Extract settings from the original payload if available
      const rawData = importPreviewData.payload;
      if (rawData.settings) setReduceMotion(rawData.settings.reduceMotion);

      notify(`Imported ${importPreviewData.counts.tasks} tasks, ${importPreviewData.counts.projects} projects, ${importPreviewData.counts.sprints} sprints. Reloading…`);
      window.location.reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Import failed.", "error");
      setIsImporting(false);
    }
  };

  const onResetAll = () => {
    resetTasks();
    resetProjects();
    notify("Reset to starting data.");
  };

  const shortcuts: [string, string][] = [
    ["Ctrl+K", "Open command palette"],
    ["Ctrl+N", "New quest"],
    ["Esc", "Close panel / palette"],
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-2.5" style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}>
        <h1 className="font-display" style={{ fontSize: "11px", color: "var(--color-primary-gold)" }}>⚙ SETTINGS</h1>
      </div>

      <div className="max-w-2xl flex-1 overflow-y-auto p-4 sm:p-5">
        <SectionDivider>Experience</SectionDivider>
        <Toggle
          checked={notificationsEnabled}
          onChange={(val) => void updateSetting("notifications", val)}
          label="In-App Notifications"
          description="Toast banners for task completions, updates, and due alerts"
        />
        <Toggle
          checked={soundEnabled}
          onChange={(val) => {
            void updateSetting("soundEnabled", val);
            if (val) playRetroBlip();
          }}
          label="Sound Effects (SFX)"
          description="Subtle 8-bit chimes on task complete, level-up, and UI interactions"
          extra={
            <button
              type="button"
              onClick={() => {
                playChime();
              }}
              className="pixel-button border border-border bg-card px-2 py-0.5 text-xs font-mono text-[var(--color-primary-gold)] hover:border-[var(--color-primary-gold)] cursor-pointer"
              title="Click to play sample chime"
            >
              🔊 TEST
            </button>
          }
        />
        <Toggle
          checked={reduceMotion}
          onChange={setReduceMotion}
          label="Reduce Motion"
          description="Shortens all animation durations to instant (0.01ms)"
        />
        <Toggle
          checked={compactView}
          onChange={(val) => void updateSetting("compactView", val)}
          label="Compact View"
          description="Dense spacing in task lists and smart views"
        />

        <SectionDivider>Pomodoro Timer</SectionDivider>
        <div className="flex items-center justify-between border-b border-border py-3">
          <div>
            <div className="text-sm font-medium text-foreground">Focus Duration</div>
            <div className="text-xs text-muted-foreground">Minutes per focus interval</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={120}
              value={focusMinutes}
              onChange={(e) => void updateSetting("focusMinutes", Math.max(1, Math.min(120, Number(e.target.value))))}
              className="w-16 border border-border bg-card px-2 py-1 text-center text-xs font-mono"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>
        <div className="flex items-center justify-between border-b border-border py-3">
          <div>
            <div className="text-sm font-medium text-foreground">Break Duration</div>
            <div className="text-xs text-muted-foreground">Minutes per break interval</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={120}
              value={breakMinutes}
              onChange={(e) => void updateSetting("breakMinutes", Math.max(1, Math.min(120, Number(e.target.value))))}
              className="w-16 border border-border bg-card px-2 py-1 text-center text-xs font-mono"
            />
            <span className="text-xs text-muted-foreground">min</span>
          </div>
        </div>

        <SectionDivider>App Preferences</SectionDivider>
        <div className="border-b border-border py-3">
          <div className="mb-0.5 text-sm font-medium text-foreground">Default View</div>
          <div className="mb-2 text-xs text-muted-foreground">Screen shown on app open</div>
          <select
            value={defaultView}
            onChange={(e) => void updateSetting("defaultView", e.target.value)}
            className="border-2 border-border bg-secondary px-2 py-1 text-xs font-mono text-foreground"
          >
            <option value="dashboard">Command Center</option>
            <option value="today">Today</option>
            <option value="focus">Focus</option>
            <option value="kanban">Kanban</option>
          </select>
        </div>

        <SectionDivider>Account</SectionDivider>
        <div className="border-b border-border py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-foreground">Adventurer Name</span>
            <span className="text-xs text-muted-foreground">{session?.user?.email}</span>
          </div>
          <div className="text-xs text-muted-foreground mb-3">Your character display name across quests, logs, and character sheet.</div>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter character name"
                className="pixel-panel flex-1 border-2 border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-[var(--color-primary-gold)]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") {
                    setIsEditingName(false);
                    setNameInput(session?.user?.name || "Zidane Sc");
                  }
                }}
              />
              <button
                type="button"
                onClick={handleSaveName}
                disabled={savingName}
                className="pixel-button border-2 border-[var(--color-primary-gold)] bg-[var(--color-primary-gold)] px-3 py-1.5 text-xs font-bold text-black disabled:opacity-50 cursor-pointer"
              >
                {savingName ? "SAVING..." : "SAVE"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingName(false);
                  setNameInput(session?.user?.name || "Zidane Sc");
                }}
                className="pixel-button border-2 border-border bg-card px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-bold" style={{ color: "var(--color-primary-gold)" }}>
                {session?.user?.name && session.user.name !== "Passcode" ? session.user.name : "Zidane Sc"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setNameInput(session?.user?.name && session.user.name !== "Passcode" ? session.user.name : "Zidane Sc");
                  setIsEditingName(true);
                }}
                className="pixel-button border border-border bg-card px-2.5 py-1 text-xs text-foreground hover:border-[var(--color-primary-gold)] cursor-pointer"
              >
                EDIT
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-b border-border py-2.5">
          <span className="text-sm font-medium text-foreground">Coins</span>
          <span className="font-mono text-sm text-[var(--color-coin)] font-bold">🪙 {sheet.totalCoins}</span>
        </div>

        <SectionDivider>Keyboard Shortcuts</SectionDivider>
        {shortcuts.map(([key, desc]) => (
          <div key={key} className="flex items-center justify-between border-b border-border py-2.5">
            <span className="text-sm text-muted-foreground">{desc}</span>
            <span className="border border-border bg-card px-2 py-0.5 text-xs font-mono font-bold" style={{ color: "var(--color-primary-gold)" }}>{key}</span>
          </div>
        ))}

        <SectionDivider>AI Agent Integrations (MCP)</SectionDivider>
        <div className="border-b border-border py-3">
          <div className="text-sm font-medium text-foreground mb-1">Model Context Protocol (MCP) Server</div>
          <div className="text-xs text-muted-foreground mb-3">
            Hubungkan AI Agent seperti Hermes, Claude Desktop, atau Cursor untuk query, buat, dan lacak status quest secara otomatis.
          </div>

          <div className="p-3 border border-border bg-card mb-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[var(--color-primary-gold)]">ENDPOINT:</span>
              <span className="text-xs font-mono select-all text-muted-foreground">https://atlas-zidane-scs-projects.vercel.app/api/mcp</span>
            </div>
            <div className="flex items-center justify-between border-t border-border/40 pt-2">
              <span className="text-xs font-mono font-bold text-[var(--color-primary-gold)]">TRANSPORT:</span>
              <span className="text-xs font-mono text-muted-foreground">Streamable HTTP (Stateless JSON-RPC)</span>
            </div>
          </div>

          {generatedKey && (
            <div className="p-3 border-2 border-[var(--color-primary-gold)] bg-[rgba(255,217,61,0.08)] mb-4">
              <div className="text-xs font-bold text-[var(--color-primary-gold)] mb-1">API TOKEN BERHASIL DIGENERATE (SIMPAN SEKARANG):</div>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  readOnly
                  value={generatedKey}
                  className="flex-1 px-2 py-1 text-xs font-mono border border-border bg-black text-[var(--color-primary-gold)] select-all outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedKey);
                    setCopiedKey(true);
                    setTimeout(() => setCopiedKey(false), 2000);
                  }}
                  className="pixel-button px-3 py-1 text-xs border border-[var(--color-primary-gold)] bg-[var(--color-primary-gold)] text-black font-bold cursor-pointer"
                >
                  {copiedKey ? "COPIED!" : "COPY"}
                </button>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Gunakan token ini pada panduan setup agent di bawah untuk menghubungkan client Anda.
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 mb-4 p-2.5 border border-border bg-card/40">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newKeyLabel}
                onChange={(e) => setNewKeyLabel(e.target.value)}
                placeholder="Label token (contoh: Claude Code / Cursor)"
                className="px-2.5 py-1 text-xs font-mono border border-border bg-card flex-1 outline-none focus:border-[var(--color-primary-gold)]"
              />
              <button
                type="button"
                disabled={creatingKey}
                onClick={handleGenerateKey}
                className="pixel-button border border-[var(--color-primary-gold)] bg-[var(--color-primary-gold)] px-3 py-1 text-xs font-bold text-black cursor-pointer disabled:opacity-50"
              >
                {creatingKey ? "CREATING..." : "+ GENERATE KEY"}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/40">
              <div className="flex items-center gap-1.5">
                <span>Scope:</span>
                <select
                  value={keyScopePreset}
                  onChange={(e) => setKeyScopePreset(e.target.value as any)}
                  className="bg-secondary/70 border border-border px-1.5 py-0.5 text-[11px] font-mono text-foreground outline-none cursor-pointer"
                >
                  <option value="all">Full Access (All Permissions)</option>
                  <option value="read-write">Read & Write (Tasks, Runs, Comments)</option>
                  <option value="read-only">Read-Only (Tasks Query Only)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span>Expires in:</span>
                <select
                  value={keyExpiryDays === null ? "never" : String(keyExpiryDays)}
                  onChange={(e) => setKeyExpiryDays(e.target.value === "never" ? null : Number(e.target.value))}
                  className="bg-secondary/70 border border-border px-1.5 py-0.5 text-[11px] font-mono text-foreground outline-none cursor-pointer"
                >
                  <option value="never">Never (Permanent)</option>
                  <option value="30">30 Days</option>
                  <option value="90">90 Days</option>
                  <option value="7">7 Days</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interactive Agent Setup Guides & Tutorials */}
          <div className="p-3 border border-border bg-card/70 mb-4">
            <div className="text-xs font-mono font-bold text-[var(--color-primary-gold)] uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Setup Guide per AI Client:</span>
              <span className="text-[10px] text-muted-foreground font-normal">Pilih client untuk instruksi setup</span>
            </div>

            {/* Client Tabs */}
            <div className="flex flex-wrap gap-1 mb-3 border-b border-border/60 pb-2">
              {[
                { id: "claude-code" as const, label: "💻 Claude Code" },
                { id: "hermes" as const, label: "🦅 Hermes Agent" },
                { id: "cursor" as const, label: "⚡ Cursor" },
                { id: "claude-desktop" as const, label: "🖥️ Claude Desktop" },
                { id: "windsurf" as const, label: "🌊 Windsurf" },
              ].map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedClient(c.id)}
                  className={`px-2 py-1 text-xs font-mono transition-colors cursor-pointer border ${
                    selectedClient === c.id
                      ? "border-[var(--color-primary-gold)] bg-[var(--color-bg-panel)] text-[var(--color-primary-gold)] font-bold"
                      : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Client Tutorial Body */}
            {(() => {
              const tokenValue = generatedKey || (credentials.length > 0 ? `${credentials[0].tokenPrefix}...` : "<YOUR_ATLAS_TOKEN>");
              const guides: Record<typeof selectedClient, { title: string; subtitle: string; fileLabel: string; snippet: string; note: string }> = {
                "claude-code": {
                  title: "Claude Code CLI",
                  subtitle: "Hubungkan Atlas ke Claude Code dalam 1 baris perintah terminal:",
                  fileLabel: "Jalankan di Terminal:",
                  snippet: `claude mcp add atlas https://atlas-zidane-scs-projects.vercel.app/api/mcp -H "Authorization: Bearer ${tokenValue}"`,
                  note: "Claude Code otomatis membaca aturan SOP dari deskripsi tool Atlas: auto-create quest di awal (Turn 1), logging temuan di comments, dan update status ke done saat tuntas.",
                },
                "hermes": {
                  title: "Hermes Agent",
                  subtitle: "Konfigurasi untuk Hermes Agent (Telegram / Self-Hosted daemon):",
                  fileLabel: "Tambahkan ke ~/.hermes/config.yaml:",
                  snippet: `mcp_servers:\n  atlas:\n    url: "https://atlas-zidane-scs-projects.vercel.app/api/mcp"\n    headers:\n      Authorization: "Bearer ${tokenValue}"`,
                  note: "Simpan token di ~/.hermes/.env sebagai ATLAS_MCP_TOKEN, lalu kirim perintah /reload-mcp di chat Telegram.",
                },
                "cursor": {
                  title: "Cursor IDE",
                  subtitle: "Buka Cursor Settings ➔ Features ➔ MCP, atau buat file .cursor/mcp.json di root project:",
                  fileLabel: ".cursor/mcp.json:",
                  snippet: JSON.stringify({
                    mcpServers: {
                      atlas: {
                        url: "https://atlas-zidane-scs-projects.vercel.app/api/mcp",
                        headers: {
                          Authorization: `Bearer ${tokenValue}`,
                        },
                      },
                    },
                  }, null, 2),
                  note: "Simpan file lalu klik refresh MCP servers di Cursor. Indikator lampu status akan menyala hijau.",
                },
                "claude-desktop": {
                  title: "Claude Desktop",
                  subtitle: "Edit file konfigurasi claude_desktop_config.json di komputer Anda:",
                  fileLabel: "macOS: ~/Library/Application Support/Claude/ | Windows: %APPDATA%\\Claude\\",
                  snippet: JSON.stringify({
                    mcpServers: {
                      atlas: {
                        url: "https://atlas-zidane-scs-projects.vercel.app/api/mcp",
                        headers: {
                          Authorization: `Bearer ${tokenValue}`,
                        },
                      },
                    },
                  }, null, 2),
                  note: "Restart aplikasi Claude Desktop setelah menyimpan file untuk memuat 8 tools Atlas.",
                },
                "windsurf": {
                  title: "Windsurf (Codeium)",
                  subtitle: "Tambahkan konfigurasi server ke ~/.codeium/windsurf/mcp_config.json:",
                  fileLabel: "~/.codeium/windsurf/mcp_config.json:",
                  snippet: JSON.stringify({
                    mcpServers: {
                      atlas: {
                        serverUrl: "https://atlas-zidane-scs-projects.vercel.app/api/mcp",
                        headers: {
                          Authorization: `Bearer ${tokenValue}`,
                        },
                      },
                    },
                  }, null, 2),
                  note: "Buka Cascade panel di Windsurf untuk mulai memanggil Atlas quest tools.",
                },
              };

              const current = guides[selectedClient];

              return (
                <div className="flex flex-col gap-2 font-mono text-xs">
                  <div className="text-foreground font-semibold">{current.title}</div>
                  <div className="text-muted-foreground text-[11px]">{current.subtitle}</div>

                  <div className="relative mt-1">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-black/60 px-2 py-1 border-t border-x border-border">
                      <span className="truncate">{current.fileLabel}</span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(current.snippet);
                          setCopiedSnippet(true);
                          setTimeout(() => setCopiedSnippet(false), 2000);
                        }}
                        className="text-[var(--color-primary-gold)] hover:underline cursor-pointer font-bold shrink-0 ml-2"
                      >
                        {copiedSnippet ? "COPIED!" : "COPY"}
                      </button>
                    </div>
                    <pre className="p-2.5 bg-black/90 border border-border text-[11px] font-mono overflow-x-auto text-green-400 leading-relaxed select-all">
                      {current.snippet}
                    </pre>
                  </div>

                  <div className="p-2 bg-secondary/30 border border-border text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    💡 <span className="text-foreground font-medium">Tips:</span> {current.note}
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Active Keys:</div>
            {credentials.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-1">Belum ada API key aktif.</div>
            ) : (
              credentials.map((cred) => (
                <div key={cred.id} className="flex items-center justify-between p-2 border border-border bg-card/60">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground truncate">{cred.label}</span>
                      <span className="text-[10px] font-mono px-1 py-0 border border-border bg-secondary text-muted-foreground">
                        {cred.tokenPrefix}...
                      </span>
                      <span className={`text-[9px] font-mono px-1 py-0 border ${cred.scopes.includes("all") ? "border-amber-500/40 text-amber-400 bg-amber-950/20" : "border-cyan-500/40 text-cyan-400 bg-cyan-950/20"}`}>
                        {cred.scopes.includes("all") ? "ALL" : cred.scopes.includes("tasks:write") ? "READ-WRITE" : "READ-ONLY"}
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5 flex items-center gap-3">
                      <span>Last seen: {cred.lastUsedAt ? new Date(cred.lastUsedAt).toLocaleDateString() : "Never"}</span>
                      {cred.expiresAt && (
                        <span className="text-amber-400/90 font-medium">Expires: {new Date(cred.expiresAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeKey(cred.id)}
                    className="text-[10px] font-mono text-red-400 hover:text-red-300 border border-red-500/30 px-2 py-0.5 hover:bg-red-500/10 cursor-pointer"
                  >
                    REVOKE
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

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
      {importPreviewData && (
        <ImportPreviewModal
          isOpen={importPreviewOpen}
          counts={importPreviewData.counts}
          errors={importPreviewData.errors}
          isLoading={isImporting}
          onCancel={() => {
            setImportPreviewOpen(false);
            setImportPreviewData(null);
          }}
          onConfirm={onConfirmImport}
        />
      )}
    </div>
  );
}
