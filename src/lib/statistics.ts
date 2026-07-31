import type { Task } from "@/types/task";
import { completedAt, formatLocalDate, parseLocalDate } from "./gamification";

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
 * 7 cells each (Sun..Sat), ending on the Sunday of the anchor week.
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
