"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { TaskFormValues } from "@/lib/schemas/task";
import { buildTaskFromValues, tasksReducer, mapDbTaskToClient } from "@/lib/tasks-reducer";
import type { Task, ActivityLogClient } from "@/types/task";
import { createComment as apiCreateComment } from "@/lib/actions/comments";
import { updateUserStats as apiUpdateUserStats, claimDailyQuestAction as apiClaimDailyQuest } from "@/lib/actions/user";
import { useNotifications } from "@/hooks/useNotifications";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { useSprints } from "@/components/providers/SprintsProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import {
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  logWorkSession as apiLogWorkSession,
  startFocusTimerAction as apiStartFocusTimer,
  stopFocusTimerAction as apiStopFocusTimer,
} from "@/lib/actions/tasks";
import { togglePin as apiTogglePin } from "@/lib/actions/pinned";
import { loadMoreTasks as apiLoadMoreTasks } from "@/lib/actions/tasks-load-more";
import {
  calcTaskXP,
  calculateStreak,
  computeCharacterSheet,
  computeUnlockedAchievements,
  checkAndEmitLevelUp,
  checkAndEmitAchievementUnlocks,
  checkAndEmitStreakMilestone,
  checkAndEmitDueDateNotifications,
} from "@/lib/gamification";
import { getTodayDate } from "@/lib/mock-data";
import { purchaseDecoration as apiPurchaseDecoration, placeDecoration as apiPlaceDecoration } from "@/lib/actions/decorations";
import type { TaskFilters } from "@/lib/task-filters";
import type { SavedFilterClient } from "@/lib/actions/filters";
import { saveFilterAction as apiSaveFilter, deleteFilterAction as apiDeleteFilter } from "@/lib/actions/filters";

interface SheetState {
  open: boolean;
  mode: "create" | "edit";
  task: Task | null;
}

interface ActiveTimer {
  taskId: string;
  startedAt: number;
  phase: "focus" | "break";
}

interface CompletionOverlay {
  id: string;
  xp: number;
  title: string;
  streak?: number;
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
  /**
   * Lifetime task set (every non-deleted task ever, not just the 200-cap interactive window) —
   * use this for anything that claims to be an all-time total: Character Sheet XP/level/skills,
   * achievement tiers, longest-ever streak, completion rate, focus hours. Anything genuinely
   * windowed (current streak, this-week recap, trailing throughput) should keep using `tasks`.
   */
  allTimeTasks: Task[];
  activityLogs: ActivityLogClient[];
  createTask: (values: TaskFormValues) => void;
  updateTask: (id: string, values: TaskFormValues) => Promise<boolean>;
  deleteTask: (id: string) => void;
  duplicateTask: (id: string) => void;
  addComment: (taskId: string, content: string) => Promise<void>;
  togglePin: (taskId: string, pinned: boolean) => Promise<void>;
  sheet: SheetState;
  openCreateForm: () => void;
  openEditForm: (task: Task) => void;
  closeForm: () => void;
  /** Briefly true right after any task is marked done — Companion's "excited" mood trigger. */
  justCompleted: boolean;
  bonusXp: number;
  bonusCoins: number;
  lastQuestClaimedAt: string | null;
  claimDailyQuest: (dateStr: string, xp: number, coins: number) => Promise<boolean>;
  /** Focus Timer — only one task can be timed at once; starting another stops the current one. */
  activeTimer: ActiveTimer | null;
  startTimer: (taskId: string, phase?: "focus" | "break") => Promise<void>;
  stopTimer: () => Promise<void>;
  switchPhase: (taskId: string) => Promise<void>;
  /** Settings → Reset All. */
  reset: () => void;
  loadMore: (lastTaskId: string) => Promise<void>;
  hasMore: boolean;
  lazySearchLoadMore: () => Promise<void>;
  isSearchLoadingMore: boolean;
  purchasedDecorations: string[];
  placedDecorations: Record<string, string | null>;
  purchaseDecoration: (itemId: string) => Promise<boolean>;
  placeDecoration: (category: "desk" | "chair" | "decor" | "wallpaper" | "floor", itemId: string | null) => Promise<boolean>;
  savedFilters: SavedFilterClient[];
  saveFilter: (name: string, filters: TaskFilters) => Promise<boolean>;
  deleteFilter: (id: string) => Promise<boolean>;
}

const TasksContext = createContext<TasksContextValue | null>(null);

/**
 * Single client-side source of truth for tasks + the shared create/edit sheet.
 * Stands in for real persistence (no `schema.prisma` yet — docs/02-architecture.md §4)
 * so every task-consuming page reads from here instead of the static mock array.
 */
