/** YYYY-MM-DD strings compare lexicographically, so plain string comparison is safe. */
export function isDueToday(dueDate: string | undefined, today: string): boolean {
  return dueDate === today;
}

export function isOverdue(dueDate: string | undefined, today: string): boolean {
  return dueDate != null && dueDate < today;
}

export function formatDueDate(dueDate: string | undefined): string {
  if (!dueDate) return "—";
  return new Date(`${dueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
