import { PixBar } from "@/components/ui/PixBar";

/** XP progress meter — docs/03-design.md §10 (Dashboard) uses 24 blocks, the Sidebar's compact strip uses 10, the HUD navbar uses 8. */
export function XpBar({
  level,
  xpIntoLevel,
  xpForNextLevel,
  density = "default",
}: {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  density?: "default" | "compact" | "navbar";
}) {
  const pct = Math.round((xpIntoLevel / xpForNextLevel) * 100);

  if (density === "navbar") {
    return (
      <div className="flex items-center gap-2">
        <span
          className="font-display"
          style={{ color: "var(--color-xp-gold)", fontSize: "10px" }}
        >
          Lv.{level}
        </span>
        <PixBar
          value={xpIntoLevel}
          max={xpForNextLevel}
          colorVar="--color-xp-gold"
          blocks={8}
          showLabel={false}
        />
        <span className="text-sm shrink-0" style={{ color: "var(--color-text-muted)" }}>
          {pct}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="font-display"
        style={{ color: "var(--color-xp-gold)", fontSize: density === "compact" ? "10px" : "14px" }}
      >
        {level}
      </span>
      <div className="flex-1">
        <PixBar
          value={xpIntoLevel}
          max={xpForNextLevel}
          colorVar="--color-xp-gold"
          blocks={density === "compact" ? 10 : 20}
          showLabel={false}
        />
        <div className="mt-0.5 flex justify-between text-sm" style={{ color: "var(--color-text-muted)" }}>
          <span style={{ color: "var(--color-xp-gold)" }}>{xpIntoLevel} / {xpForNextLevel} XP</span>
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  );
}
