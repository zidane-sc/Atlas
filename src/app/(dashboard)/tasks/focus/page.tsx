"use client";

import { Crosshair } from "lucide-react";
import { FilteredView } from "@/components/tasks/FilteredView";
import { useTasks } from "@/components/providers/TasksProvider";

export default function Page() {
  const { tasks: allTasks } = useTasks();
  const tasks = allTasks.filter(
    (t) =>
      (t.status === "todo" || t.status === "in_progress") &&
      (t.priority === "high" || t.priority === "medium")
  );

  return (
    <FilteredView
      title="FOCUS MODE"
      colorVar="--color-status-ready"
      icon={Crosshair}
      desc="High/Medium priority AND Todo or In Progress status — work that matters most"
      tasks={tasks}
      empty="[ ALL DONE — REST ]"
    />
  );
}
