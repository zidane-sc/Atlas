import { completedAt } from "@/lib/gamification";
import { MOCK_NOW, todaysDailyQuest } from "@/lib/mock-data";
import type { Task } from "@/types/task";

/** Rotating daily quest — docs/01-product.md §9.6 */
export function DailyQuestCard({
  tasks,
  claimed,
  onClaim,
}: {
  tasks: Task[];
  claimed: boolean;
  onClaim: () => void;
}) {
  const q = todaysDailyQuest;
  const progress = Math.min(
    tasks.filter((t) => t.status === "done" && completedAt(t)?.startsWith(MOCK_NOW) && q.matches(t)).length,
    q.goal
  );
  const done = progress >= q.goal;

  return (
    <div
      className="border-2 p-4"
      style={{
        backgroundColor: "var(--color-bg-panel)",
        borderColor: done ? (claimed ? "var(--color-dim)" : "var(--color-status-ready)") : "var(--color-border)",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-widest" style={{ color: "var(--color-primary-gold)" }}>◆ DAILY QUEST</span>
          {done && !claimed && (
            <span className="border px-1.5 text-xs" style={{ borderColor: "var(--color-status-ready)", color: "var(--color-status-ready)" }}>
              COMPLETE
            </span>
          )}
          {claimed && (
            <span className="border px-1.5 text-xs" style={{ borderColor: "var(--color-dim)", color: "var(--color-dim)" }}>
              CLAIMED
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span style={{ color: "var(--color-xp-gold)" }}>⚡ +{q.xp} XP</span>
          <span style={{ color: "var(--color-coin)" }}>🪙 +{q.coins}</span>
        </div>
      </div>
      <div className="mb-3 flex items-center gap-3">
        <span className="text-2xl">{q.icon}</span>
        <span className="flex-1 text-sm" style={{ color: done ? "var(--color-text-primary)" : "var(--color-text-muted)" }}>{q.label}</span>
        <span className="font-display text-xs" style={{ color: done ? "var(--color-status-ready)" : "var(--color-primary-gold)" }}>
          {progress}/{q.goal}
        </span>
      </div>
      <div className="mb-3 flex gap-[3px]">
        {Array.from({ length: q.goal }).map((_, i) => (
          <div
            key={i}
            className="h-2.5 flex-1 border"
            style={{
              backgroundColor: i < progress ? "var(--color-status-ready)" : "var(--color-bg-panel-alt)",
              borderColor: i < progress ? "var(--color-status-ready)" : "var(--color-border)",
            }}
          />
        ))}
      </div>
      {done && !claimed && (
        <button
          type="button"
          onClick={onClaim}
          className="w-full py-1.5 text-sm tracking-widest transition-all hover:brightness-110"
          style={{ backgroundColor: "rgba(78,204,163,0.15)", border: "2px solid var(--color-status-ready)", color: "var(--color-status-ready)" }}
        >
          ✓ CLAIM REWARD
        </button>
      )}
    </div>
  );
}
