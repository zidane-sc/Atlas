"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { TaskFormValues } from "@/lib/schemas/task";
import { buildTaskFromValues, tasksReducer } from "@/lib/tasks-reducer";
import type { Task, ActivityLogClient } from "@/types/task";
import { createComment as apiCreateComment } from "@/lib/actions/comments";
import { updateUserStats as apiUpdateUserStats } from "@/lib/actions/user";
import { useToast } from "@/components/providers/ToastProvider";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { useSprints } from "@/components/providers/SprintsProvider";
import {
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  logWorkSession as apiLogWorkSession,
} from "@/lib/actions/tasks";
import { calcTaskXP } from "@/lib/gamification";

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  task: Task | null;
}

interface ActiveTimer {
  taskId: string;
  startedAt: number;
}

interface CompletionOverlay {
  id: string;
  xp: number;
  title: string;
}

export function playChime() {
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const now = ctx.currentTime;

  // Triad notes: E5, G5, C6 (classic happy level-up sound!)
  const notes = [659.25, 783.99, 1046.50];
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);
    
    gain.gain.setValueAtTime(0, now + idx * 0.08);
    gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.3);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.35);
  });
}

interface TasksContextValue {
  tasks: Task[];
  activityLogs: ActivityLogClient[];
  createTask: (values: TaskFormValues) => void;
  updateTask: (id: string, values: TaskFormValues) => void;
  deleteTask: (id: string) => void;
  duplicateTask: (id: string) => void;
  addComment: (taskId: string, content: string) => Promise<void>;
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
  initialActivityLogs,
  initialBonusXp,
  initialBonusCoins,
  children,
}: {
  initialTasks: Task[];
  initialActivityLogs: ActivityLogClient[];
  initialBonusXp: number;
  initialBonusCoins: number;
  children: React.ReactNode;
}) {
  const initialTasksRef = useRef(initialTasks);
  const [tasks, dispatch] = useReducer(tasksReducer, initialTasks);
  const [activityLogs, setActivityLogs] = useState<ActivityLogClient[]>(initialActivityLogs);
  const [sheet, setSheet] = useState<SheetState>({ open: false, mode: "create", task: null });
  const [justCompletedAt, setJustCompletedAt] = useState<number | null>(null);
  const [bonusXp, setBonusXp] = useState(initialBonusXp);
  const [bonusCoins, setBonusCoins] = useState(initialBonusCoins);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [completions, setCompletions] = useState<CompletionOverlay[]>([]);
  const { toast } = useToast();
  const { projects } = useProjects();
  const { sprints } = useSprints();

  useEffect(() => {
    if (justCompletedAt == null) return;
    const id = setTimeout(() => setJustCompletedAt(null), 4000);
    return () => clearTimeout(id);
  }, [justCompletedAt]);

  const value = useMemo<TasksContextValue>(
    () => ({
      tasks,
      createTask: async (values) => {
        const tempId = crypto.randomUUID();
        const changedAt = new Date().toISOString();
        
        // Optimistic insert
        dispatch({ type: "create", id: tempId, changedAt, values });

        const input = {
          title: values.title,
          description: values.description || null,
          projectId: projects.find((p) => p.name === values.project)?.id || null,
          sprintId: values.sprint ? (sprints.find((s) => s.name === values.sprint)?.id || null) : null,
          status: values.status,
          type: values.type,
          priority: values.priority,
          effort: values.effort || null,
          storyPoint: values.storyPoint || null,
          reporter: values.reporter || "self",
          dueDate: values.dueDate || null,
          tags: values.tags,
          relations: values.relations,
          attachments: values.attachments,
          deliverables: values.deliverables,
        };

        const result = await apiCreateTask(input);
        if (!result.success) {
          toast(result.error.message, "error");
          dispatch({ type: "delete", id: tempId });
        } else {
          dispatch({ type: "replaceId", tempId, realId: result.data.id });
        }
      },
      updateTask: async (id, values) => {
        const prev = tasks.find((t) => t.id === id);
        if (!prev) return;

        const oldTask = { ...prev };

        if (prev.status !== "done" && values.status === "done") {
          setJustCompletedAt(Date.now());
          const onTime = !prev.dueDate || new Date() <= new Date(`${prev.dueDate}T23:59:59`);
          const xp = calcTaskXP(values.priority, values.storyPoint, onTime);
          const cid = crypto.randomUUID();
          setCompletions((c) => [...c, { id: cid, xp, title: values.title }]);
          playChime();
          setTimeout(() => {
            setCompletions((c) => c.filter((x) => x.id !== cid));
          }, 1500);
        }

        // Optimistic update
        dispatch({ type: "update", id, changedAt: new Date().toISOString(), values });

        const input = {
          title: values.title,
          description: values.description || null,
          projectId: projects.find((p) => p.name === values.project)?.id || null,
          sprintId: values.sprint ? (sprints.find((s) => s.name === values.sprint)?.id || null) : null,
          status: values.status,
          type: values.type,
          priority: values.priority,
          effort: values.effort || null,
          storyPoint: values.storyPoint || null,
          reporter: values.reporter || "self",
          dueDate: values.dueDate || null,
          tags: values.tags,
          relations: values.relations,
          attachments: values.attachments,
          deliverables: values.deliverables,
        };

        const result = await apiUpdateTask(id, input);
        if (!result.success) {
          toast(result.error.message, "error");
          // Rollback
          const oldValues: TaskFormValues = {
            title: oldTask.title,
            description: oldTask.description ?? undefined,
            project: oldTask.project,
            status: oldTask.status,
            type: oldTask.type,
            priority: oldTask.priority,
            effort: oldTask.effort,
            storyPoint: oldTask.storyPoint ?? undefined,
            dueDate: oldTask.dueDate ?? undefined,
            sprint: oldTask.sprint,
            waitingOn: oldTask.waitingOn,
            reporter: oldTask.reporter,
            tags: oldTask.tags,
            relations: oldTask.relations,
            attachments: oldTask.attachments,
            deliverables: oldTask.deliverables,
          };
          dispatch({ type: "update", id, changedAt: new Date().toISOString(), values: oldValues });
        }
      },
      deleteTask: async (id) => {
        const prev = tasks.find((t) => t.id === id);
        if (!prev) return;

        // Optimistic delete
        dispatch({ type: "delete", id });
        setSheet((s) => (s.task?.id === id ? { ...s, open: false } : s));

        const result = await apiDeleteTask(id);
        if (!result.success) {
          toast(result.error.message, "error");
          // Rollback
          dispatch({ type: "restore", task: prev });
        }
      },
      duplicateTask: async (id) => {
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
        const tempId = crypto.randomUUID();
        const changedAt = new Date().toISOString();
        
        // Optimistic insert & edit view open
        dispatch({ type: "create", id: tempId, changedAt, values });
        setSheet({ open: true, mode: "edit", task: buildTaskFromValues(tempId, changedAt, values) });

        const input = {
          title: values.title,
          description: values.description || null,
          projectId: projects.find((p) => p.name === values.project)?.id || null,
          sprintId: values.sprint ? (sprints.find((s) => s.name === values.sprint)?.id || null) : null,
          status: values.status,
          type: values.type,
          priority: values.priority,
          effort: values.effort || null,
          storyPoint: values.storyPoint || null,
          reporter: values.reporter || "self",
          dueDate: values.dueDate || null,
        };

        const result = await apiCreateTask(input);
        if (!result.success) {
          toast(result.error.message, "error");
          dispatch({ type: "delete", id: tempId });
          setSheet((s) => (s.task?.id === tempId ? { ...s, open: false } : s));
        } else {
          dispatch({ type: "replaceId", tempId, realId: result.data.id });
          setSheet((s) =>
            s.task?.id === tempId
              ? { ...s, task: { ...s.task, id: result.data.id } }
              : s
          );
        }
      },
      sheet,
      openCreateForm: () => setSheet({ open: true, mode: "create", task: null }),
      openEditForm: (task) => setSheet({ open: true, mode: "edit", task }),
      closeForm: () => setSheet((s) => ({ ...s, open: false })),
      justCompleted: justCompletedAt != null,
      bonusXp,
      bonusCoins,
      claimDailyQuest: async (xp, coins) => {
        const nextXp = bonusXp + xp;
        const nextCoins = bonusCoins + coins;
        setBonusXp(nextXp);
        setBonusCoins(nextCoins);
        await apiUpdateUserStats({ bonusXp: nextXp, bonusCoins: nextCoins });
      },
      activeTimer,
      activityLogs,
      addComment: async (taskId, content) => {
        const result = await apiCreateComment({ taskId, content });
        if (!result.success) {
          toast(result.error.message, "error");
          return;
        }

        dispatch({ type: "addComment", taskId, comment: result.data });

        // Update local activity log feed optimistically
        setActivityLogs((prev) => [
          {
            id: crypto.randomUUID(),
            action: "commented",
            createdAt: new Date().toISOString(),
            actorName: result.data.authorName,
            taskTitle: tasks.find((t) => t.id === taskId)?.title || "Quest",
          },
          ...prev,
        ].slice(0, 10));
      },
      startTimer: (taskId) => {
        setActiveTimer((current) => {
          if (current) {
            dispatch({ type: "addTime", id: current.taskId, seconds: Math.round((Date.now() - current.startedAt) / 1000) });
          }
          return { taskId, startedAt: Date.now() };
        });
      },
      stopTimer: async () => {
        setActiveTimer((current) => {
          if (current) {
            const seconds = Math.round((Date.now() - current.startedAt) / 1000);
            dispatch({ type: "addTime", id: current.taskId, seconds });
            const startedAtISO = new Date(current.startedAt).toISOString();
            const endedAtISO = new Date().toISOString();
            // fire-and-forget logging; errors will be shown via toast
            apiLogWorkSession(current.taskId, seconds, startedAtISO, endedAtISO).catch((err) => {
              toast(err?.error?.message ?? "Failed to log work session", "error");
            });
          }
          return null;
        });
      },
      reset: async () => {
        dispatch({ type: "reset", tasks: initialTasksRef.current });
        setSheet({ open: false, mode: "create", task: null });
        setJustCompletedAt(null);
        setBonusXp(0);
        setBonusCoins(0);
        setActiveTimer(null);
        await apiUpdateUserStats({ bonusXp: 0, bonusCoins: 0 });
      },
      loadTasks: async (loaded, loadedBonusXp, loadedBonusCoins) => {
        dispatch({ type: "reset", tasks: loaded });
        setSheet({ open: false, mode: "create", task: null });
        setJustCompletedAt(null);
        setBonusXp(loadedBonusXp);
        setBonusCoins(loadedBonusCoins);
        setActiveTimer(null);
        await apiUpdateUserStats({ bonusXp: loadedBonusXp, bonusCoins: loadedBonusCoins });
      },
    }),
    [tasks, activityLogs, sheet, justCompletedAt, bonusXp, bonusCoins, activeTimer, toast, projects, sprints]
  );

  return (
    <TasksContext.Provider value={value}>
      {children}
      {completions.map((c) => (
        <div
          key={c.id}
          className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center"
        >
          <style>{`
            @keyframes floatUp {
              0% { transform: translateY(0); opacity: 1; }
              100% { transform: translateY(-30px); opacity: 0; }
            }
            @keyframes particleBurst {
              0% { transform: translate(0, 0) scale(1); opacity: 1; }
              100% { transform: translate(var(--x), var(--y)) scale(0.5); opacity: 0; }
            }
            @keyframes slideIn {
              0% { transform: scale(0.8); opacity: 0; }
              100% { transform: scale(1); opacity: 1; }
            }
            .animate-completion-panel {
              animation: slideIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            .animate-float-xp {
              animation: floatUp 1.2s ease-out forwards;
            }
            .animate-particle-pixel {
              animation: particleBurst 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
            }
          `}</style>
          <div className="animate-completion-panel relative flex flex-col items-center gap-2 border-4 border-primary bg-card p-6 text-center shadow-[8px_8px_0_var(--color-bg-deep)]">
            <div className="text-4xl text-[var(--color-status-ready)] font-bold animate-bounce">✓</div>
            <div className="font-display text-[9px] tracking-widest text-[var(--color-primary-gold)]">QUEST COMPLETED</div>
            <div className="text-sm font-bold text-foreground max-w-[200px] truncate">{c.title}</div>
            <div className="animate-float-xp font-display text-sm text-[var(--color-xp-gold)] mt-2">
              +{c.xp} XP
            </div>
            {/* 12 Particle burst pixels */}
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 360) / 12;
                const distance = 40 + Math.random() * 20;
                const rad = (angle * Math.PI) / 180;
                const x = `${Math.round(Math.cos(rad) * distance)}px`;
                const y = `${Math.round(Math.sin(rad) * distance)}px`;
                return (
                  <div
                    key={i}
                    className="animate-particle-pixel absolute h-2.5 w-2.5 bg-[var(--color-primary-gold)]"
                    style={{
                      "--x": x,
                      "--y": y,
                      animationDelay: `${i * 0.03}s`,
                    } as React.CSSProperties}
                  />
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </TasksContext.Provider>
  );
}

export function useTasks() {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within a TasksProvider");
  return ctx;
}
