"use client";

import { useTasks } from "@/components/providers/TasksProvider";
import { PinnedTaskFAB } from "./PinnedTaskFAB";

export function PinnedTaskFABWrapper() {
  const { tasks, openEditForm, togglePin } = useTasks();
  const pinnedTasks = tasks.filter((t) => t.pinned);

  return (
    <PinnedTaskFAB
      tasks={pinnedTasks}
      onOpen={openEditForm}
      onUnpin={(taskId) => togglePin(taskId, false)}
    />
  );
}
