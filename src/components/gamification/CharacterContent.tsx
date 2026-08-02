"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTasks } from "@/components/providers/TasksProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { computeCharacterSheet, SKILL_META, STATS, calculateStreak, completedAt } from "@/lib/gamification";
import { TYPE_ICON } from "@/lib/mock-data";
import { updateUserProfileAction } from "@/lib/actions/user";

export default function CharacterContent() {
  const { data: session, update: updateSession } = useSession();
  const { tasks, allTimeTasks, bonusXp, bonusCoins } = useTasks();
  const { notify } = useNotifications();
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!formName.trim()) {
      notify("Name cannot be empty", "error");
      return;
    }
    setSaving(true);
    const result = await updateUserProfileAction(formName);
    if (result.success) {
      await updateSession({ user: { ...session?.user, name: formName } });
      notify("Name updated!");
      setIsEditing(false);
    } else {
      notify(result.error?.message ?? "Failed to update name", "error");
    }
    setSaving(false);
  };
  const sheet = useMemo(() => computeCharacterSheet(allTimeTasks, bonusXp, bonusCoins), [allTimeTasks, bonusXp, bonusCoins]);
  const streakDays = useMemo(() => calculateStreak(tasks), [tasks]);
  const taskXp = sheet.globalXP;

  const todayCompletedCount = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return tasks.filter((t) => {
      if (t.status !== "done") return false;
      const doneAt = completedAt(t);
      return doneAt ? doneAt.startsWith(todayStr) : false;
    }).length;
  }, [tasks]);

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
          <div className="flex gap-4 items-start">
            {/* Left: Avatar */}
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

            {/* Center: Name, Class, Quick Stats */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="mb-3 flex flex-col gap-2">
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="px-2 py-1 border border-border rounded text-base bg-card"
                    placeholder="Name"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-3 py-1 bg-primary text-primary-foreground rounded text-xs"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1 border border-border rounded text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mb-3 font-display text-base text-foreground flex justify-between items-center">
                  {session?.user?.name ?? "Aric Stormcloak"}
                  <button
                    onClick={() => {
                      setFormName(session?.user?.name ?? "");
                      setIsEditing(true);
                    }}
                    className="text-xs px-2 py-1 border border-border rounded hover:bg-primary/10"
                  >
                    Edit
                  </button>
                </div>
              )}
              <div className="mb-3 font-display text-[11px]" style={{ color: "var(--color-primary-gold)" }}>
                {sheet.classTitle.toUpperCase()}
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-1 px-2 py-1.5 text-[13px]" style={{ backgroundColor: "var(--color-bg-panel-alt)", border: "1px solid var(--color-border)", color: "var(--color-xp-gold)" }}>
                  <span>⚡</span>
                  <span className="font-display">{taskXp.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1.5 text-[13px]" style={{ backgroundColor: "var(--color-bg-panel-alt)", border: "1px solid var(--color-border)", color: "var(--color-coin)" }}>
                  <span>🪙</span>
                  <span className="font-display">{sheet.totalCoins}</span>
                </div>
                <div
                  title={todayCompletedCount === 0 ? "You need to complete a task today to fire the streak!" : "Streak active!"}
                  className="flex items-center gap-1 px-2 py-1.5 text-[13px]"
                  style={{
                    backgroundColor: "var(--color-bg-panel-alt)",
                    border: "1px solid var(--color-border)",
                    color: todayCompletedCount === 0 ? "var(--color-dim)" : "var(--color-streak-flame)",
                    cursor: "help",
                  }}
                >
                  <span style={{ filter: todayCompletedCount === 0 ? "grayscale(1) opacity(0.5)" : "none", display: "inline-block" }}>🔥</span>
                  <span className="font-display">{streakDays}d</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1.5 text-[13px]" style={{ backgroundColor: "var(--color-bg-panel-alt)", border: "1px solid var(--color-border)", color: "var(--color-status-ready)" }}>
                  <span>✓</span>
                  <span className="font-display">{sheet.completedCount}</span>
                </div>
              </div>
            </div>

            {/* Right: Attributes */}
            <div className="shrink-0">
              <div className="grid grid-cols-6 gap-3">
                {STATS.map((stat) => {
                  const fullNames = { STR: "Strength", DEX: "Dexterity", CON: "Constitution", INT: "Intelligence", WIS: "Wisdom", CHA: "Charisma" };
                  const descriptions = {
                    STR: "Physical power & combat",
                    DEX: "Speed & agility",
                    CON: "Health & endurance",
                    INT: "Learning & magic",
                    WIS: "Awareness & insight",
                    CHA: "Influence & leadership"
                  };
                  return (
                    <div key={stat} className="px-3 py-4 text-center" style={{ backgroundColor: "var(--color-bg-panel-alt)", border: "1.5px solid var(--color-border)" }}>
                      <div className="font-display text-[24px] font-bold text-foreground">{sheet.statScore[stat]}</div>
                      <div className="text-[11px] text-muted-foreground mt-1.5 font-semibold">{fullNames[stat]}</div>
                      <div className="text-[9px] text-muted-foreground mt-1">{descriptions[stat]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Skill grid */}
        <div className="p-4">
          <div className="mb-2 font-display text-[10px] tracking-widest" style={{ color: "var(--color-status-ready)" }}>
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
                    <span style={{ fontSize: "22px" }}>{TYPE_ICON[skill.type]}</span>
                    <div>
                      <div className="text-base font-bold capitalize" style={{ color: isEmpty ? "var(--color-dim)" : "var(--color-text-primary)" }}>{skill.type}</div>
                      <div className="font-display text-[8px]" style={{ color: `var(${meta.colorVar})` }}>{meta.title.toUpperCase()}</div>
                    </div>
                  </div>
                  <div className="mb-2 text-[13px]" style={{ color: "var(--color-dim)", lineHeight: 1.4 }}>{meta.desc}</div>
                  <div className="mb-1" style={{ height: 6, backgroundColor: "var(--color-bg-panel-alt)", border: "1px solid var(--color-border)" }}>
                    <div style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: isEmpty ? "var(--color-dim)" : `var(${meta.colorVar})` }} />
                  </div>
                  <div className="flex justify-between text-[12px]" style={{ color: "var(--color-dim)" }}>
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
