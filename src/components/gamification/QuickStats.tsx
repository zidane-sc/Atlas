interface QuickStatsProps {
  xp: number;
  coins: number;
  streak: number;
  quests: number;
}

export function QuickStats({ xp, coins, streak, quests }: QuickStatsProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 text-[11px]">
        <div
          className="flex items-center gap-1 px-2 py-1"
          style={{
            backgroundColor: "var(--color-bg-panel-alt)",
            border: "1px solid var(--color-border)",
            color: "var(--color-xp-gold)",
          }}
        >
          <span>⚡</span>
          <span className="font-display">{xp.toLocaleString()}</span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1"
          style={{
            backgroundColor: "var(--color-bg-panel-alt)",
            border: "1px solid var(--color-border)",
            color: "var(--color-coin)",
          }}
        >
          <span>🪙</span>
          <span className="font-display">{coins}</span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1"
          style={{
            backgroundColor: "var(--color-bg-panel-alt)",
            border: "1px solid var(--color-border)",
            color: "var(--color-streak-flame)",
          }}
        >
          <span>🔥</span>
          <span className="font-display">{streak}d</span>
        </div>
        <div
          className="flex items-center gap-1 px-2 py-1"
          style={{
            backgroundColor: "var(--color-bg-panel-alt)",
            border: "1px solid var(--color-border)",
            color: "var(--color-status-ready)",
          }}
        >
          <span>✓</span>
          <span className="font-display">{quests}</span>
        </div>
      </div>
    </div>
  );
}
