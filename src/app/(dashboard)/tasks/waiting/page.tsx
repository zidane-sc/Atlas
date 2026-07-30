"use client";

import { Clock } from "lucide-react";
import { FilteredView } from "@/components/tasks/FilteredView";
import { useTasks } from "@/components/providers/TasksProvider";

export default function Page() {
  const { tasks: allTasks } = useTasks();
  const tasks = allTasks.filter((t) => t.status === "waiting_external");

  return (
    <FilteredView
      title="WAITING EXTERNAL"
      colorVar="--color-status-waiting-external"
      icon={Clock}
      desc="Quests waiting on another person or system"
      tasks={tasks}
      empty="[ NOTHING WAITING ]"
      showNewQuest={false}
    />
  );
}
