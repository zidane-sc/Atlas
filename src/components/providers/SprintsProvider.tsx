"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { SprintFormValues } from "@/lib/schemas/sprint";
import type { Sprint } from "@/types/gamification";
import { useToast } from "@/components/providers/ToastProvider";
import {
  createSprint as apiCreateSprint,
  updateSprint as apiUpdateSprint,
  deleteSprint as apiDeleteSprint,
} from "@/lib/actions/sprints";
import { mapDbSprintToClient } from "@/lib/tasks-reducer";

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
  const { toast } = useToast();

  const value = useMemo<SprintsContextValue>(
    () => ({
      sprints,
      createSprint: async (values) => {
        const tempId = crypto.randomUUID();
        const newSprint: Sprint = {
          id: tempId,
          ...values,
          goal: values.goal ?? "",
        };
        setSprints((prev) => [newSprint, ...prev]);
        setSheet((s) => ({ ...s, open: false }));

        const result = await apiCreateSprint(values);
        if (!result.success) {
          toast(result.error.message, "error");
          setSprints((prev) => prev.filter((s) => s.id !== tempId));
        } else {
          setSprints((prev) =>
            prev.map((s) => (s.id === tempId ? mapDbSprintToClient(result.data) : s))
          );
        }
      },
      updateSprint: async (id, values) => {
        const prevSprint = sprints.find((s) => s.id === id);
        if (!prevSprint) return;

        const oldSprint = { ...prevSprint };

        setSprints((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...values, goal: values.goal ?? "" } : s))
        );
        setSheet((s) => ({ ...s, open: false }));

        const result = await apiUpdateSprint(id, values);
        if (!result.success) {
          toast(result.error.message, "error");
          setSprints((prev) => prev.map((s) => (s.id === id ? oldSprint : s)));
        } else {
          setSprints((prev) =>
            prev.map((s) => (s.id === id ? mapDbSprintToClient(result.data) : s))
          );
        }
      },
      deleteSprint: async (id) => {
        const prevSprint = sprints.find((s) => s.id === id);
        if (!prevSprint) return;

        setSprints((prev) => prev.filter((s) => s.id !== id));
        setSheet((s) => (s.sprint?.id === id ? { ...s, open: false } : s));

        const result = await apiDeleteSprint(id);
        if (!result.success) {
          toast(result.error.message, "error");
          setSprints((prev) => [...prev, prevSprint]);
        }
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
    [sprints, sheet, toast]
  );

  return <SprintsContext.Provider value={value}>{children}</SprintsContext.Provider>;
}

export function useSprints() {
  const ctx = useContext(SprintsContext);
  if (!ctx) throw new Error("useSprints must be used within a SprintsProvider");
  return ctx;
}
