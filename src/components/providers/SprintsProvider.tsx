"use client";

import { createContext, useContext } from "react";

const SprintsContext = createContext<any>({ sprints: [] });

export function SprintsProvider({ children }: { children: React.ReactNode; initialSprints?: any[] }) {
  return <SprintsContext.Provider value={{ sprints: [] }}>{children}</SprintsContext.Provider>;
}

export function useSprints() {
  return useContext(SprintsContext);
}
