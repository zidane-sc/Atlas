"use client";

import { AlertCircle } from "lucide-react";
import { FilteredView } from "@/components/tasks/FilteredView";
import { useTasks } from "@/components/providers/TasksProvider";
import { isOverdue } from "@/lib/task-utils";
import { MOCK_NOW } from "@/lib/mock-data";

export default function Page() {
  const { tasks: allTasks } = useTasks();
  const tasks = allTasks.filter((t) => t.status !== "done" && isOverdue(t.dueDate, MOCK_NOW));

  return (
    <FilteredView
      title="OVERDUE"
      colorVar="--color-status-blocked"
      icon={AlertCircle}
      desc="Quests past their due date"
      tasks={tasks}
      empty="[ NO OVERDUE QUESTS ]"
      showNewQuest={false}
    />
  );
}
