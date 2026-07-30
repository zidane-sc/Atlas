"use client";

import { Sun } from "lucide-react";
import { FilteredView } from "@/components/tasks/FilteredView";
import { useTasks } from "@/components/providers/TasksProvider";
import { MOCK_NOW } from "@/lib/mock-data";

export default function Page() {
  const { tasks: allTasks } = useTasks();
  const tasks = allTasks.filter(
    (t) => t.status !== "done" && (t.dueDate === MOCK_NOW || t.status === "in_progress")
  );

  return (
    <FilteredView
      title="TODAY"
      colorVar="--color-primary-gold"
      icon={Sun}
      desc="Quests due today and in progress"
      tasks={tasks}
      empty="[ ALL CLEAR ]"
    />
  );
}
