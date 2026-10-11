"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import type { UserSetting } from "@/types/settings";
import { updateUserSettingAction } from "@/lib/actions/user";

const DEFAULT_SETTINGS: Record<string, unknown> = {
  notifications: true,
  soundEnabled: true,
  reduceMotion: false,
  compactView: false,
  focusMinutes: 25,
  breakMinutes: 5,
  defaultView: "dashboard",
};

function initializeSettings(initial: UserSetting[]): UserSetting[] {
  const map = new Map<string, unknown>(Object.entries(DEFAULT_SETTINGS));
  if (Array.isArray(initial)) {
    for (const s of initial) {
      if (s && s.key) {
        map.set(s.key, s.value);
      }
    }
  }
  return Array.from(map.entries()).map(([key, value]) => ({ key, value } as UserSetting));
}

interface SettingsContextValue {
  settings: UserSetting[];
  updateSetting: (key: string, value: unknown) => Promise<boolean>;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  soundEnabled: boolean;
  focusMinutes: number;
  breakMinutes: number;
  notificationsEnabled: boolean;
  compactView: boolean;
  defaultView: string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** App-level dynamic preferences with DB persistence. */
export function SettingsProvider({
  initialSettings = [],
  children,
}: {
  initialSettings: UserSetting[];
  children: React.ReactNode;
}) {
  const [settings, setSettings] = useState<UserSetting[]>(() => initializeSettings(initialSettings));

  const getSettingValue = useCallback(
    (key: string) => {
      const match = settings.find((s) => s.key === key);
      return match !== undefined ? match.value : DEFAULT_SETTINGS[key];
    },
    [settings]
  );

  const reduceMotion = !!getSettingValue("reduceMotion");
  const soundEnabled = getSettingValue("soundEnabled") !== false;
  const focusMinutes = Number(getSettingValue("focusMinutes")) || 25;
  const breakMinutes = Number(getSettingValue("breakMinutes")) || 5;
  const notificationsEnabled = getSettingValue("notifications") !== false;
  const compactView = !!getSettingValue("compactView");
  const defaultView = (getSettingValue("defaultView") as string) || "dashboard";

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  useEffect(() => {
    document.documentElement.classList.toggle("compact-view", compactView);
  }, [compactView]);

  const updateSetting = useCallback(async (key: string, value: unknown) => {
    // 1. Optimistic update
    setSettings((prev) => {
      const exists = prev.some((s) => s.key === key);
      if (exists) {
        return prev.map((s) => (s.key === key ? { ...s, value } : s));
      }
      return [...prev, { key, value } as UserSetting];
    });

    try {
      const res = await updateUserSettingAction(key, value);
      if (res.success && Array.isArray(res.data)) {
        // Merge with existing state so default keys are never dropped
        setSettings((prev) => {
          const map = new Map(prev.map((s) => [s.key, s.value]));
          for (const s of res.data) {
            map.set(s.key, s.value);
          }
          return Array.from(map.entries()).map(([k, v]) => ({ key: k, value: v } as UserSetting));
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to update user setting:", err);
      return false;
    }
  }, []);

  const setReduceMotion = useCallback(
    (value: boolean) => {
      void updateSetting("reduceMotion", value);
    },
    [updateSetting]
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSetting,
      reduceMotion,
      setReduceMotion,
      soundEnabled,
      focusMinutes,
      breakMinutes,
      notificationsEnabled,
      compactView,
      defaultView,
    }),
    [
      settings,
      updateSetting,
      reduceMotion,
      setReduceMotion,
      soundEnabled,
      focusMinutes,
      breakMinutes,
      notificationsEnabled,
      compactView,
      defaultView,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
