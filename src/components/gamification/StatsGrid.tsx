interface StatsGridProps {
  stats: Record<string, number>;
}

export function StatsGrid({ stats }: StatsGridProps) {
  const statEntries = Object.entries(stats);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-[8px] font-display" style={{ color: "var(--color-status-ready)" }}>
        ATTRIBUTES
      </div>
      <div className="grid grid-cols-2 gap-2">
        {statEntries.map(([stat, value]) => (
          <div
            key={stat}
            className="flex flex-col items-center gap-0.5 px-2 py-1.5"
            style={{
              backgroundColor: "var(--color-bg-panel-alt)",
              border: "1px solid var(--color-border)",
            }}
          >
            <div className="font-display text-[11px] text-foreground">{value}</div>
            <div className="text-[7px] text-muted-foreground">{stat}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
