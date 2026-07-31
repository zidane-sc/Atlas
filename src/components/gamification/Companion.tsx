"use client";

import { useState } from "react";
import { getCompanionMood, type CompanionMood } from "@/lib/gamification";

/** Ambient sidebar companion, pixel-exact port of reference-design's CompanionWidget — docs/03-design.md §11.9 */
const MOOD_MESSAGES: Record<CompanionMood, string[]> = {
  excited: ["QUEST COMPLETE!! ⚡", "We did it!! 🎉", "YES YES YES!! ✨", "More XP!!! 🏆"],
  happy: ["Streak is strong! 🔥", "You're on fire!", "Let's keep going!", "I believe in you ✨"],
  idle: ["Ready when you are...", "Waiting patiently...", "Take your time~", "Here if you need me"],
  sad: ["Please do some quests 🥺", "I miss our streak...", "Come back soon...", "Don't give up... 😢"],
};

const MOOD_COLOR_VAR: Record<CompanionMood, string> = {
  excited: "--color-xp-gold",
  happy: "--color-status-ready",
  idle: "--color-primary-gold",
  sad: "--color-status-waiting-external",
};

const MOOD_ANIMATION: Record<CompanionMood, string> = {
  excited: "cmpBounceFast 0.35s ease-in-out infinite",
  happy: "cmpBounce 0.8s ease-in-out infinite",
  idle: "cmpBreathe 2.8s ease-in-out infinite",
  sad: "cmpSad 3.5s ease-in-out infinite",
};

const MOOD_ICON: Record<CompanionMood, string> = { excited: "🏆", happy: "🔥", idle: "💤", sad: "😢" };

const W = 40;
const H = 34;

function px(style: React.CSSProperties): React.CSSProperties {
  return { position: "absolute", ...style };
}

function Mouth({ mood }: { mood: CompanionMood }) {
  if (mood === "happy" || mood === "excited") {
    return (
      <div
        style={px({
          bottom: 7,
          left: "50%",
          transform: "translateX(-50%)",
          width: 16,
          height: 8,
          borderLeft: "3px solid var(--color-bg-deep)",
          borderRight: "3px solid var(--color-bg-deep)",
          borderBottom: "3px solid var(--color-bg-deep)",
          borderBottomLeftRadius: 8,
          borderBottomRightRadius: 8,
        })}
      />
    );
  }
  if (mood === "idle") {
    return (
      <div
        style={px({
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          width: 12,
          height: 3,
          backgroundColor: "var(--color-bg-deep)",
        })}
      />
    );
  }
  return (
    <div
      style={px({
        bottom: 9,
        left: "50%",
        transform: "translateX(-50%)",
        width: 14,
        height: 7,
        borderLeft: "3px solid var(--color-bg-deep)",
        borderRight: "3px solid var(--color-bg-deep)",
        borderTop: "3px solid var(--color-bg-deep)",
        borderTopLeftRadius: 8,
        borderTopRightRadius: 8,
      })}
    />
  );
}

export function Companion({
  level,
  todayCompleted,
  justCompleted = false,
  compact = false,
}: {
  level: number;
  todayCompleted: number;
  justCompleted?: boolean;
  compact?: boolean;
}) {
  const [tip, setTip] = useState(false);
  const [msgIdx] = useState(() => Math.floor(Math.random() * 4));
  const mood = getCompanionMood(todayCompleted, justCompleted);
  const compLv = Math.max(1, Math.round(level * 0.65));
  const colorVar = MOOD_COLOR_VAR[mood];

  return (
    <div
      className="relative px-3 pt-2.5 pb-1.5"
      style={{ borderTop: "1px solid var(--color-border)" }}
      onMouseEnter={() => setTip(true)}
      onMouseLeave={() => setTip(false)}
    >
      {tip && (
        <div
          className="absolute right-2 left-2 z-50 px-2.5 py-2"
          style={{
            bottom: "calc(100% + 4px)",
            backgroundColor: "var(--color-bg-panel)",
            border: `2px solid var(${colorVar})`,
            boxShadow: `0 0 12px color-mix(in srgb, var(${colorVar}) 30%, transparent)`,
          }}
        >
          <div className="mb-1 font-display text-[7px]" style={{ color: `var(${colorVar})` }}>
            PIP · LV.{compLv}
          </div>
          <div className="text-xs" style={{ color: "var(--color-text-muted)", lineHeight: 1.4 }}>
            {MOOD_MESSAGES[mood][msgIdx]}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--color-dim)" }}>
            {MOOD_ICON[mood]} {mood.toUpperCase()} · {todayCompleted} done today
          </div>
        </div>
      )}

      <div className="flex cursor-default flex-col items-center gap-0">
        <div style={{ animation: MOOD_ANIMATION[mood], transformOrigin: "bottom center", display: "inline-block" }}>
          {/* body */}
          <div
            style={{
              position: "relative",
              width: W,
              height: H,
              backgroundColor: `var(${colorVar})`,
              border: "2px solid rgba(0,0,0,0.35)",
              imageRendering: "pixelated",
            }}
          >
            <div style={px({ top: 3, left: 3, width: 6, height: 6, backgroundColor: "rgba(255,255,255,0.28)" })} />

            <div style={px({ top: 9, left: 7, width: 9, height: 9, backgroundColor: "#fff" })}>
              <div
                style={{
                  position: "absolute",
                  bottom: mood === "sad" ? 0 : "auto",
                  top: mood === "sad" ? "auto" : 0,
                  right: 0,
                  width: 4,
                  height: 4,
                  backgroundColor: "var(--color-bg-deep)",
                }}
              />
            </div>
            <div style={px({ top: 9, right: 7, width: 9, height: 9, backgroundColor: "#fff" })}>
              <div
                style={{
                  position: "absolute",
                  bottom: mood === "sad" ? 0 : "auto",
                  top: mood === "sad" ? "auto" : 0,
                  left: 0,
                  width: 4,
                  height: 4,
                  backgroundColor: "var(--color-bg-deep)",
                }}
              />
            </div>

            {mood === "excited" && (
              <>
                <div
                  style={px({
                    top: 10,
                    left: 9,
                    width: 5,
                    height: 5,
                    backgroundColor: "var(--color-xp-gold)",
                    clipPath: "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)",
                  })}
                />
                <div
                  style={px({
                    top: 10,
                    right: 9,
                    width: 5,
                    height: 5,
                    backgroundColor: "var(--color-xp-gold)",
                    clipPath: "polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)",
                  })}
                />
              </>
            )}

            {(mood === "happy" || mood === "excited") && (
              <>
                <div style={px({ bottom: 8, left: 3, width: 6, height: 4, backgroundColor: "rgba(255,120,120,0.45)" })} />
                <div style={px({ bottom: 8, right: 3, width: 6, height: 4, backgroundColor: "rgba(255,120,120,0.45)" })} />
              </>
            )}

            <Mouth mood={mood} />
          </div>

        </div>

        {!compact && (
          <>
            {/* feet */}
            <div className="mt-0 flex justify-around">
              <div style={{ width: 12, height: 6, backgroundColor: `var(${colorVar})`, border: "2px solid rgba(0,0,0,0.3)", borderTop: "none" }} />
              <div style={{ width: 12, height: 6, backgroundColor: `var(${colorVar})`, border: "2px solid rgba(0,0,0,0.3)", borderTop: "none" }} />
            </div>

            <div className="mt-1.5 text-center">
              <div className="font-display text-[7px]" style={{ color: `var(${colorVar})` }}>PIP</div>
              <div className="text-xs" style={{ color: "var(--color-dim)" }}>companion lv.{compLv}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
