import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PixBar } from "@/components/ui/PixBar";
import { TYPE_ICON } from "@/lib/mock-data";
import type { Task } from "@/types/task";

/** 1 SP ≈ 1 hour (docs/03-design.md §11) — the enemy's max HP, floor of 1 SP so a 0/unset-SP task still has a real fight. */
function estimatedSeconds(task: Task): number {
  return Math.max(1, task.storyPoint || 1) * 3600;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * Focus Battle Mode — a Work Session reskinned as a mini fight. The task is the "enemy",
 * elapsed focus time drains its HP bar in real time. Zero new schema: same activeTimer/
 * timeSpentSeconds state as the plain Focus Timer (docs/02-architecture.md §4.12), just a
 * different skin on top of it.
 */
export function BattleTimer({
  task,
  isTiming,
  totalSeconds,
  onStart,
  onStop,
  phase = "focus",
}: {
  task: Task;
  isTiming: boolean;
  totalSeconds: number;
  onStart: () => void;
  onStop: () => void;
  phase?: "focus" | "break";
}) {
  const maxHp = estimatedSeconds(task);
  const remainingHp = Math.max(0, maxHp - totalSeconds);
  const hpPct = remainingHp / maxHp;
  const defeated = remainingHp <= 0;

  const hpColorVar = phase === "break"
    ? "--color-status-waiting-external"
    : defeated
      ? "--color-dim"
      : hpPct > 0.5
        ? "--color-status-ready"
        : hpPct > 0.2
          ? "--color-priority-p1"
          : "--color-status-blocked";

  return (
    <div className="border-b border-border p-3" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
      <div className="mb-2 flex items-center gap-3">
        <span
          className="text-2xl leading-none"
          style={{
            filter: phase === "break" || defeated ? "grayscale(1)" : "none",
            animation: isTiming && !defeated && phase === "focus" ? "pixelPulse 1.5s ease-in-out infinite" : "none",
          }}
        >
          {phase === "break" ? "☕" : defeated ? "💀" : TYPE_ICON[task.type]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-bold text-foreground">{task.title}</div>
          <div className="text-base" style={{ color: `var(${hpColorVar})` }}>
            {phase === "break" ? `☕ BREAK — ${formatDuration(remainingHp)}` : defeated ? "DEFEATED" : `HP ${formatDuration(remainingHp)}`}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title={isTiming ? "Stop session" : task.status === "in_progress" ? "Start session" : "Set status to In Progress to start"}
          onClick={isTiming ? onStop : onStart}
          disabled={!isTiming && task.status !== "in_progress"}
        >
          {isTiming ? (
            <Pause size={14} style={{ color: "var(--color-status-blocked)" }} />
          ) : (
            <Play
              size={14}
              style={{ color: task.status === "in_progress" ? "var(--color-status-ready)" : "var(--color-dim)" }}
            />
          )}
        </Button>
      </div>

      <PixBar value={remainingHp} max={maxHp} colorVar={hpColorVar} blocks={20} showLabel={false} />

      <div className="mt-1.5 flex items-center justify-between text-base text-muted-foreground">
        <span className="font-display" style={{ color: isTiming ? "var(--color-status-ready)" : "var(--color-text-muted)" }}>
          {formatClock(totalSeconds)}
        </span>
        <span>Est {formatDuration(maxHp)}</span>
      </div>

      {!isTiming && task.status !== "in_progress" && !defeated && (
        <div
          className="mt-2 border border-dashed p-1.5 text-center text-base font-bold"
          style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}
        >
          ⚔ Set status to In Progress to start battle
        </div>
      )}

      {defeated && (
        <div
          className="mt-2 border-2 p-1.5 text-center text-base font-bold"
          style={{ borderColor: "var(--color-primary-gold)", color: "var(--color-primary-gold)" }}
        >
          ⚔ ENEMY DEFEATED
        </div>
      )}
    </div>
  );
}
