"use client";

import { useMemo } from "react";
import { Plus, Volume2, VolumeX } from "lucide-react";
import { useTasks } from "@/components/providers/TasksProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { calculateStreak } from "@/lib/gamification";
import { playRetroBlip } from "@/lib/audio";

export function MobileTopBar() {
  const { characterSheet, allTimeTasks, openCreateForm } = useTasks();
  const { soundEnabled, updateSetting } = useSettings();
  const streakDays = useMemo(() => calculateStreak(allTimeTasks), [allTimeTasks]);

  const toggleSound = () => {
    const next = !soundEnabled;
    void updateSetting("soundEnabled", next);
    if (next) {
      setTimeout(() => playRetroBlip(), 50);
    }
  };

  return (
    <header
      className="flex h-12 items-center justify-between px-3.5 lg:hidden shrink-0 select-none"
      style={{ borderBottom: "2px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
    >
      {/* Left: Brand Identity */}
      <div className="flex items-center gap-2">
        <span style={{ fontFamily: "var(--font-press-start), monospace", fontSize: "13px", color: "var(--color-primary-gold)" }}>
          ⚔ ATLAS
        </span>
      </div>

      {/* Right: Quick Telemetry + Audio Toggle + New Quest Button */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <span
            className="border px-1.5 py-0.5 font-bold text-xs"
            style={{ borderColor: "var(--color-primary-gold)", color: "var(--color-primary-gold)" }}
            title={`Level ${characterSheet.globalLevel}`}
          >
            L{characterSheet.globalLevel}
          </span>
          <span className="text-xs font-bold" style={{ color: "var(--color-streak-flame)" }} title={`${streakDays}d Streak`}>
            🔥{streakDays}
          </span>
          <span className="text-xs font-bold" style={{ color: "var(--color-coin)" }} title={`${characterSheet.totalCoins} Coins`}>
            🪙{characterSheet.totalCoins}
          </span>
        </div>

        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundEnabled ? "Mute sound effects" : "Enable sound effects"}
          className="flex items-center justify-center h-7 w-7 border border-border bg-secondary text-muted-foreground hover:text-foreground cursor-pointer"
          title={soundEnabled ? "Sound ON (Tap to mute)" : "Sound OFF (Tap to unmute)"}
        >
          {soundEnabled ? <Volume2 size={13} className="text-primary" /> : <VolumeX size={13} />}
        </button>

        <button
          type="button"
          onClick={openCreateForm}
          aria-label="Create new quest"
          className="pixel-button flex items-center justify-center h-7 w-7 border-2 border-primary bg-primary text-black cursor-pointer font-bold"
        >
          <Plus size={14} />
        </button>
      </div>
    </header>
  );
}
