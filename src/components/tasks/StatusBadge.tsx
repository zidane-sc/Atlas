import { STATUS_COLOR_VAR, STATUS_LABEL, STATUS_SHAPE } from "@/lib/mock-data";
import type { TaskStatus } from "@/types/task";

/** Shape + color so status also survives grayscale/colorblind viewing — docs/03-design.md §8 */
export function StatusBadge({ status, withLabel = true }: { status: TaskStatus; withLabel?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-sm leading-none whitespace-nowrap"
      style={{ color: `var(${STATUS_COLOR_VAR[status]})` }}
    >
      <span>{STATUS_SHAPE[status]}</span>
      {withLabel && STATUS_LABEL[status]}
    </span>
  );
}
