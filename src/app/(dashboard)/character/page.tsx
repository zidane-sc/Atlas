"use client";

import { useMemo } from "react";
import { useTasks } from "@/components/providers/TasksProvider";
import { computeCharacterSheet, SKILL_META, STATS, calculateStreak } from "@/lib/gamification";
import { TYPE_ICON } from "@/lib/mock-data";
import { CharacterCard } from "@/components/gamification/CharacterCard";
import { QuickStats } from "@/components/gamification/QuickStats";
import { StatsGrid } from "@/components/gamification/StatsGrid";

export default function Page() {
  const { tasks, bonusXp, bonusCoins } = useTasks();
  const sheet = useMemo(() => computeCharacterSheet(tasks, bonusXp, bonusCoins), [tasks, bonusXp, bonusCoins]);
  const streakDays = useMemo(() => calculateStreak(tasks), [tasks]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-2" style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}>
        <h1 className="font-display text-[9px]" style={{ color: "var(--color-primary-gold)" }}>⚔ CHARACTER SHEET</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Hero section - compact grid */}
        <div
          className="p-4"
          style={{ background: "linear-gradient(135deg, var(--color-bg-panel-alt) 0%, var(--color-bg-deep) 100%)", borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-start">
            {/* Left: Character card */}
            <div>
              <CharacterCard
                name="Aric Stormcloak"
                class={sheet.classTitle}
                level={sheet.globalLevel}
                avatar="🧙"
              />
            </div>

            {/* Center: Quick stats */}
            <div className="flex flex-col justify-center">
              <QuickStats
                xp={sheet.globalXP}
                coins={sheet.totalCoins}
                streak={streakDays}
                quests={sheet.completedCount}
              />
            </div>

            {/* Right: Attribute stats */}
            <div>
              <StatsGrid stats={sheet.statScore} />
            </div>
          </div>
        </div>

        {/* Skill grid */}
        <div className="p-4">
          <div className="mb-3 font-display text-[8px] tracking-widest" style={{ color: "var(--color-status-ready)" }}>
            ▸ SKILL PROFICIENCIES
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
            {sheet.skills.map((skill) => {
              const meta = SKILL_META[skill.type];
              const isEmpty = skill.count === 0;
              const pct = skill.nextLevelXP > 0 ? Math.min(1, skill.currentXP / skill.nextLevelXP) : 1;
              return (
                <div
                  key={skill.type}
                  className="relative bg-card p-2.5"
                  style={{
                    border: `1.5px solid ${isEmpty ? "var(--color-border)" : `var(${meta.colorVar})`}`,
                    borderLeftWidth: "3px",
                    opacity: isEmpty ? 0.45 : 1,
                  }}
                >
                  <div
                    className="absolute top-1.5 right-1.5 border font-display text-[7px]"
                    style={{
                      color: isEmpty ? "var(--color-dim)" : `var(${meta.colorVar})`,
                      borderColor: isEmpty ? "var(--color-border)" : `var(${meta.colorVar})`,
                      padding: "1px 4px",
                    }}
                  >
                    LV.{skill.level}
                  </div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span style={{ fontSize: "18px" }}>{TYPE_ICON[skill.type]}</span>
                    <div>
                      <div className="text-xs font-bold capitalize" style={{ color: isEmpty ? "var(--color-dim)" : "var(--color-text-primary)" }}>{skill.type}</div>
                      <div className="font-display text-[6px]" style={{ color: `var(${meta.colorVar})` }}>{meta.title.toUpperCase()}</div>
                    </div>
                  </div>
                  <div className="mb-2 text-xs" style={{ color: "var(--color-dim)", lineHeight: 1.3 }}>{meta.desc}</div>
                  <div className="mb-1" style={{ height: 4, backgroundColor: "var(--color-bg-panel-alt)", border: "1px solid var(--color-border)" }}>
                    <div style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: isEmpty ? "var(--color-dim)" : `var(${meta.colorVar})` }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: "var(--color-dim)" }}>
                    <span>{isEmpty ? "—" : `${skill.count}q`}</span>
                    {!isEmpty && <span className="text-[10px]">{skill.currentXP}/{skill.nextLevelXP}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
