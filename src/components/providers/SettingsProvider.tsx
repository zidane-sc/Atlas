"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

interface SettingsContextValue {
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

/** App-level preferences that actually do something — currently just Reduce Motion. */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  const value = useMemo<SettingsContextValue>(() => ({ reduceMotion, setReduceMotion }), [reduceMotion]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
