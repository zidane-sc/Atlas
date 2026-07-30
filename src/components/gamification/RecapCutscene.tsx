"use client";

import { useEffect, useState } from "react";
import { getStreakVibe, type RecapGrade } from "@/lib/gamification";

export interface RecapData {
  period: "week" | "month";
  done: number;
  prevDone: number;
  created: number;
  xpEarned: number;
  streak: number;
  topProject: { name: string; emoji: string; colorVar: string };
  grade: RecapGrade;
}

const GRADE_CFG: Record<RecapGrade, { colorVar: string; label: string; sub: string }> = {
  S: { colorVar: "--color-xp-gold", label: "S RANK", sub: "LEGENDARY WEEK" },
  A: { colorVar: "--color-status-done", label: "A RANK", sub: "OUTSTANDING" },
  B: { colorVar: "--color-status-ready", label: "B RANK", sub: "SOLID PROGRESS" },
  C: { colorVar: "--color-status-in-progress", label: "C RANK", sub: "KEEP PUSHING" },
  D: { colorVar: "--color-text-muted", label: "D RANK", sub: "ROUGH WEEK" },
};

/** Ramps 0 → target over `duration`ms once `active` flips true — reference's useCountUp. */
function useCountUp(target: number, duration: number, active: boolean) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active || target === 0) return;
    let cur = 0;
    const step = target / (duration / 16);
    const id = setInterval(() => {
      cur = Math.min(cur + step, target);
      setV(Math.floor(cur));
      if (cur >= target) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, [active, target, duration]);
  return v;
}

function SlideCard({ show, delay = 0, children }: { show: boolean; delay?: number; children: React.ReactNode }) {
  return (
    <div
      style={{
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(18px)",
        transition: `opacity 0.45s ${delay}ms ease, transform 0.45s ${delay}ms ease`,
        pointerEvents: show ? "auto" : "none",
      }}
    >
      {children}
    </div>
  );
}

