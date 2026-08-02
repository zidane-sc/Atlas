"use client";

import { createContext, useContext, useMemo, useRef, useState } from "react";
import type { ProjectFormValues } from "@/lib/schemas/project";
import type { Project } from "@/types/gamification";
import { useNotifications } from "@/hooks/useNotifications";
import {
  createProject as apiCreateProject,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
} from "@/lib/actions/projects";
import { mapDbProjectToClient } from "@/lib/tasks-reducer";

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
  const { notify } = useNotifications();

  const value = useMemo<ProjectsContextValue>(
    () => ({
      projects,
      createProject: async (values) => {
        const tempId = crypto.randomUUID();
        const newProject: Project = {
          id: tempId,
          ...values,
          description: values.description ?? "",
        };
        setProjects((prev) => [...prev, newProject]);
        setSheet((s) => ({ ...s, open: false }));

        const result = await apiCreateProject(values);
        if (!result.success) {
          notify(result.error.message, "error");
          setProjects((prev) => prev.filter((p) => p.id !== tempId));
        } else {
          setProjects((prev) =>
            prev.map((p) => (p.id === tempId ? mapDbProjectToClient(result.data) : p))
          );
        }
      },
      updateProject: async (id, values) => {
        const prevProject = projects.find((p) => p.id === id);
        if (!prevProject) return;

        const oldProject = { ...prevProject };

        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...values, description: values.description ?? "" } : p))
        );
        setSheet((s) => ({ ...s, open: false }));

        const result = await apiUpdateProject(id, values);
        if (!result.success) {
          notify(result.error.message, "error");
          setProjects((prev) => prev.map((p) => (p.id === id ? oldProject : p)));
        } else {
          setProjects((prev) =>
            prev.map((p) => (p.id === id ? mapDbProjectToClient(result.data) : p))
          );
        }
      },
      deleteProject: async (id) => {
        const prevProject = projects.find((p) => p.id === id);
        if (!prevProject) return;

        setProjects((prev) => prev.filter((p) => p.id !== id));
        setSheet((s) => (s.project?.id === id ? { ...s, open: false } : s));

        const result = await apiDeleteProject(id);
        if (!result.success) {
          notify(result.error.message, "error");
          setProjects((prev) => [...prev, prevProject]);
        }
      },
      sheet,
      openCreateForm: () => setSheet({ open: true, mode: "create", project: null }),
      openEditForm: (project) => setSheet({ open: true, mode: "edit", project }),
      closeForm: () => setSheet((s) => ({ ...s, open: false })),
      reset: () => {
        setProjects(initialProjectsRef.current);
        setSheet({ open: false, mode: "create", project: null });
      },
    }),
    [projects, sheet, notify]
  );

  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used within a ProjectsProvider");
  return ctx;
}
