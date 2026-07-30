"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { TaskFormValues } from "@/lib/schemas/task";
import { buildTaskFromValues, tasksReducer } from "@/lib/tasks-reducer";
import type { Task } from "@/types/task";

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  task: Task | null;
}

interface ActiveTimer {
  taskId: string;
  startedAt: number;
}

interface TasksContextValue {
  tasks: Task[];
  createTask: (values: TaskFormValues) => void;
  updateTask: (id: string, values: TaskFormValues) => void;
  deleteTask: (id: string) => void;
  duplicateTask: (id: string) => void;
  sheet: SheetState;
  openCreateForm: () => void;
  openEditForm: (task: Task) => void;
  closeForm: () => void;
  /** Briefly true right after any task is marked done — Companion's "excited" mood trigger. */
  justCompleted: boolean;
  bonusXp: number;
  bonusCoins: number;
  claimDailyQuest: (xp: number, coins: number) => void;
  /** Focus Timer — only one task can be timed at once; starting another stops the current one. */
  activeTimer: ActiveTimer | null;
  startTimer: (taskId: string) => void;
  stopTimer: () => void;
  /** Settings → Reset All. */
  reset: () => void;
  /** Settings → Import Data — replaces tasks + bonus XP/coins with an imported snapshot. */
  loadTasks: (tasks: Task[], bonusXp: number, bonusCoins: number) => void;
}

const TasksContext = createContext<TasksContextValue | null>(null);

/**
 * Single client-side source of truth for tasks + the shared create/edit sheet.
 * Stands in for real persistence (no `schema.prisma` yet — docs/02-architecture.md §4)
 * so every task-consuming page reads from here instead of the static mock array.
 */
export function TasksProvider({
  initialTasks,
  children,
}: {
  initialTasks: Task[];
  children: React.ReactNode;
}) {
  const initialTasksRef = useRef(initialTasks);
  const [tasks, dispatch] = useReducer(tasksReducer, initialTasks);
  const [sheet, setSheet] = useState<SheetState>({ open: false, mode: "create", task: null });
  const [justCompletedAt, setJustCompletedAt] = useState<number | null>(null);
  const [bonusXp, setBonusXp] = useState(0);
  const [bonusCoins, setBonusCoins] = useState(0);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);

  useEffect(() => {
    if (justCompletedAt == null) return;
    const id = setTimeout(() => setJustCompletedAt(null), 4000);
    return () => clearTimeout(id);
  }, [justCompletedAt]);

  const value = useMemo<TasksContextValue>(
    () => ({
      tasks,
      createTask: (values) => {
        dispatch({ type: "create", id: crypto.randomUUID(), changedAt: new Date().toISOString(), values });
      },
      updateTask: (id, values) => {
        const prev = tasks.find((t) => t.id === id);
        if (prev && prev.status !== "done" && values.status === "done") {
          setJustCompletedAt(Date.now());
        }
        dispatch({ type: "update", id, changedAt: new Date().toISOString(), values });
      },
      deleteTask: (id) => {
        dispatch({ type: "delete", id });
        setSheet((s) => (s.task?.id === id ? { ...s, open: false } : s));
      },
      duplicateTask: (id) => {
        const source = tasks.find((t) => t.id === id);
        if (!source) return;
        // A duplicate is a new quest, not a shared one — relations/attachments/deliverables start empty.
        const values: TaskFormValues = {
          title: `${source.title} (copy)`,
          description: source.description,
          project: source.project,
          status: source.status,
          type: source.type,
          priority: source.priority,
          effort: source.effort,
          storyPoint: source.storyPoint,
          dueDate: source.dueDate,
          sprint: source.sprint,
          waitingOn: source.waitingOn,
          reporter: source.reporter,
          tags: [...source.tags],
          relations: [],
          attachments: [],
          deliverables: [],
        };
        const newId = crypto.randomUUID();
        const changedAt = new Date().toISOString();
        dispatch({ type: "create", id: newId, changedAt, values });
        setSheet({ open: true, mode: "edit", task: buildTaskFromValues(newId, changedAt, values) });
      },
      sheet,
      openCreateForm: () => setSheet({ open: true, mode: "create", task: null }),
      openEditForm: (task) => setSheet({ open: true, mode: "edit", task }),
      closeForm: () => setSheet((s) => ({ ...s, open: false })),
      justCompleted: justCompletedAt != null,
      bonusXp,
      bonusCoins,
      claimDailyQuest: (xp, coins) => {
        setBonusXp((v) => v + xp);
        setBonusCoins((v) => v + coins);
      },
      activeTimer,
      startTimer: (taskId) => {
        setActiveTimer((current) => {
          if (current) {
            dispatch({ type: "addTime", id: current.taskId, seconds: Math.round((Date.now() - current.startedAt) / 1000) });
          }
          return { taskId, startedAt: Date.now() };
        });
      },
      stopTimer: () => {
        setActiveTimer((current) => {
          if (current) {
            dispatch({ type: "addTime", id: current.taskId, seconds: Math.round((Date.now() - current.startedAt) / 1000) });
          }
          return null;
        });
      },
      reset: () => {
        dispatch({ type: "reset", tasks: initialTasksRef.current });
        setSheet({ open: false, mode: "create", task: null });
        setJustCompletedAt(null);
        setBonusXp(0);
        setBonusCoins(0);
        setActiveTimer(null);
      },
      loadTasks: (loaded, loadedBonusXp, loadedBonusCoins) => {
        dispatch({ type: "reset", tasks: loaded });
        setSheet({ open: false, mode: "create", task: null });
        setJustCompletedAt(null);
        setBonusXp(loadedBonusXp);
        setBonusCoins(loadedBonusCoins);
        setActiveTimer(null);
      },
    }),
    [tasks, sheet, justCompletedAt, bonusXp, bonusCoins, activeTimer]
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within a TasksProvider");
  return ctx;
}
