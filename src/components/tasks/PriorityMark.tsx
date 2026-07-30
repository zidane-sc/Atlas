import { PRIORITY_COLOR_VAR, PRIORITY_LABEL, PRIORITY_SHAPE } from "@/lib/mock-data";
import type { Priority } from "@/types/task";

/** Shape + color so priority survives grayscale/colorblind viewing — docs/03-design.md §8 */
export const PRIORITY_SHAPE_GLYPH: Record<string, string> = {
  square: "■",
  triangle: "▲",
  circle: "●",
  "circle-outline": "○",
  dot: "•",
};

export function PriorityMark({ priority, withLabel = false }: { priority: Priority; withLabel?: boolean }) {
  return (
    <span
      aria-label={priority.toUpperCase()}
      title={priority.toUpperCase()}
      style={{ color: `var(${PRIORITY_COLOR_VAR[priority]})` }}
      className={
        withLabel
          ? "inline-flex items-center gap-1 text-sm leading-none whitespace-nowrap"
          : "text-base leading-none"
      }
    >
      <span>{PRIORITY_SHAPE_GLYPH[PRIORITY_SHAPE[priority]]}</span>
      {withLabel && PRIORITY_LABEL[priority]}
    </span>
  );
}
