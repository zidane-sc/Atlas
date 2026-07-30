"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { useTasks } from "@/components/providers/TasksProvider";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { useSprints } from "@/components/providers/SprintsProvider";
import { computeAchievementProgress, computeUnlockedAchievements } from "@/lib/gamification";
import { mockAchievements } from "@/lib/mock-data";
import type { AchievementCategory } from "@/types/gamification";

const CATEGORIES: { key: AchievementCategory; label: string; colorVar: string }[] = [
  { key: "combat", label: "combat", colorVar: "--color-priority-p0" },
  { key: "exploration", label: "exploration", colorVar: "--color-status-ready" },
  { key: "crafting", label: "crafting", colorVar: "--color-status-in-progress" },
  { key: "social", label: "social", colorVar: "--color-status-waiting-external" },
];

type Filter = "all" | "unlocked" | "locked";

export default function Page() {
  const { tasks } = useTasks();
  const { projects } = useProjects();
  const { sprints } = useSprints();
  const [filter, setFilter] = useState<Filter>("all");
  const unlockStatus = computeUnlockedAchievements(tasks, projects, sprints);
  const achievements = mockAchievements.map((a) => ({ ...a, ...unlockStatus[a.id] }));
  const unlocked = achievements.filter((a) => a.unlocked).length;
  const earnedXP = achievements.filter((a) => a.unlocked).reduce((s, a) => s + a.xp, 0);
  const filtered = achievements.filter((a) => (filter === "all" ? true : filter === "unlocked" ? a.unlocked : !a.unlocked));

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <div>
          <h1 style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "11px", color: "var(--color-primary-gold)" }}>
            🏆 ACHIEVEMENTS
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: "var(--color-text-muted)" }}>
            {unlocked}/{achievements.length} unlocked · {earnedXP} XP earned
          </p>
        </div>
        <div className="flex gap-1">
          {(["all", "unlocked", "locked"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-0.5 text-sm transition-colors"
              style={{
                border: `1px solid ${filter === f ? "var(--color-primary-gold)" : "var(--color-border)"}`,
                color: filter === f ? "var(--color-primary-gold)" : "var(--color-text-muted)",
                backgroundColor: filter === f ? "var(--color-bg-panel)" : "transparent",
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {CATEGORIES.map((cat) => {
          const items = filtered.filter((a) => a.category === cat.key);
          if (items.length === 0) return null;
          return (
            <div key={cat.key} className="mb-6">
              <div className="mt-5 mb-2 flex items-center gap-2">
                <span className="text-sm" style={{ color: "var(--color-primary-gold)" }}>▸</span>
                <span className="text-sm tracking-widest uppercase" style={{ color: "var(--color-text-muted)" }}>
                  {cat.label.toUpperCase()} DEEDS
                </span>
                <div className="h-px flex-1" style={{ backgroundColor: "var(--color-border)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {items.map((a) => {
                  const progress = !a.unlocked ? computeAchievementProgress(a.id, tasks, projects, sprints) : null;
                  const progressPct = progress ? Math.min(1, progress.current / progress.max) : 0;
                  return (
                    <div
                      key={a.id}
                      className="flex flex-col p-4"
                      style={{
                        backgroundColor: "var(--color-bg-panel)",
                        border: `2px solid ${a.unlocked ? "var(--color-primary-gold)" : "var(--color-border)"}`,
                        opacity: a.unlocked ? 1 : progress && progress.current > 0 ? 0.85 : 0.5,
                      }}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <span className="text-3xl leading-none">{a.icon}</span>
                        {a.unlocked ? (
                          <span
                            className="px-1.5 py-0.5 text-sm"
                            style={{ color: "var(--color-status-ready)", border: "1px solid var(--color-status-ready)" }}
                          >
                            ✓ DONE
                          </span>
                        ) : progress && progress.current > 0 ? (
                          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                            {progress.current}/{progress.max}
                          </span>
                        ) : (
                          <Lock size={12} style={{ color: "var(--color-dim)" }} />
                        )}
                      </div>
                      <div
                        className="mb-1 text-sm font-bold"
                        style={{ color: a.unlocked ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
                      >
                        {a.name}
                      </div>
                      <p className="mb-3 flex-1 text-sm leading-tight" style={{ color: "var(--color-dim)" }}>
                        {a.description}
                      </p>
                      {progress && progress.current > 0 && !a.unlocked && (
                        <div className="mb-2">
                          <div className="mb-1 flex gap-[2px]">
                            {Array.from({ length: 10 }).map((_, i) => (
                              <div
                                key={i}
                                className="h-1.5 flex-1"
                                style={{
                                  backgroundColor: i < Math.round(progressPct * 10) ? `var(${cat.colorVar})` : "var(--color-bg-panel-alt)",
                                  border: `1px solid ${i < Math.round(progressPct * 10) ? `var(${cat.colorVar})` : "var(--color-border)"}`,
                                }}
                              />
                            ))}
                          </div>
                          <div className="text-sm" style={{ color: "var(--color-dim)" }}>
                            {Math.round(progressPct * 100)}% complete
                          </div>
                        </div>
                      )}
                      <div className="mt-auto flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: `var(${cat.colorVar})` }}>
                          +{a.xp} XP
                        </span>
                        {a.unlocked && a.unlockedAt && (
                          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                            {a.unlockedAt}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
