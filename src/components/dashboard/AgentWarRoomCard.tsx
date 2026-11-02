"use client";

import { useEffect, useState, useCallback } from "react";
import { Bot, Terminal, Radio, Clock, Sparkles, ExternalLink, ShieldCheck, Cpu } from "lucide-react";
import { getAgentFleetStatus, type AgentFleetStatus, type AgentFleetItem } from "@/lib/actions/agent";
import { useTasks } from "@/components/providers/TasksProvider";

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
  const [fleet, setFleet] = useState<AgentFleetStatus | null>(null);
  const [loading, setLoading] = useState(true);
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
    // Poll every 10 seconds for real-time telemetry
    const timer = setInterval(() => {
      void refreshFleet();
    }, 10000);
    return () => clearInterval(timer);
  }, [refreshFleet]);

  // Second-level timer for active run elapsed clock
  useEffect(() => {
    if (!fleet?.activeRuns?.length) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [fleet?.activeRuns?.length]);

  if (loading && !fleet) {
    return (
      <div className="border-2 border-border/60 bg-card/60 p-3 text-xs font-mono text-muted-foreground flex items-center gap-2">
        <Radio size={14} className="animate-spin text-cyan-400" />
        <span>Syncing Agent Fleet Telemetry…</span>
      </div>
    );
  }

  const activeRun: AgentFleetItem | undefined = fleet?.activeRuns?.[0];
  const recentRun: AgentFleetItem | undefined = fleet?.recentRuns?.[0];
  const todayStats = fleet?.todayStats;

  // Active Run State
  if (activeRun) {
    const targetTask =
      tasks.find((t) => t.id === activeRun.task.id) ||
      allTimeTasks.find((t) => t.id === activeRun.task.id);

    return (
      <div className="border-2 border-cyan-500/80 bg-[var(--color-bg-panel)] p-3 sm:p-4 shadow-[0_0_20px_rgba(6,182,212,0.2)] animate-in fade-in duration-200">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/30 pb-2.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
            </span>
            <span className="font-display text-xs text-cyan-400 tracking-wider">
              ⚡ AGENT FLEET: LIVE RUNNING
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase bg-cyan-950/60 border border-cyan-500/50 text-cyan-300">
              {activeRun.agentName}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock size={12} className="text-cyan-400" />
              <span>Active {formatElapsed(activeRun.startedAt)}</span>
            </div>
            {todayStats && (
              <span className="hidden sm:inline border-l border-border/50 pl-3 text-muted-foreground">
                Today: {todayStats.totalTokens.toLocaleString()} tokens
              </span>
            )}
          </div>
        </div>

        {/* Quest Info Row */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap text-xs font-mono mb-1">
              {activeRun.task.projectName && (
                <span className="px-1.5 py-0.2 border border-border/60 bg-secondary/80 text-muted-foreground">
                  {activeRun.task.projectName}
                </span>
              )}
              {activeRun.chatName && (
                <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
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

          <button
            type="button"
            onClick={() => {
              if (targetTask) openEditForm(targetTask);
            }}
            className="pixel-button shrink-0 flex items-center gap-1.5 border-2 border-cyan-500 bg-cyan-950/80 px-3 py-1.5 text-xs font-mono font-bold text-cyan-300 hover:bg-cyan-900 transition-colors cursor-pointer"
          >
            <Terminal size={13} />
            <span>Inspect Quest</span>
            <ExternalLink size={11} className="opacity-70" />
          </button>
        </div>

        {/* Live Brain Callouts */}
        {activeRun.latestCheckpoint && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs font-mono">
            {activeRun.latestCheckpoint.nextStep && (
              <div className="p-2 border border-cyan-500/40 bg-cyan-950/20">
                <div className="text-[10px] uppercase font-bold text-cyan-400 mb-0.5 flex items-center gap-1">
                  <span>🎯 Next Milestone Target</span>
                </div>
                <div className="text-foreground leading-snug truncate">
                  {activeRun.latestCheckpoint.nextStep}
                </div>
              </div>
            )}

            {activeRun.latestCheckpoint.waitingReason && (
              <div className="p-2 border border-amber-500/40 bg-amber-950/20">
                <div className="text-[10px] uppercase font-bold text-amber-400 mb-0.5 flex items-center gap-1">
                  <span>⏸️ Idling / Waiting On</span>
                </div>
                <div className="text-foreground leading-snug truncate">
                  {activeRun.latestCheckpoint.waitingReason}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Telemetry Summary Strip */}
        <div className="mt-2.5 pt-2 border-t border-cyan-500/20 flex flex-wrap items-center justify-between text-[11px] font-mono text-muted-foreground gap-2">
          <div className="flex items-center gap-2 truncate">
            <Cpu size={12} className="text-cyan-400 shrink-0" />
            <span className="truncate">
              Run tokens: {activeRun.usage.totalTokens.toLocaleString()} ({activeRun.usage.promptTokens.toLocaleString()} in / {activeRun.usage.completionTokens.toLocaleString()} out)
            </span>
          </div>
          {activeRun.usage.costUsd > 0 && (
            <span className="text-cyan-400 font-bold">
              Est. Cost: ${activeRun.usage.costUsd.toFixed(4)}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Standby / Idle State
  return (
    <div className="border-2 border-border/80 bg-card p-3 sm:p-3.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={16} className="text-[var(--color-primary-gold)]" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display text-xs tracking-wider" style={{ color: "var(--color-primary-gold)" }}>
                🛡️ AGENT FLEET: STANDBY
              </span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 border border-border/80 bg-secondary text-muted-foreground">
                All Agents Idle
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-mono mt-0.5">
              {recentRun ? (
                <span>
                  Last active: <span className="font-semibold text-foreground">[{recentRun.task.code || "QUEST"}]</span> {recentRun.task.title.slice(0, 45)}… ({formatTimeAgo(recentRun.endedAt || recentRun.startedAt)})
                </span>
              ) : (
                <span>Autonomous AI operating system ready for MCP requests.</span>
              )}
            </div>
          </div>
        </div>

        {todayStats && (
          <div className="flex items-center gap-3 text-xs font-mono border-t sm:border-t-0 sm:border-l border-border/60 pt-2 sm:pt-0 sm:pl-3">
            <div className="flex flex-col sm:items-end">
              <span className="text-[10px] text-muted-foreground uppercase">Today&apos;s AI Compute</span>
              <span className="font-bold text-foreground">
                {todayStats.totalTokens.toLocaleString()} tokens {todayStats.totalCostUsd > 0 ? `($${todayStats.totalCostUsd.toFixed(3)})` : ""}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
