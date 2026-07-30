"use client";

import { useMemo } from "react";
import { useTasks } from "@/components/providers/TasksProvider";
import { computeCharacterSheet, SKILL_META, STATS } from "@/lib/gamification";
import { TYPE_ICON, dashboardMock } from "@/lib/mock-data";

export default function Page() {
  const { tasks, bonusXp, bonusCoins } = useTasks();
  const sheet = useMemo(() => computeCharacterSheet(tasks, bonusXp, bonusCoins), [tasks, bonusXp, bonusCoins]);

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-3" style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}>
        <h1 className="font-display" style={{ fontSize: "11px", color: "var(--color-primary-gold)" }}>⚔ CHARACTER SHEET</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Hero identity strip */}
        <div
          className="p-4"
          style={{ background: "linear-gradient(135deg, var(--color-bg-panel-alt) 0%, var(--color-bg-deep) 100%)", borderBottom: "1px solid var(--color-border)" }}
        >
          <div className="flex flex-wrap items-start gap-4">
            <div className="relative shrink-0">
              <div
                className="flex items-center justify-center bg-card"
                style={{ width: 88, height: 88, border: "3px solid var(--color-primary-gold)", fontSize: "44px", boxShadow: "0 0 24px rgba(240,180,41,0.3), inset 0 0 12px var(--color-bg-deep)" }}
              >
                🧙
              </div>
              <div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 font-display whitespace-nowrap"
                style={{ fontSize: "8px", color: "var(--color-bg-deep)", backgroundColor: "var(--color-primary-gold)", padding: "2px 6px" }}
              >
                LV.{sheet.globalLevel}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="mb-1 font-display text-sm text-foreground">Aric Stormcloak</div>
              <div className="mb-3 font-display text-[9px]" style={{ color: "var(--color-primary-gold)" }}>
                {sheet.classTitle.toUpperCase()}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span style={{ color: "var(--color-xp-gold)" }}>⚡ {sheet.globalXP.toLocaleString()} XP</span>
                <span style={{ color: "var(--color-coin)" }}>🪙 {sheet.totalCoins}</span>
                <span style={{ color: "var(--color-streak-flame)" }}>🔥 {dashboardMock.streakDays} day streak</span>
                <span style={{ color: "var(--color-status-ready)" }}>✓ {sheet.completedCount} quests</span>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2">
              {STATS.map((stat) => (
                <div key={stat} className="min-w-[52px] px-2.5 py-1.5 text-center" style={{ backgroundColor: "var(--color-bg-panel-alt)", border: "1px solid var(--color-border)" }}>
                  <div className="font-display text-[13px] text-foreground">{sheet.statScore[stat]}</div>
                  <div className="mt-1 text-sm text-muted-foreground" style={{ letterSpacing: "1px" }}>{stat}</div>
                  <div className="text-sm" style={{ color: "var(--color-dim)" }}>
                    +{Math.floor((sheet.statScore[stat] - 10) / 2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Skill grid */}
        <div className="p-4">
          <div className="mb-2 font-display text-[9px] tracking-widest" style={{ color: "var(--color-status-ready)" }}>
            ▸ SKILL PROFICIENCIES
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {sheet.skills.map((skill) => {
              const meta = SKILL_META[skill.type];
              const isEmpty = skill.count === 0;
              const pct = skill.nextLevelXP > 0 ? Math.min(1, skill.currentXP / skill.nextLevelXP) : 1;
              return (
                <div
                  key={skill.type}
                  className="relative bg-card p-3"
                  style={{
                    border: `1.5px solid ${isEmpty ? "var(--color-border)" : `var(${meta.colorVar})`}`,
                    borderLeftWidth: "3px",
                    opacity: isEmpty ? 0.45 : 1,
                  }}
                >
                  <div
                    className="absolute top-2.5 right-2.5 border font-display text-[9px]"
                    style={{
                      color: isEmpty ? "var(--color-dim)" : `var(${meta.colorVar})`,
                      borderColor: isEmpty ? "var(--color-border)" : `var(${meta.colorVar})`,
                      padding: "2px 6px",
                    }}
                  >
                    LV.{skill.level}
                  </div>
                  <div className="mb-1.5 flex items-center gap-2" style={{ marginRight: 52 }}>
                    <span style={{ fontSize: "20px" }}>{TYPE_ICON[skill.type]}</span>
                    <div>
                      <div className="text-sm font-bold capitalize" style={{ color: isEmpty ? "var(--color-dim)" : "var(--color-text-primary)" }}>{skill.type}</div>
                      <div className="font-display text-[7px]" style={{ color: `var(${meta.colorVar})` }}>{meta.title.toUpperCase()}</div>
                    </div>
                  </div>
                  <div className="mb-2 text-sm" style={{ color: "var(--color-dim)", lineHeight: 1.4 }}>{meta.desc}</div>
                  <div className="mb-1" style={{ height: 6, backgroundColor: "var(--color-bg-panel-alt)", border: "1px solid var(--color-border)" }}>
                    <div style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: isEmpty ? "var(--color-dim)" : `var(${meta.colorVar})` }} />
                  </div>
                  <div className="flex justify-between text-sm" style={{ color: "var(--color-dim)" }}>
                    <span>{isEmpty ? "No quests yet" : `${skill.count} quest${skill.count !== 1 ? "s" : ""} completed`}</span>
                    {!isEmpty && <span>{skill.currentXP}/{skill.nextLevelXP} XP</span>}
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
