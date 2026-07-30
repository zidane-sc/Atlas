"use client";

import { Inbox } from "lucide-react";
import { FilteredView } from "@/components/tasks/FilteredView";
import { useTasks } from "@/components/providers/TasksProvider";

export default function Page() {
  const { tasks: allTasks } = useTasks();
  const tasks = allTasks.filter((t) => t.status === "inbox");

  return (
    <FilteredView
      title="INBOX"
      colorVar="--color-text-muted"
      icon={Inbox}
      desc="Captured but not yet triaged"
      tasks={tasks}
      empty="[ INBOX EMPTY ]"
    />
  );
}
