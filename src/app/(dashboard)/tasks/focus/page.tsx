"use client";

import { Crosshair } from "lucide-react";
import { FilteredView } from "@/components/tasks/FilteredView";
import { useTasks } from "@/components/providers/TasksProvider";

export default function Page() {
  const { tasks: allTasks } = useTasks();
  const tasks = allTasks.filter(
    (t) => t.status === "ready" && (t.priority === "p0" || t.priority === "p1")
  );

  return (
    <FilteredView
      title="FOCUS MODE"
      colorVar="--color-status-ready"
      icon={Crosshair}
      desc="P0+P1 priority AND Ready status — work that matters most"
      tasks={tasks}
      empty="[ ALL DONE — REST ]"
    />
  );
}
