"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { ProjectFormValues } from "@/lib/schemas/project";
import type { Project } from "@/types/gamification";

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  project: Project | null;
}

interface ProjectsContextValue {
  projects: Project[];
  createProject: (values: ProjectFormValues) => void;
  updateProject: (id: string, values: ProjectFormValues) => void;
  deleteProject: (id: string) => void;
  sheet: SheetState;
  openCreateForm: () => void;
  openEditForm: (project: Project) => void;
  closeForm: () => void;
  reset: () => void;
  /** Settings → Import Data. */
  loadProjects: (projects: Project[]) => void;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

/** Client-side project store, same "no backend yet" rationale as TasksProvider. */
export function ProjectsProvider({
  initialProjects,
  children,
}: {
  initialProjects: Project[];
  children: React.ReactNode;
}) {
  const initialProjectsRef = useRef(initialProjects);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [sheet, setSheet] = useState<SheetState>({ open: false, mode: "create", project: null });

  const value = useMemo<ProjectsContextValue>(
    () => ({
      projects,
      createProject: (values) => {
        setProjects((prev) => [...prev, { id: crypto.randomUUID(), ...values, description: values.description ?? "" }]);
        setSheet((s) => ({ ...s, open: false }));
      },
      updateProject: (id, values) => {
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...values, description: values.description ?? "" } : p)));
        setSheet((s) => ({ ...s, open: false }));
      },
      deleteProject: (id) => {
        // Tasks keep referencing the deleted project by name — client-side mock data has no FK
        // constraints, tasks already render arbitrary project strings safely, and reaching into
        // TasksProvider from here for a cascade isn't worth the cross-provider complexity.
        setProjects((prev) => prev.filter((p) => p.id !== id));
        setSheet((s) => (s.project?.id === id ? { ...s, open: false } : s));
      },
      sheet,
      openCreateForm: () => setSheet({ open: true, mode: "create", project: null }),
      openEditForm: (project) => setSheet({ open: true, mode: "edit", project }),
      closeForm: () => setSheet((s) => ({ ...s, open: false })),
      reset: () => {
        setProjects(initialProjectsRef.current);
        setSheet({ open: false, mode: "create", project: null });
      },
      loadProjects: (loaded) => {
        setProjects(loaded);
        setSheet({ open: false, mode: "create", project: null });
      },
    }),
    [projects, sheet]
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within a ProjectsProvider");
  return ctx;
}