export function TasksProvider({
  initialTasks,
  initialAllDoneTasks,
  initialActivityLogs,
  initialBonusXp,
  initialBonusCoins,
  initialPurchasedDecorations = [],
  initialPlacedDecorations = {},
  initialSavedFilters = [],
  initialLastQuestClaimedAt = null,
  initialActiveTimer = null,
  children,
}: {
  initialTasks: Task[];
  initialAllDoneTasks: Task[];
  initialActivityLogs: ActivityLogClient[];
  initialBonusXp: number;
  initialBonusCoins: number;
  initialPurchasedDecorations?: string[];
  initialPlacedDecorations?: Record<string, string | null>;
  initialSavedFilters?: SavedFilterClient[];
  initialLastQuestClaimedAt?: string | null;
  initialActiveTimer?: ActiveTimer | null;
  children: React.ReactNode;
}) {
  const initialTasksRef = useRef(initialTasks);
  const [tasks, dispatch] = useReducer(tasksReducer, initialTasks);
  // Static for the session (fetched once at page load) — session-fresh completions are already
  // covered by `tasks` itself and merged in below, so this only ever needs to hold the older
  // done tasks that fall outside the 200-task interactive window.
  const [allDoneTasksBeyondWindow] = useState(initialAllDoneTasks);
  const allTimeTasks = useMemo(() => {
    const seen = new Set(tasks.map((t) => t.id));
    return [...tasks, ...allDoneTasksBeyondWindow.filter((t) => !seen.has(t.id))];
  }, [tasks, allDoneTasksBeyondWindow]);
  const [hasMore, setHasMore] = useState(initialTasks.length >= 200);
  const [isSearchLoadingMore, setIsSearchLoadingMore] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLogClient[]>(initialActivityLogs);
  const [savedFilters, setSavedFilters] = useState<SavedFilterClient[]>(initialSavedFilters);
  const [lastQuestClaimedAt, setLastQuestClaimedAt] = useState<string | null>(initialLastQuestClaimedAt);
  const [sheet, setSheet] = useState<SheetState>({ open: false, mode: "create", task: null });
  const [justCompletedAt, setJustCompletedAt] = useState<number | null>(null);
  const [bonusXp, setBonusXp] = useState(initialBonusXp);
  const [bonusCoins, setBonusCoins] = useState(initialBonusCoins);
  const [purchasedDecorations, setPurchasedDecorations] = useState<string[]>(initialPurchasedDecorations);
  const [placedDecorations, setPlacedDecorations] = useState<Record<string, string | null>>(initialPlacedDecorations);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(initialActiveTimer);
  const [completions, setCompletions] = useState<CompletionOverlay[]>([]);
  const lastSyncTimeRef = useRef<Record<string, number>>({});
  const { notify, emit } = useNotifications();
  const { projects } = useProjects();
  const { sprints } = useSprints();
  const { soundEnabled, focusMinutes } = useSettings();

  useEffect(() => {
    if (justCompletedAt == null) return;
    const id = setTimeout(() => setJustCompletedAt(null), 4000);
    return () => clearTimeout(id);
  }, [justCompletedAt]);

  const dueCheckRanRef = useRef(false);
  useEffect(() => {
    if (dueCheckRanRef.current) return;
    dueCheckRanRef.current = true;
    const today = getTodayDate();
    // Once per calendar day per browser — a to-do app shouldn't re-nag about the same
    // overdue quest on every navigation within the same day.
    const lastCheck = window.localStorage.getItem("atlas:lastDueCheck");
    if (lastCheck === today) return;
    window.localStorage.setItem("atlas:lastDueCheck", today);
    checkAndEmitDueDateNotifications(tasks, today);
  }, [tasks]);

  const value = useMemo<TasksContextValue>(
    () => ({
      tasks,
      allTimeTasks,
      createTask: async (values) => {
        const input = {
          title: values.title,
          description: values.description || undefined,
          projectId: projects.find((p) => p.name === values.project)?.id,
          sprintId: values.sprint ? sprints.find((s) => s.name === values.sprint)?.id : undefined,
          status: values.status,
          type: values.type,
          priority: values.priority,
          effort: values.effort,
          storyPoint: values.storyPoint,
          reporter: values.reporter || "self",
          startDate: values.startDate || undefined,
          dueDate: values.dueDate || undefined,
          tags: values.tags,
          relations: values.relations,
          attachments: values.attachments,
          deliverables: values.deliverables,
        };

        const result = await apiCreateTask(input);
        if (!result.success) {
          notify(result.error.message, "error");
        } else {
          const dbProjects = projects as any[];
          const dbSprints = sprints as any[];
          const clientTask = mapDbTaskToClient(result.data, dbProjects, dbSprints);
          dispatch({ type: "restore", task: clientTask });
        }
      },
      updateTask: async (id, values) => {
        const prev = tasks.find((t) => t.id === id);
        if (!prev) return false;

        const oldTask = { ...prev };
        const requestTime = Date.now();
        lastSyncTimeRef.current[id] = requestTime;

        if (activeTimer && activeTimer.taskId === id && values.status !== "in_progress") {
          const seconds = Math.max(1, Math.round((Date.now() - activeTimer.startedAt) / 1000));
          setActiveTimer(null);
          dispatch({ type: "addTime", id, seconds });

          apiStopFocusTimer().then((res) => {
            if (res.success) {
              const { taskId, seconds: finalSeconds, startedAt, endedAt } = res.data;
              apiLogWorkSession(taskId, finalSeconds, startedAt, endedAt).catch((err) => {
                notify(err?.error?.message ?? "Failed to log work session", "error");
              });
            } else {
              notify(res.error.message, "error");
              dispatch({ type: "addTime", id, seconds: -seconds });
            }
          }).catch((err) => {
            notify(err?.error?.message ?? "Failed to stop timer", "error");
            dispatch({ type: "addTime", id, seconds: -seconds });
          });
        }

        if (prev.status !== "done" && values.status === "done") {
          setJustCompletedAt(Date.now());
          const onTime = !prev.dueDate || new Date() <= new Date(`${prev.dueDate}T23:59:59`);
          const xp = calcTaskXP(values.priority, values.storyPoint, onTime);
          const cid = crypto.randomUUID();

          const oldStreak = calculateStreak(tasks);
          const updatedTasks = tasks.map((t) => t.id === id ? { ...t, status: "done" as const } : t);
          const newStreak = calculateStreak(updatedTasks);
          const streakExtended = newStreak > oldStreak;

          // Calculate old and new character sheets to detect level-up — uses the lifetime task
          // set (not just the 200-cap window) so level/XP totals aren't missing older completions.
          const updatedAllTimeTasks = allTimeTasks.map((t) => t.id === id ? { ...t, status: "done" as const } : t);
          const oldSheet = computeCharacterSheet(allTimeTasks, bonusXp);
          const newSheet = computeCharacterSheet(updatedAllTimeTasks, bonusXp);
          checkAndEmitLevelUp(oldSheet.globalXP, newSheet.globalXP);

          // Calculate old and new achievements to detect unlocks
          const dbProjects = projects as any[];
          const dbSprints = sprints as any[];
          const oldAchievements = computeUnlockedAchievements(allTimeTasks, dbProjects, dbSprints);
          const newAchievements = computeUnlockedAchievements(updatedAllTimeTasks, dbProjects, dbSprints);
          checkAndEmitAchievementUnlocks(oldAchievements, newAchievements);

          // Emit streak milestone notification
          checkAndEmitStreakMilestone(oldStreak, newStreak);
          emit({ type: "task:completed", taskId: id, title: values.title });

          setCompletions((c) => [...c, { id: cid, xp, title: values.title, streak: streakExtended ? newStreak : undefined }]);
          if (soundEnabled) {
            playChime();
          }
          setTimeout(() => {
            setCompletions((c) => c.filter((x) => x.id !== cid));
          }, streakExtended ? 2500 : 1500);
        }

        // Optimistic update
        dispatch({ type: "update", id, changedAt: new Date().toISOString(), values });

        const input = {
          title: values.title,
          description: values.description || undefined,
          projectId: projects.find((p) => p.name === values.project)?.id,
          sprintId: values.sprint ? sprints.find((s) => s.name === values.sprint)?.id : undefined,
          status: values.status,
          type: values.type,
          priority: values.priority,
          effort: values.effort,
          storyPoint: values.storyPoint,
          reporter: values.reporter || "self",
          startDate: values.startDate || undefined,
          dueDate: values.dueDate || undefined,
          tags: values.tags,
          relations: values.relations,
          attachments: values.attachments,
          deliverables: values.deliverables,
        };

        const result = await apiUpdateTask(id, input);
        if (!result.success) {
          notify(result.error.message, "error");
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
            startDate: oldTask.startDate ?? undefined,
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
          return false;
        }
        // Sync response to client state — only if this is the latest request for this task
        if (lastSyncTimeRef.current[id] === requestTime) {
          const dbProjects = projects as any[];
          const dbSprints = sprints as any[];
          const syncedTask = mapDbTaskToClient(result.data, dbProjects, dbSprints);
          dispatch({ type: "sync", task: syncedTask });
        }
        return true;
      },
      deleteTask: async (id) => {
        const prev = tasks.find((t) => t.id === id);
        if (!prev) return;

        // Optimistic delete
        dispatch({ type: "delete", id });
        setSheet((s) => (s.task?.id === id ? { ...s, open: false } : s));

        const result = await apiDeleteTask(id);
        if (!result.success) {
          notify(result.error.message, "error");
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
          notify(result.error.message, "error");
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
      lastQuestClaimedAt,
      claimDailyQuest: async (dateStr, xp, coins) => {
        const res = await apiClaimDailyQuest({ dateStr, xp, coins });
        if (res.success) {
          // Check for level-up before updating bonusXp state
          const dbProjects = projects as any[];
          const dbSprints = sprints as any[];
          const oldSheet = computeCharacterSheet(allTimeTasks, bonusXp);
          const newSheet = computeCharacterSheet(allTimeTasks, res.data.bonusXp);
          checkAndEmitLevelUp(oldSheet.globalXP, newSheet.globalXP);

          // Check for achievement unlocks
          const oldAchievements = computeUnlockedAchievements(allTimeTasks, dbProjects, dbSprints);
          const newAchievements = computeUnlockedAchievements(allTimeTasks, dbProjects, dbSprints);
          checkAndEmitAchievementUnlocks(oldAchievements, newAchievements);

          setBonusXp(res.data.bonusXp);
          setBonusCoins(res.data.bonusCoins);
          setLastQuestClaimedAt(res.data.lastQuestClaimedAt);
          notify("Daily quest claimed! +XP and +Coins!", "success");
          return true;
        } else {
          notify(res.error.message, "error");
          return false;
        }
      },
      activeTimer,
      activityLogs,
      addComment: async (taskId, content) => {
        const result = await apiCreateComment({ taskId, content });
        if (!result.success) {
          notify(result.error.message, "error");
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
      togglePin: async (taskId, pinned) => {
        dispatch({ type: "togglePin", id: taskId, pinned });

        const result = await apiTogglePin(taskId, pinned);
        if (result.success) {
          notify(pinned ? "📌 Task pinned!" : "Pinned removed", "success");
        } else {
          notify("Failed to toggle pin", "error");
          dispatch({ type: "togglePin", id: taskId, pinned: !pinned });
        }
      },
      startTimer: async (taskId, phase = "focus") => {
        const startedAt = Date.now();
        setActiveTimer({ taskId, startedAt, phase });
        const res = await apiStartFocusTimer(taskId, phase);
        if (!res.success) {
          notify(res.error.message, "error");
          setActiveTimer(null);
        }
      },
      stopTimer: async () => {
        const current = activeTimer;
        if (!current) return;
        const seconds = Math.max(1, Math.round((Date.now() - current.startedAt) / 1000));

        setActiveTimer(null);

        const res = await apiStopFocusTimer();
        if (res.success) {
          const { taskId, seconds: finalSeconds, startedAt, endedAt, phase } = res.data;

          if (phase === "focus") {
            dispatch({ type: "addTime", id: current.taskId, seconds });
            const logRes = await apiLogWorkSession(taskId, finalSeconds, startedAt, endedAt);
            if (!logRes.success) {
              notify(logRes.error.message, "error");
              dispatch({ type: "addTime", id: current.taskId, seconds: -seconds });
            }
          }
        } else {
          notify(res.error.message, "error");
          setActiveTimer(current);
        }
      },
      switchPhase: async (taskId) => {
        const current = activeTimer;
        if (!current || current.taskId !== taskId) return;

        const res = await apiStopFocusTimer();
        if (!res.success) {
          notify(res.error.message, "error");
          return;
        }

        const { seconds: finalSeconds, startedAt, endedAt, phase } = res.data;

        if (phase === "focus") {
          const limitSeconds = focusMinutes * 60;
          const loggedSeconds = Math.min(finalSeconds, limitSeconds);

          dispatch({ type: "addTime", id: taskId, seconds: loggedSeconds });

          apiLogWorkSession(taskId, loggedSeconds, startedAt, endedAt).catch((err) => {
            notify(err?.error?.message ?? "Failed to log work session", "error");
            dispatch({ type: "addTime", id: taskId, seconds: -loggedSeconds });
          });
        }

        const nextPhase = current.phase === "focus" ? "break" : "focus";
        setActiveTimer(null);

        if (soundEnabled) playChime();
        notify(nextPhase === "focus" ? "Focus session done — break time! ☕" : "Break's over — back to it! 🔥", "success");

        if ("Notification" in window && Notification.permission === "granted") {
          new Notification(nextPhase === "focus" ? "Break Time!" : "Focus Time!", {
            body: nextPhase === "focus" ? "Take a quick 5-minute break." : "Ready to focus for 25 minutes?"
          });
        }

        const startedAtMs = Date.now();
        setActiveTimer({ taskId, startedAt: startedAtMs, phase: nextPhase });
        const startRes = await apiStartFocusTimer(taskId, nextPhase);
        if (!startRes.success) {
          notify(startRes.error.message, "error");
          setActiveTimer(null);
        }
      },
      reset: async () => {
        dispatch({ type: "reset", tasks: initialTasksRef.current });
        setSheet({ open: false, mode: "create", task: null });
        setJustCompletedAt(null);
        setBonusXp(0);
        setBonusCoins(0);
        setPurchasedDecorations([]);
        setPlacedDecorations({});
        setSavedFilters([]);
        setLastQuestClaimedAt(null);
        setActiveTimer(null);
        await apiUpdateUserStats({ bonusXp: 0, bonusCoins: 0 });
      },
      loadMore: async (lastTaskId) => {
        const result = await apiLoadMoreTasks({ cursor: lastTaskId, limit: 100 });
        if (result.success && result.data) {
          dispatch({ type: "reset", tasks: [...tasks, ...result.data] });
          setHasMore(result.data.length >= 100);
        }
      },
      lazySearchLoadMore: async () => {
        if (!hasMore) return;
        setIsSearchLoadingMore(true);
        const lastTask = tasks[tasks.length - 1];
        if (lastTask) {
          const result = await apiLoadMoreTasks({ cursor: lastTask.id, limit: 100 });
          if (result.success && result.data) {
            dispatch({ type: "reset", tasks: [...tasks, ...result.data] });
            setHasMore(result.data.length >= 100);
          }
        }
        setIsSearchLoadingMore(false);
      },
      hasMore,
      isSearchLoadingMore,
      purchasedDecorations,
      placedDecorations,
      purchaseDecoration: async (itemId) => {
        const res = await apiPurchaseDecoration(itemId);
        if (res.success) {
          setBonusCoins(res.data.bonusCoins);
          setPurchasedDecorations(res.data.purchasedDecorations);
          notify("Item purchased successfully!", "success");
          return true;
        } else {
          notify(res.error.message, "error");
          return false;
        }
      },
      placeDecoration: async (category, itemId) => {
        const res = await apiPlaceDecoration(category, itemId);
        if (res.success) {
          setPlacedDecorations(res.data.placedDecorations as Record<string, string | null>);
          notify("Item placed in room!", "success");
          return true;
        } else {
          notify(res.error.message, "error");
          return false;
        }
      },
      savedFilters,
      saveFilter: async (name, filters) => {
        const res = await apiSaveFilter(name, filters);
        if (res.success) {
          setSavedFilters(res.data);
          notify("Filter view saved!", "success");
          return true;
        } else {
          notify(res.error.message, "error");
          return false;
        }
      },
      deleteFilter: async (id) => {
        const res = await apiDeleteFilter(id);
        if (res.success) {
          setSavedFilters(res.data);
          notify("Saved filter deleted.", "success");
          return true;
        } else {
          notify(res.error.message, "error");
          return false;
        }
      },
    }),
    [
      tasks,
      allTimeTasks,
      activityLogs,
      sheet,
      justCompletedAt,
      bonusXp,
      bonusCoins,
      lastQuestClaimedAt,
      purchasedDecorations,
      placedDecorations,
      savedFilters,
      activeTimer,
      notify,
      projects,
      sprints,
      soundEnabled,
    ]
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
            {c.streak !== undefined && (
              <div className="mt-3 flex flex-col items-center gap-1 border-t border-border pt-3 w-full animate-pulse">
                <span className="text-3xl animate-bounce" style={{ filter: "drop-shadow(0 0 8px var(--color-streak-flame))", animationDuration: "0.6s" }}>🔥</span>
                <span className="font-display text-[9px] tracking-widest text-[var(--color-streak-flame)] font-bold">STREAK EXTENDED!</span>
                <span className="font-display text-sm text-foreground font-bold">{c.streak} DAYS</span>
              </div>
            )}
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
