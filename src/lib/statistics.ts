import type { Task } from "@/types/task";
import { completedAt, createdAt, formatLocalDate, parseLocalDate } from "./gamification";

export interface HeatmapDayCell {
  date: string;
  count: number;
}

export interface HeatmapGrid {
  weeks: HeatmapDayCell[][];
  maxCount: number;
}

/**
 * Per-day completion counts for the trailing 52 weeks, grouped into weeks of
 * 7 cells each (Sun..Sat), ending with the anchor week (Sun..Sat).
 */
export function buildHeatmapGrid(tasks: Task[], nowAnchor: string): HeatmapGrid {
  const counts = new Map<string, number>();
  for (const t of tasks) {
    const at = completedAt(t);
    if (!at) continue;
    const day = formatLocalDate(at);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }

  const anchor = parseLocalDate(nowAnchor);
  const end = new Date(anchor);
  end.setDate(end.getDate() - end.getDay());
  const start = new Date(end);
  start.setDate(start.getDate() - 51 * 7);

  const weeks: HeatmapDayCell[][] = [];
  let maxCount = 0;
  const cursor = new Date(start);
  for (let w = 0; w < 52; w++) {
    const week: HeatmapDayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = formatLocalDate(cursor);
      const count = counts.get(date) ?? 0;
      if (count > maxCount) maxCount = count;
      week.push({ date, count });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks, maxCount };
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOUR_PERIODS = [
  { label: "Night (12–6am)", start: 0, end: 6 },
  { label: "Morning (6am–12pm)", start: 6, end: 12 },
  { label: "Afternoon (12–6pm)", start: 12, end: 18 },
  { label: "Evening (6pm–12am)", start: 18, end: 24 },
];

export interface ProductivityProfile {
  bestWeekday: string | null;
  bestWeekdayCount: number;
  bestPeriod: string | null;
  bestPeriodCount: number;
}

/** Most productive weekday/time-of-day — docs/01-product.md §9.7, from real completion timestamps. */
export function buildProductivityProfile(tasks: Task[]): ProductivityProfile {
  const byWeekday = new Array(7).fill(0);
  const byPeriod = new Array(HOUR_PERIODS.length).fill(0);
  for (const t of tasks) {
    const at = completedAt(t);
    if (!at) continue;
    const d = new Date(at);
    byWeekday[d.getDay()]++;
    const hour = d.getHours();
    const periodIndex = HOUR_PERIODS.findIndex((p) => hour >= p.start && hour < p.end);
    if (periodIndex >= 0) byPeriod[periodIndex]++;
  }
  const maxWeekday = Math.max(...byWeekday);
  const maxPeriod = Math.max(...byPeriod);
  return {
    bestWeekday: maxWeekday > 0 ? WEEKDAY_NAMES[byWeekday.indexOf(maxWeekday)] : null,
    bestWeekdayCount: maxWeekday,
    bestPeriod: maxPeriod > 0 ? HOUR_PERIODS[byPeriod.indexOf(maxPeriod)].label : null,
    bestPeriodCount: maxPeriod,
  };
}

/** Percentage of all tasks (any status) currently done — docs/01-product.md §9.7. */
export function calcCompletionRate(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  const done = tasks.filter((t) => t.status === "done").length;
  return Math.round((done / tasks.length) * 1000) / 10;
}

/** Average calendar days from creation to completion, across done tasks with both timestamps. */
export function calcAverageTaskDurationDays(tasks: Task[]): number | null {
  const durations: number[] = [];
  for (const t of tasks) {
    if (t.status !== "done") continue;
    const done = completedAt(t);
    const created = createdAt(t);
    if (!done || !created) continue;
    const days = (new Date(done).getTime() - new Date(created).getTime()) / 86_400_000;
    if (days >= 0) durations.push(days);
  }
  if (durations.length === 0) return null;
  return Math.round((durations.reduce((s, d) => s + d, 0) / durations.length) * 10) / 10;
}

/** Total real Focus Timer time logged across all tasks, in hours — docs/01-product.md §9.5/§9.7. */
export function calcFocusHours(tasks: Task[]): number {
  const totalSeconds = tasks.reduce((sum, t) => sum + (t.timeSpentSeconds ?? 0), 0);
  return Math.round((totalSeconds / 3600) * 10) / 10;
}

export interface StoryPointComparison {
  estimated: number;
  actualHours: number;
}

/**
 * Estimated (story points, 1 SP ≈ 1 hour per docs/01-product.md §8.5) vs. actual Focus
 * Timer hours logged, across done tasks that have a story point set.
 */
export function calcEstimatedVsActualStoryPoints(tasks: Task[]): StoryPointComparison {
  let estimated = 0;
  let actualHours = 0;
  for (const t of tasks) {
    if (t.status !== "done" || t.storyPoint == null) continue;
    estimated += t.storyPoint;
    actualHours += (t.timeSpentSeconds ?? 0) / 3600;
  }
  return { estimated, actualHours: Math.round(actualHours * 10) / 10 };
}
