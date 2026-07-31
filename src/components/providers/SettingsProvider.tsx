"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import type { UserSetting } from "@/types/settings";

interface SettingsContextValue {
  settings: UserSetting[];
  updateSetting: (key: string, value: unknown) => Promise<boolean>;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
  soundEnabled: boolean;
  focusMinutes: number;
  breakMinutes: number;
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
  const [settings, setSettings] = useState<UserSetting[]>(initialSettings);

  const getSettingValue = useCallback(
    (key: string) => settings.find((s) => s.key === key)?.value,
    [settings]
  );

  const reduceMotion = !!getSettingValue("reduceMotion");
  const soundEnabled = getSettingValue("soundEnabled") !== false;
  const focusMinutes = Number(getSettingValue("focusMinutes")) || 25;
  const breakMinutes = Number(getSettingValue("breakMinutes")) || 5;

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  const updateSetting = useCallback(async (key: string, value: unknown) => {
    // Optimistic update
    setSettings((prev) =>
      prev.map((s) => (s.key === key ? { ...s, value } : s))
    );

    const { updateUserSettingAction } = await import("@/lib/actions/user");
    const res = await updateUserSettingAction(key, value);
    if (res.success) {
      setSettings(res.data);
      return true;
    }
    return false;
  }, []);

  const setReduceMotion = useCallback((value: boolean) => {
    void updateSetting("reduceMotion", value);
  }, [updateSetting]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      updateSetting,
      reduceMotion,
      setReduceMotion,
      soundEnabled,
      focusMinutes,
      breakMinutes,
    }),
    [settings, updateSetting, reduceMotion, setReduceMotion, soundEnabled, focusMinutes, breakMinutes]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
