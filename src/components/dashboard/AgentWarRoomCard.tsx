"use client";

import { useEffect, useState, useCallback } from "react";
import { Terminal, Clock, ExternalLink, CheckCircle2, Square, Radio, ShieldCheck } from "lucide-react";
import { getAgentFleetStatus, concludeAgentRunAction, type AgentFleetStatus, type AgentFleetItem } from "@/lib/actions/agent";
import { useTasks } from "@/components/providers/TasksProvider";
import { useNotifications } from "@/hooks/useNotifications";

function formatElapsed(startedAtStr: string): string {
  const started = new Date(startedAtStr).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - started) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function formatTimeAgo(dateStr: string): string {
  const past = new Date(dateStr).getTime();
  const now = Date.now();
  const diffMin = Math.max(0, Math.floor((now - past) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

export function AgentWarRoomCard() {
  const { tasks, allTimeTasks, openEditForm } = useTasks();
  const { notify } = useNotifications();
  const [fleet, setFleet] = useState<AgentFleetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [, setTick] = useState(0);

  const refreshFleet = useCallback(async () => {
    try {
      const res = await getAgentFleetStatus();
      if (res.success) {
        setFleet(res.data);
      }
    } catch (e) {
      console.warn("Failed to refresh agent fleet:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshFleet();
    const timer = setInterval(() => {
      void refreshFleet();
    }, 8000);
    return () => clearInterval(timer);
  }, [refreshFleet]);

  // Clock ticker for active elapsed time
  useEffect(() => {
    if (!fleet?.activeRuns?.length) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [fleet?.activeRuns?.length]);

  const handleConclude = async (runId: string, markDone: boolean) => {
    setActing(true);
    try {
      const res = await concludeAgentRunAction(runId, markDone);
      if (res.success) {
        notify(
          markDone ? "Agent run concluded and quest marked DONE! ⚔️" : "Agent run concluded.",
          "success"
        );
        await refreshFleet();
      } else {
        notify(res.error.message, "error");
      }
    } catch {
      notify("Failed to conclude run", "error");
    } finally {
      setActing(false);
    }
  };

  if (loading && !fleet) {
    return (
      <div className="border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-mono text-muted-foreground flex items-center gap-2">
        <Radio size={13} className="animate-spin text-cyan-400" />
        <span>Connecting to Agent War-Room telemetry…</span>
      </div>
    );
  }

  const activeRun: AgentFleetItem | undefined = fleet?.activeRuns?.[0];
  const recentRun: AgentFleetItem | undefined = fleet?.recentRuns?.[0];
  const todayStats = fleet?.todayStats;

  // ─────────────────────────────────────────────────────────────
  // 1. LIVE RUNNING STATE (Dynamic Cyber-HUD with Real Actions)
  // ─────────────────────────────────────────────────────────────
  if (activeRun) {
    const targetTask =
      tasks.find((t) => t.id === activeRun.task.id) ||
      allTimeTasks.find((t) => t.id === activeRun.task.id);

    return (
      <div className="border-2 border-cyan-500 bg-[var(--color-bg-panel)] p-3.5 sm:p-4 shadow-[0_0_20px_rgba(6,182,212,0.22)] animate-in fade-in duration-200">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/30 pb-2.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
            <span className="font-display text-xs text-cyan-400 tracking-wider">
              ⚡ AGENT WAR-ROOM: LIVE RUNNING
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-cyan-950/80 border border-cyan-500/60 text-cyan-300">
              {activeRun.agentName}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Clock size={13} className="text-cyan-400" />
              <span>Active {formatElapsed(activeRun.startedAt)}</span>
            </div>
            {todayStats && (
              <span className="hidden sm:inline border-l border-border/50 pl-3 text-muted-foreground">
                Today: {todayStats.totalTokens.toLocaleString()} tokens (${todayStats.totalCostUsd.toFixed(3)})
              </span>
            )}
          </div>
        </div>

        {/* Task Identity & Location Row */}
        <div className="mt-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap text-xs font-mono mb-1">
              {activeRun.task.projectName && (
                <span className="px-1.5 py-0.2 border border-border/70 bg-secondary/80 text-muted-foreground">
                  {activeRun.task.projectName}
                </span>
              )}
              {activeRun.chatName && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                  📍 {activeRun.chatName}{activeRun.threadName ? ` > #${activeRun.threadName}` : ""}
                </span>
              )}
            </div>

            <div className="text-sm font-semibold text-foreground flex items-center gap-1.5 truncate">
              {activeRun.task.code && (
                <span className="text-[var(--color-primary-gold)] font-mono font-bold shrink-0">
                  [{activeRun.task.code}]
                </span>
              )}
              <span className="truncate">{activeRun.task.title}</span>
            </div>
          </div>

          {/* Action Deck: Real Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            <button
              type="button"
              disabled={acting}
              onClick={() => handleConclude(activeRun.id, true)}
              className="pixel-button flex items-center gap-1.5 border border-emerald-500/80 bg-emerald-950/80 hover:bg-emerald-900 px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-300 transition-colors cursor-pointer disabled:opacity-50"
              title="Mark quest Done and conclude agent run"
            >
              <CheckCircle2 size={13} />
              <span>Conclude &amp; Done</span>
            </button>

            <button
              type="button"
              disabled={acting}
              onClick={() => handleConclude(activeRun.id, false)}
              className="pixel-button flex items-center gap-1.5 border border-border bg-secondary hover:bg-secondary/80 px-2.5 py-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
              title="End active run without marking task done"
            >
              <Square size={12} />
              <span>Conclude</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (targetTask) openEditForm(targetTask);
              }}
              className="pixel-button flex items-center gap-1 border border-cyan-500 bg-cyan-950/70 hover:bg-cyan-900 px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-300 transition-colors cursor-pointer"
              title="Open quest drawer"
            >
              <Terminal size={12} />
              <span>Inspect</span>
              <ExternalLink size={10} className="opacity-70" />
            </button>
          </div>
        </div>

        {/* Real-Time Terminal Log Ticker */}
        {activeRun.latestLog && (
          <div className="mt-3 bg-black/60 border border-cyan-500/40 px-3 py-2 font-mono text-xs text-cyan-300 flex items-center gap-2">
            <span className="text-cyan-400 font-bold shrink-0">&gt;_</span>
            <span className="text-[10px] text-muted-foreground uppercase shrink-0 font-bold">
              STREAM:
            </span>
            <span className="truncate text-foreground/95 flex-1">
              {activeRun.latestLog}
            </span>
            <span className="animate-pulse text-cyan-400 font-bold shrink-0">█</span>
          </div>
        )}

        {/* Milestone & Target Callouts */}
        {activeRun.latestCheckpoint && (
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2 text-xs font-mono">
            {activeRun.latestCheckpoint.nextStep && (
              <div className="p-2 border border-cyan-500/30 bg-cyan-950/20">
                <div className="text-[10px] uppercase font-bold text-cyan-400 mb-0.5">
                  🎯 Next Milestone Target
                </div>
                <div className="text-foreground leading-snug truncate">
                  {activeRun.latestCheckpoint.nextStep}
                </div>
              </div>
            )}

            {activeRun.latestCheckpoint.waitingReason && (
              <div className="p-2 border border-amber-500/40 bg-amber-950/20">
                <div className="text-[10px] uppercase font-bold text-amber-400 mb-0.5">
                  ⏸️ Idling / Waiting On
                </div>
                <div className="text-foreground leading-snug truncate">
                  {activeRun.latestCheckpoint.waitingReason}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. STANDBY / IDLE STATE (Sleek, Space-Saving Compact Strip)
  // ─────────────────────────────────────────────────────────────
  const targetRecentTask = recentRun
    ? tasks.find((t) => t.id === recentRun.task.id) ||
      allTimeTasks.find((t) => t.id === recentRun.task.id)
    : null;

  return (
    <div className="border border-border/80 bg-[var(--color-bg-panel)] px-3.5 py-2.5 text-xs font-mono flex flex-wrap items-center justify-between gap-2.5 shadow-sm">
      {/* Left Identity + Status */}
      <div className="flex items-center gap-2.5 min-w-0">
        <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
        <span className="font-display text-xs tracking-wider text-[var(--color-primary-gold)] shrink-0">
          AGENT FLEET
        </span>
        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 border border-emerald-500/40 bg-emerald-950/40 text-emerald-400 shrink-0">
          STANDBY
        </span>

        {recentRun && (
          <span className="text-muted-foreground truncate hidden sm:inline ml-1">
            · Last:{" "}
            <button
              type="button"
              onClick={() => {
                if (targetRecentTask) openEditForm(targetRecentTask);
              }}
              className="text-foreground font-semibold hover:underline cursor-pointer"
            >
              [{recentRun.task.code || "QUEST"}] {recentRun.task.title.slice(0, 40)}…
            </button>{" "}
            ({formatTimeAgo(recentRun.endedAt || recentRun.startedAt)})
          </span>
        )}
      </div>

      {/* Right Stats & Quick Link */}
      <div className="flex items-center gap-3 text-muted-foreground shrink-0 text-xs">
        {todayStats && (
          <div>
            Compute Today: <strong className="text-foreground">{todayStats.totalTokens.toLocaleString()} tokens</strong>
            {todayStats.totalCostUsd > 0 && (
              <span className="text-emerald-400 font-bold ml-1">(${todayStats.totalCostUsd.toFixed(3)})</span>
            )}
          </div>
        )}

        {targetRecentTask && (
          <button
            type="button"
            onClick={() => openEditForm(targetRecentTask)}
            className="text-[var(--color-primary-gold)] hover:underline flex items-center gap-1 cursor-pointer font-bold border-l border-border/60 pl-3"
          >
            <span>Inspect Last</span>
            <ExternalLink size={11} />
          </button>
        )}
      </div>
    </div>
  );
}
