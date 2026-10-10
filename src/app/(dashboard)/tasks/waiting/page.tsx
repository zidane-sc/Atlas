"use client";

import { Clock } from "lucide-react";
import { FilteredView } from "@/components/tasks/FilteredView";
import { useTasks } from "@/components/providers/TasksProvider";

export default function Page() {
  const { tasks: allTasks } = useTasks();
  // waiting_external status removed in simplified model
  const tasks: typeof allTasks = [];

  return (
    <FilteredView
      title="WAITING EXTERNAL"
      colorVar="--color-text-muted"
      icon={Clock}
      desc="This view is no longer available — waiting_external status was removed in simplified model"
      tasks={tasks}
      empty="[ STATUS REMOVED ]"
      showNewQuest={false}
    />
  );
}
