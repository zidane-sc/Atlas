/** Segmented pixel-block meter — docs/03-design.md §5 ("dialogue-box" pixel aesthetic, not a smooth fill). */
export function PixBar({
  value,
  max,
  colorVar = "--color-status-ready",
  blocks = 16,
  showLabel = true,
  className,
}: {
  value: number;
  max: number;
  colorVar?: string;
  blocks?: number;
  showLabel?: boolean;
  className?: string;
}) {
  const filled = max > 0 ? Math.round((value / max) * blocks) : 0;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="flex flex-1 gap-[2px]">
        {Array.from({ length: blocks }).map((_, i) => (
          <div
            key={i}
            className="h-2.5 flex-1 border"
            style={{
              backgroundColor: i < filled ? `var(${colorVar})` : "var(--color-bg-panel-alt)",
              borderColor: i < filled ? `var(${colorVar})` : "var(--color-border)",
            }}
          />
        ))}
      </div>
      {showLabel && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {value}/{max}
        </span>
      )}
    </div>
  );
}
