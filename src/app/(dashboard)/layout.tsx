import { Sidebar } from "@/components/layout/Sidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { TaskFormSheet } from "@/components/tasks/TaskFormSheet";
import { ProjectFormSheet } from "@/components/projects/ProjectFormSheet";
import { SprintFormSheet } from "@/components/sprints/SprintFormSheet";
import { TasksProvider } from "@/components/providers/TasksProvider";
import { ProjectsProvider } from "@/components/providers/ProjectsProvider";
import { SprintsProvider } from "@/components/providers/SprintsProvider";
import { CommandPaletteProvider } from "@/components/providers/CommandPaletteProvider";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { mockProjects, mockSprints, mockTasks } from "@/lib/mock-data";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <SettingsProvider>
        <ProjectsProvider initialProjects={mockProjects}>
          <SprintsProvider initialSprints={mockSprints}>
            <TasksProvider initialTasks={mockTasks}>
              <CommandPaletteProvider>
                <div className="flex h-full flex-1 overflow-hidden">
                  <Sidebar />
                  <div className="flex-1 overflow-y-auto">{children}</div>
                </div>
                <TaskFormSheet />
                <ProjectFormSheet />
                <SprintFormSheet />
                <CommandPalette />
              </CommandPaletteProvider>
            </TasksProvider>
          </SprintsProvider>
        </ProjectsProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
