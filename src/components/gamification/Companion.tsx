"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { getCompanionMood, type CompanionMood } from "@/lib/gamification";
import { TYPE_ICON } from "@/lib/mock-data";
import { PriorityMark } from "@/components/tasks/PriorityMark";
import type { Task } from "@/types/task";
import type { NotePreview } from "@/types/note";

/** Ambient sidebar companion with pinned task hub */
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
  pinnedTasks = [],
  pinnedNotes = [],
  onOpenTask,
  onOpenNote,
  onUnpinTask,
  onUnpinNote,
}: {
  level: number;
  todayCompleted: number;
  justCompleted?: boolean;
  pinnedTasks?: Task[];
  pinnedNotes?: NotePreview[];
  onOpenTask?: (task: Task) => void;
  onOpenNote?: (noteId: string) => void;
  onUnpinTask?: (taskId: string) => void;
  onUnpinNote?: (noteId: string) => void;
}) {
  const [showPinned, setShowPinned] = useState(false);
  const [showMood, setShowMood] = useState(false);
  const [activeTab, setActiveTab] = useState<"tasks" | "notes">("tasks");
  const [msgIdx] = useState(() => Math.floor(Math.random() * 4));
  const mood = getCompanionMood(todayCompleted, justCompleted);
  const compLv = Math.max(1, Math.round(level * 0.65));
  const colorVar = MOOD_COLOR_VAR[mood];
  const hasPinned = (pinnedTasks && pinnedTasks.length > 0) || (pinnedNotes && pinnedNotes.length > 0);

  return (
    <div
      className="relative px-3 pt-2.5 pb-1.5 z-40"
      style={{ borderTop: "1px solid var(--color-border)", overflow: "visible" }}
      onMouseEnter={() => !showPinned && setShowMood(true)}
      onMouseLeave={() => setShowMood(false)}
    >
      {/* Mood Tooltip with optional Pin Status */}
      {showMood && !showPinned && (
        <div
          className="absolute right-2 left-2 z-50 px-2.5 py-2 cursor-pointer hover:border-primary-gold transition-colors"
          style={{
            bottom: "calc(100% + 4px)",
            backgroundColor: "var(--color-bg-panel)",
            border: `2px solid var(${colorVar})`,
            boxShadow: `0 0 12px color-mix(in srgb, var(${colorVar}) 30%, transparent)`,
          }}
          onClick={() => hasPinned && setShowPinned(true)}
        >
          <div className="mb-1 font-display text-[7px]" style={{ color: `var(${colorVar})` }}>
            PIP · LV.{compLv}
          </div>
          <div className="text-xs" style={{ color: "var(--color-text-muted)", lineHeight: 1.4 }}>
            {MOOD_MESSAGES[mood][msgIdx]}
          </div>
          <div className="text-xs" style={{ color: "var(--color-dim)" }}>
            {MOOD_ICON[mood]} {mood.toUpperCase()} · {todayCompleted} done today
          </div>
          {hasPinned && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs" style={{ color: "var(--color-primary-gold)" }}>
                📌 {pinnedTasks.length + pinnedNotes.length} items pinned!
              </div>
              <div className="text-xs text-muted-foreground">Click to open 👆</div>
            </div>
          )}
        </div>
      )}

      {/* Pinned Hub Modal - Fixed on main page */}
      {showPinned && (pinnedTasks.length > 0 || pinnedNotes.length > 0) && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowPinned(false)}
          />
          <div
            className="fixed z-50 border-2 bg-card overflow-hidden flex flex-col"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "420px",
              maxHeight: "600px",
              borderColor: "var(--color-primary-gold)",
              boxShadow: "0 0 32px color-mix(in srgb, var(--color-primary-gold) 35%, transparent), 0 0 64px rgba(0,0,0,0.5)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          >
          {/* Header with Tabs */}
          <div
            className="px-3 py-2 border-b-2 border-border flex items-center justify-between"
            style={{ backgroundColor: "var(--color-bg-panel-alt)" }}
          >
            <span className="font-display text-xs tracking-widest" style={{ color: "var(--color-primary-gold)" }}>
              📌 PINBOARD
            </span>
            <button onClick={() => setShowPinned(false)} className="p-0.5 hover:text-destructive transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* Tab Buttons */}
          {pinnedTasks.length > 0 && pinnedNotes.length > 0 && (
            <div className="flex border-b border-border">
              <button
                onClick={() => setActiveTab("tasks")}
                className="flex-1 px-3 py-1.5 text-xs font-bold transition-colors"
                style={{
                  backgroundColor: activeTab === "tasks" ? "var(--color-bg-panel)" : "transparent",
                  color: activeTab === "tasks" ? "var(--color-primary-gold)" : "var(--color-text-muted)",
                  borderBottom: activeTab === "tasks" ? "2px solid var(--color-primary-gold)" : "none",
                }}
              >
                ⚡ TASKS ({pinnedTasks.length})
              </button>
              <button
                onClick={() => setActiveTab("notes")}
                className="flex-1 px-3 py-1.5 text-xs font-bold transition-colors"
                style={{
                  backgroundColor: activeTab === "notes" ? "var(--color-bg-panel)" : "transparent",
                  color: activeTab === "notes" ? "var(--color-primary-gold)" : "var(--color-text-muted)",
                  borderBottom: activeTab === "notes" ? "2px solid var(--color-primary-gold)" : "none",
                }}
              >
                📚 NOTES ({pinnedNotes.length})
              </button>
            </div>
          )}

          {/* Content */}
          <div className="overflow-y-auto flex-1 divide-y divide-border">
            {/* Tasks Tab */}
            {activeTab === "tasks" && pinnedTasks.length > 0 && (
              <>
                {pinnedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-2.5 hover:bg-primary/10 transition-colors flex gap-2 group cursor-pointer"
                    onClick={() => {
                      onOpenTask?.(task);
                      setShowPinned(false);
                    }}
                  >
                    <span className="text-base shrink-0">{TYPE_ICON[task.type]}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-1">
                        {task.title}
                      </h3>
                      <div className="flex items-center gap-1 flex-wrap">
                        <PriorityMark priority={task.priority} />
                        <span className="text-xs px-1.5 py-0.5 border border-border whitespace-nowrap text-xs font-bold" style={{ backgroundColor: "var(--color-bg-panel-alt)" }}>
                          {task.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                        {task.dueDate && <span className="text-xs text-muted-foreground">📅 {task.dueDate.slice(5)}</span>}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnpinTask?.(task.id);
                      }}
                      className="p-0.5 hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* Notes Tab */}
            {activeTab === "notes" && pinnedNotes.length > 0 && (
              <>
                {pinnedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-2.5 hover:bg-primary/10 transition-colors flex gap-2 group cursor-pointer"
                    onClick={() => {
                      onOpenNote?.(note.id);
                      setShowPinned(false);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors mb-1">
                        {note.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">{note.preview}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnpinNote?.(note.id);
                      }}
                      className="p-0.5 hover:text-destructive transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>

          <style>{`
            @keyframes pulse {
              0%, 100% { box-shadow: 0 0 24px color-mix(in srgb, var(--color-primary-gold) 25%, transparent), 8px 8px 0 var(--color-primary-gold-dim); }
              50% { box-shadow: 0 0 32px color-mix(in srgb, var(--color-primary-gold) 35%, transparent), 8px 8px 0 var(--color-primary-gold-dim); }
            }
          `}</style>
        </div>
        </>
      )}

      <div className="flex cursor-default flex-col items-center gap-0">
        <div style={{ animation: MOOD_ANIMATION[mood], transformOrigin: "bottom center", display: "inline-block" }}>
          {/* body */}
          <div
            onClick={() => hasPinned && setShowPinned(!showPinned)}
            style={{
              position: "relative",
              width: W,
              height: H,
              backgroundColor: `var(${colorVar})`,
              border: "2px solid rgba(0,0,0,0.35)",
              imageRendering: "pixelated",
              cursor: hasPinned ? "pointer" : "default",
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

            {/* Pinned indicator badge */}
            {hasPinned && (
              <div
                style={px({
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  backgroundColor: "var(--color-primary-gold)",
                  border: "2px solid var(--color-primary-gold-dim)",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  lineHeight: "1",
                })}
              >
                📌
              </div>
            )}
          </div>

          {/* feet */}
          <div className="mt-0 flex justify-around">
            <div style={{ width: 12, height: 6, backgroundColor: `var(${colorVar})`, border: "2px solid rgba(0,0,0,0.3)", borderTop: "none" }} />
            <div style={{ width: 12, height: 6, backgroundColor: `var(${colorVar})`, border: "2px solid rgba(0,0,0,0.3)", borderTop: "none" }} />
          </div>
        </div>

        <div className="mt-1.5 text-center">
          <div className="font-display text-[7px]" style={{ color: `var(${colorVar})` }}>PIP</div>
          <div className="text-xs" style={{ color: "var(--color-dim)" }}>companion lv.{compLv}</div>
        </div>
      </div>
    </div>
  );
}
