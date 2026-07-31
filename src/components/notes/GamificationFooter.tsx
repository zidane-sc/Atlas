"use client";

import { calculateNoteXP } from "@/lib/gamification";

interface GamificationFooterProps {
  wordCount: number;
  hasStreak?: boolean;
  unlockedAchievements?: string[];
}

export function GamificationFooter({
  wordCount,
  hasStreak = false,
  unlockedAchievements = [],
}: GamificationFooterProps) {
  const xp = calculateNoteXP(wordCount, hasStreak);

  return (
    <div className="flex items-center justify-between gap-4 p-3 border-t-2 border-primary-gold text-xs text-muted-foreground bg-panel">
      {/* Left: Tags placeholder */}
      <div className="flex-1" />

      {/* Center: XP Display */}
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--color-primary-gold)", fontWeight: "bold" }}>
          +{xp} XP
        </span>
        {unlockedAchievements.length > 0 && (
          <span className="flex items-center gap-1">
            ⭐
            {unlockedAchievements.map((ach) => (
              <span key={ach}>{ach}</span>
            ))}
          </span>
        )}
      </div>

      {/* Right: Streak + Word Count */}
      <div className="flex items-center gap-3">
        {hasStreak && <span>🔥 Streak active</span>}
        <span>{wordCount} words</span>
      </div>
    </div>
  );
}
