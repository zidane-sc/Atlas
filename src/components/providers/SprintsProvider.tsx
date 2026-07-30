"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { SprintFormValues } from "@/lib/schemas/sprint";
import type { Sprint } from "@/types/gamification";

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  sprint: Sprint | null;
}

interface SprintsContextValue {
  sprints: Sprint[];
  createSprint: (values: SprintFormValues) => void;
  updateSprint: (id: string, values: SprintFormValues) => void;
  deleteSprint: (id: string) => void;
  sheet: SheetState;
  openCreateForm: () => void;
  openEditForm: (sprint: Sprint) => void;
  closeForm: () => void;
  reset: () => void;
  /** Settings → Import Data. */
  loadSprints: (sprints: Sprint[]) => void;
}

const SprintsContext = createContext<SprintsContextValue | null>(null);

/** Client-side sprint store, same "no backend yet" rationale as ProjectsProvider/TasksProvider. */
export function SprintsProvider({
  initialSprints,
  children,
}: {
  initialSprints: Sprint[];
  children: React.ReactNode;
}) {
  const initialSprintsRef = useRef(initialSprints);
  const [sprints, setSprints] = useState<Sprint[]>(initialSprints);
  const [sheet, setSheet] = useState<SheetState>({ open: false, mode: "create", sprint: null });

  const value = useMemo<SprintsContextValue>(
    () => ({
      sprints,
      createSprint: (values) => {
        setSprints((prev) => [{ id: crypto.randomUUID(), ...values, goal: values.goal ?? "" }, ...prev]);
        setSheet((s) => ({ ...s, open: false }));
      },
      updateSprint: (id, values) => {
        setSprints((prev) => prev.map((s) => (s.id === id ? { ...s, ...values, goal: values.goal ?? "" } : s)));
        setSheet((s) => ({ ...s, open: false }));
      },
      deleteSprint: (id) => {
        // Tasks keep referencing the deleted sprint by name — same "no FK, not worth a cross-provider
        // cascade" reasoning as ProjectsProvider.deleteProject.
        setSprints((prev) => prev.filter((s) => s.id !== id));
        setSheet((s) => (s.sprint?.id === id ? { ...s, open: false } : s));
      },
      sheet,
      openCreateForm: () => setSheet({ open: true, mode: "create", sprint: null }),
      openEditForm: (sprint) => setSheet({ open: true, mode: "edit", sprint }),
      closeForm: () => setSheet((s) => ({ ...s, open: false })),
      reset: () => {
        setSprints(initialSprintsRef.current);
        setSheet({ open: false, mode: "create", sprint: null });
      },
      loadSprints: (loaded) => {
        setSprints(loaded);
        setSheet({ open: false, mode: "create", sprint: null });
      },
    }),
    [sprints, sheet]
  );

  return <SprintsContext.Provider value={value}>{children}</SprintsContext.Provider>;
}

export function useSprints() {
  const ctx = useContext(SprintsContext);
  if (!ctx) throw new Error("useSprints must be used within a SprintsProvider");
  return ctx;
}
