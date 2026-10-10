"use client";

import { useEffect, useState } from "react";
import { useTasks } from "@/components/providers/TasksProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Pause, Play, Square, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function GlobalActiveTimer() {
  const { activeTimer, tasks, stopTimer, switchPhase, openEditForm } = useTasks();
  const { focusMinutes, breakMinutes } = useSettings();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!activeTimer) {
      setElapsed(0);
      return;
    }

    const update = () => {
      const now = Date.now();
      const sec = Math.max(0, Math.floor((now - activeTimer.startedAt) / 1000));
      setElapsed(sec);

      const limit = (activeTimer.phase === "focus" ? focusMinutes : breakMinutes) * 60;
      if (sec >= limit) {
        switchPhase(activeTimer.taskId);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeTimer, focusMinutes, breakMinutes, switchPhase]);

  if (!activeTimer) return null;

  const currentTask = tasks.find((t) => t.id === activeTimer.taskId);
  const isBreak = activeTimer.phase === "break";
  const limitSeconds = (isBreak ? breakMinutes : focusMinutes) * 60;
  const remaining = Math.max(0, limitSeconds - elapsed);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 border-2 p-2.5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
      style={{
        backgroundColor: "var(--color-bg-deep)",
        borderColor: isBreak ? "var(--color-status-ready)" : "var(--color-primary-gold)",
        boxShadow: "4px 4px 0px rgba(0,0,0,0.8)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="text-lg leading-none"
          style={{ animation: !isBreak ? "pixelPulse 1.5s ease-in-out infinite" : "none" }}
        >
          {isBreak ? "☕" : "⚔️"}
        </span>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className="font-display text-xs tracking-widest"
              style={{ color: isBreak ? "var(--color-status-ready)" : "var(--color-primary-gold)" }}
            >
              {isBreak ? "REST PHASE" : "FOCUS BATTLE"}
            </span>
            {currentTask && (
              <button
                type="button"
                onClick={() => openEditForm(currentTask)}
                className="text-xs font-mono font-bold hover:underline opacity-80"
                style={{ color: "var(--color-primary-gold)" }}
                title="Open Quest"
              >
                [{currentTask.code}]
              </button>
            )}
          </div>
          <span className="max-w-[180px] truncate text-xs text-foreground font-medium">
            {currentTask?.title || "Focusing..."}
          </span>
        </div>
      </div>

      <div
        className="font-mono text-base font-bold px-2 py-0.5 border"
        style={{
          color: isBreak ? "var(--color-status-ready)" : "var(--color-primary-gold)",
          borderColor: "var(--color-border)",
          backgroundColor: "var(--color-bg-panel)",
        }}
      >
        {formatClock(remaining)}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          onClick={() => stopTimer()}
          title="Stop & Log Session"
          className="hover:bg-red-950/40"
        >
          <Square size={12} style={{ color: "var(--color-status-blocked)", fill: "var(--color-status-blocked)" }} />
        </Button>
      </div>
    </div>
  );
}
