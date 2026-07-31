"use client";

import { useMemo, useState } from "react";
import type { Task } from "@/types/task";
import { parseLocalDate } from "@/lib/gamification";
import { buildHeatmapGrid } from "@/lib/statistics";

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 0 = empty cell, then 4 ascending intensity shades toward --color-status-ready (#4ecca3). */
const HEAT_COLORS = ["#1b2029", "#1f6f50", "#23926d", "#37b589", "#4ecca3"];

const WEEKDAY_LABELS = [
  { d: 1, label: "Mon" },
  { d: 3, label: "Wed" },
  { d: 5, label: "Fri" },
];

const CELL = 11;
const GAP = 3;
const TOOLTIP_WIDTH = 132;
const TOOLTIP_HEIGHT = 42;

function levelFor(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return 0;
  return Math.min(4, Math.ceil((count / maxCount) * 4));
}

function formatDateDisplay(dateStr: string): string {
  return parseLocalDate(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface TooltipState {
  date: string;
  count: number;
  left: number;
  top: number;
}

export default function ActivityHeatmap({ tasks, nowAnchor }: { tasks: Task[]; nowAnchor: string }) {
  const grid = useMemo(() => buildHeatmapGrid(tasks, nowAnchor), [tasks, nowAnchor]);
  const [tip, setTip] = useState<TooltipState | null>(null);

  const monthLabels = useMemo(() => {
    const labels: { label: string; start: number; end: number }[] = [];
    let prevMonth = "";
    grid.weeks.forEach((week, w) => {
      const monthKey = week[0].date.slice(0, 7);
      if (monthKey !== prevMonth) {
        labels.push({ label: MONTH_ABBR[Number(week[0].date.slice(5, 7)) - 1], start: w, end: w });
        prevMonth = monthKey;
      } else if (labels.length > 0) {
        labels[labels.length - 1].end = w;
      }
    });
    return labels;
  }, [grid]);

  return (
    <div className="border-2 border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm tracking-widest" style={{ color: "var(--color-status-ready)" }}>▸ ACTIVITY HEATMAP</span>
        <div className="flex items-center gap-1 text-sm" style={{ color: "var(--color-dim)" }}>
          <span className="mr-1">LESS</span>
          {HEAT_COLORS.map((c, i) => (
            <span key={i} className="inline-block h-[10px] w-[10px]" style={{ backgroundColor: c }} />
          ))}
          <span className="ml-1">MORE</span>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="relative inline-grid"
          style={{
            gridTemplateColumns: `30px repeat(52, ${CELL}px)`,
            gridTemplateRows: `14px repeat(7, ${CELL}px)`,
            gap: GAP,
          }}
        >
          {monthLabels.map((m) => (
            <div
              key={m.start}
              style={{
                gridColumn: `${m.start + 2} / ${m.end + 3}`,
                gridRow: 1,
                fontSize: 9,
                lineHeight: "14px",
                color: "var(--color-text-muted)",
                fontFamily: "VT323, monospace",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {m.label}
            </div>
          ))}

          {WEEKDAY_LABELS.map(({ d, label }) => (
            <div
              key={label}
              style={{
                gridColumn: 1,
                gridRow: d + 2,
                fontSize: 9,
                lineHeight: `${CELL}px`,
                color: "var(--color-text-muted)",
                fontFamily: "VT323, monospace",
                textAlign: "right",
                paddingRight: 4,
              }}
            >
              {label}
            </div>
          ))}

          {grid.weeks.map((week, w) =>
            week.map((cell, d) => (
              <div
                key={cell.date}
                title={cell.date}
                onMouseEnter={(e) => {
                  const el = e.currentTarget;
                  const gridEl = el.offsetParent as HTMLElement | null;
                  const gridWidth = gridEl?.clientWidth ?? 0;
                  const gridHeight = gridEl?.clientHeight ?? 0;
                  const left = Math.min(
                    el.offsetLeft + el.offsetWidth + GAP,
                    Math.max(0, gridWidth - TOOLTIP_WIDTH)
                  );
                  const placeBelow = el.offsetTop + CELL <= gridHeight - TOOLTIP_HEIGHT;
                  const top = placeBelow ? el.offsetTop : Math.max(0, el.offsetTop - TOOLTIP_HEIGHT - GAP);
                  setTip({
                    date: cell.date,
                    count: cell.count,
                    left,
                    top,
                  });
                }}
                onMouseLeave={() => setTip(null)}
                style={{
                  gridColumn: w + 2,
                  gridRow: d + 2,
                  width: CELL,
                  height: CELL,
                  backgroundColor: HEAT_COLORS[levelFor(cell.count, grid.maxCount)],
                }}
              />
            ))
          )}

          {tip && (
            <div
              className="pointer-events-none absolute z-10 px-2 py-1"
              style={{
                left: tip.left,
                top: tip.top,
                backgroundColor: "var(--color-bg-panel)",
                border: "2px solid var(--color-primary-gold)",
                color: "var(--color-text-primary)",
                fontFamily: "VT323, monospace",
                fontSize: "12px",
                lineHeight: "1.2",
              }}
            >
              <div>{formatDateDisplay(tip.date)}</div>
              <div>{tip.count} {tip.count === 1 ? "task" : "tasks"} completed</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
