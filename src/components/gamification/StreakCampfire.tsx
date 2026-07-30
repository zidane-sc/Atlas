/** Visual states — docs/03-design.md §11.6 */
function streakVisual(days: number): { icon: string; label: string } {
  if (days >= 30) return { icon: "🔥🔥🔥", label: "Blaze" };
  if (days >= 14) return { icon: "🔥🔥", label: "Bonfire" };
  if (days >= 7) return { icon: "🔥", label: "Steady Fire" };
  if (days >= 3) return { icon: "🕯️", label: "Small Flame" };
  return { icon: "✨", label: "Spark" };
}

export function StreakCampfire({ days }: { days: number }) {
  const { icon, label } = streakVisual(days);
  return (
    <div className="flex items-center gap-2 border-2 border-border bg-card px-3 py-2">
      <span aria-hidden className="text-lg">
        {icon}
      </span>
      <div>
        <div className="text-sm text-foreground">{days} day streak</div>
        <div className="text-xs" style={{ color: "var(--color-streak-flame)" }}>
          {label}
        </div>
      </div>
    </div>
  );
}
