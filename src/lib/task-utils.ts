/** YYYY-MM-DD strings compare lexicographically, so plain string comparison is safe. */
export function isDueToday(dueDate: string | undefined, today: string): boolean {
  return dueDate === today;
}

export function isOverdue(dueDate: string | undefined, today: string): boolean {
  return dueDate != null && dueDate < today;
}

/** Due today or tomorrow, but not already overdue — the boundary for a "due soon" nudge. */
export function isDueSoon(dueDate: string | undefined, today: string): boolean {
  if (dueDate == null) return false;
  const tomorrow = new Date(`${today}T00:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  return dueDate === today || dueDate === tomorrowStr;
}

export function formatDueDate(dueDate: string | undefined): string {
  if (!dueDate) return "—";
  return new Date(`${dueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