/** Weekly/Monthly Recap cutscene — docs/03-design.md §11.10 */
export function RecapCutscene({ data, onClose }: { data: RecapData; onClose: () => void }) {
  const [phase, setPhase] = useState(0);
  // Phase timeline: 0=intro 1=title 2=done 3=xp 4=project 5=streak 6=grade 7=close reveal
  useEffect(() => {
    const delays = [400, 900, 1700, 2500, 3200, 3900, 4700];
    const ids = delays.map((ms, i) => setTimeout(() => setPhase(i + 1), ms));
    return () => ids.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const cntDone = useCountUp(data.done, 900, phase >= 2);
  const cntXP = useCountUp(data.xpEarned, 900, phase >= 3);
  const cntStreak = useCountUp(data.streak, 600, phase >= 5);
  const streakVibe = getStreakVibe(data.streak);
  const g = GRADE_CFG[data.grade];
  const delta = data.done - data.prevDone;
  const up = delta >= 0;
  const velocityPct = Math.round((data.done / Math.max(data.created, 1)) * 100);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center"
      style={{ backgroundColor: "rgba(5,7,12,0.97)" }}
      role="dialog"
      aria-modal
    >
      {/* scanlines overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.18) 3px, rgba(0,0,0,0.18) 4px)",
          zIndex: 1,
        }}
      />

      <div className="relative z-10 flex w-full max-w-lg flex-col items-center gap-7 px-6">
        <SlideCard show={phase >= 1}>
          <div className="text-center">
            <div
              className="font-display mb-2.5"
              style={{ fontSize: "9px", color: "var(--color-text-muted)", animation: phase >= 1 ? "recapTitle 0.6s ease forwards" : "none" }}
            >
              {data.period === "week" ? "◈ WEEKLY RECAP" : "◈ MONTHLY RECAP"}
            </div>
            <div
              className="font-display"
              style={{ fontSize: "22px", color: "var(--color-primary-gold)", textShadow: "0 0 30px rgba(240,180,41,0.4)", letterSpacing: "0.15em" }}
            >
              {data.period === "week" ? "WEEK" : "MONTH"} COMPLETE
            </div>
          </div>
        </SlideCard>

        <div className="grid w-full grid-cols-2 gap-3">
          <SlideCard show={phase >= 2}>
            <div
              className="bg-card p-5 text-center"
              style={{ border: "2px solid var(--color-status-ready)", boxShadow: "0 0 16px color-mix(in srgb, var(--color-status-ready) 20%, transparent)" }}
            >
              <div className="font-display" style={{ fontSize: "32px", color: "var(--color-status-ready)", lineHeight: 1 }}>{cntDone}</div>
              <div className="mt-2 text-sm tracking-widest text-muted-foreground">QUESTS SLAIN</div>
              <div className="mt-1 text-sm" style={{ color: up ? "var(--color-status-done)" : "var(--color-status-blocked)" }}>
                {up ? "↑" : "↓"} {Math.abs(delta)} vs last {data.period}
              </div>
            </div>
          </SlideCard>

          <SlideCard show={phase >= 3} delay={60}>
            <div
              className="bg-card p-5 text-center"
              style={{ border: "2px solid var(--color-xp-gold)", boxShadow: "0 0 16px color-mix(in srgb, var(--color-xp-gold) 20%, transparent)" }}
            >
              <div className="font-display" style={{ fontSize: "32px", color: "var(--color-xp-gold)", lineHeight: 1 }}>{cntXP}</div>
              <div className="mt-2 text-sm tracking-widest text-muted-foreground">XP EARNED</div>
              <div className="mt-1 text-sm" style={{ color: "var(--color-coin)" }}>🪙 +{Math.floor(data.xpEarned / 8)} coins</div>
            </div>
          </SlideCard>

          <SlideCard show={phase >= 4}>
            <div
              className="bg-card p-5 text-center"
              style={{ border: `2px solid var(${data.topProject.colorVar})`, boxShadow: `0 0 16px color-mix(in srgb, var(${data.topProject.colorVar}) 20%, transparent)` }}
            >
              <div style={{ fontSize: "32px", lineHeight: 1 }}>{data.topProject.emoji}</div>
              <div className="mt-2 text-sm font-bold text-foreground">{data.topProject.name}</div>
              <div className="mt-1 text-sm tracking-widest text-muted-foreground">TOP PROJECT</div>
            </div>
          </SlideCard>

          <SlideCard show={phase >= 5} delay={60}>
            <div
              className="bg-card p-5 text-center"
              style={{ border: "2px solid var(--color-streak-flame)", boxShadow: "0 0 16px color-mix(in srgb, var(--color-streak-flame) 20%, transparent)" }}
            >
              <div className="font-display" style={{ fontSize: "32px", color: "var(--color-streak-flame)", lineHeight: 1 }}>{cntStreak}</div>
              <div className="mt-2 text-sm tracking-widest text-muted-foreground">DAY STREAK</div>
              <div className="mt-1 text-sm text-muted-foreground">{streakVibe.icon} {streakVibe.label}</div>
            </div>
          </SlideCard>
        </div>

        <SlideCard show={phase >= 6}>
          <div
            className="flex w-full items-center gap-6 bg-card px-8 py-5"
            style={{
              border: `3px solid var(${g.colorVar})`,
              boxShadow: `0 0 32px color-mix(in srgb, var(${g.colorVar}) 40%, transparent)`,
              animation: phase >= 6 ? "gradeFlash 0.6s ease 1" : "none",
            }}
          >
            <div className="font-display shrink-0" style={{ fontSize: "48px", color: `var(${g.colorVar})`, textShadow: `0 0 24px color-mix(in srgb, var(${g.colorVar}) 80%, transparent)`, lineHeight: 1 }}>
              {data.grade}
            </div>
            <div>
              <div className="font-display" style={{ fontSize: "11px", color: `var(${g.colorVar})` }}>{g.label}</div>
              <div className="mt-1 text-sm text-muted-foreground">{g.sub}</div>
              <div className="mt-2 text-sm" style={{ color: "var(--color-dim)" }}>
                {data.done} done · {data.created} created · {velocityPct}% velocity
              </div>
            </div>
          </div>
        </SlideCard>

        <SlideCard show={phase >= 7}>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={onClose}
              className="font-display border-2 border-primary bg-primary px-8 py-3 text-primary-foreground transition-colors hover:bg-transparent hover:text-primary"
              style={{ fontSize: "9px" }}
            >
              ▸ CONTINUE
            </button>
            <div style={{ fontSize: "7px", color: "var(--color-dim)", fontFamily: "var(--font-press-start), monospace", animation: "pixelPulse 1.5s ease-in-out infinite" }}>
              PRESS ENTER · ESC · OR CLICK
            </div>
          </div>
        </SlideCard>
      </div>
    </div>
  );
}
