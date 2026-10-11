"use client";

import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useTasks } from "@/components/providers/TasksProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { KANBAN_COLUMNS, STATUS_COLOR_VAR, STATUS_LABEL, STATUS_SHAPE } from "@/lib/mock-data";
import type { Task, TaskStatus } from "@/types/task";
import { TaskCard } from "./TaskCard";
import { EmptyState } from "@/components/ui/EmptyState";

export function KanbanBoard({ tasks }: { tasks: Task[] }) {
  const { openEditForm, updateTask } = useTasks();
  const { notify } = useNotifications();

  const moveTask = (task: Task, status: TaskStatus) => {
    if (task.status === status) return;
    notify(`${STATUS_LABEL[status]}: "${task.title}"`, "success");
    void updateTask(task.id, {
      title: task.title,
      description: task.description,
      project: task.project,
      status,
      type: task.type,
      priority: task.priority,
      size: task.size,
      dueDate: task.dueDate,
      waitingOn: task.waitingOn,
      reporter: task.reporter,
      tags: task.tags,
      relations: task.relations,
      attachments: task.attachments,
      deliverables: task.deliverables,
    });
  };

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const status = destination.droppableId as TaskStatus;
    const task = tasks.find((t) => t.id === draggableId);
    if (task) moveTask(task, status);
  };

  return (
    <div className="h-full overflow-x-auto">
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex h-full min-w-max gap-3 p-3 sm:p-4 snap-x snap-mandatory">
          {KANBAN_COLUMNS.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status);
            const colorVar = STATUS_COLOR_VAR[status];
            return (
              <div key={status} className="guild-column flex w-[82vw] sm:w-[270px] shrink-0 flex-col snap-start p-2">
                <div
                  className="guild-column-header mb-2 flex items-center justify-between p-2 border-b-2"
                  style={{ borderBottomColor: `var(${colorVar})` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm leading-none" style={{ color: `var(${colorVar})` }}>{STATUS_SHAPE[status]}</span>
                    <span className="text-xs font-mono font-bold tracking-widest uppercase" style={{ color: `var(${colorVar})` }}>
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <span
                    className="font-mono text-xs font-bold px-1.5 py-0.2 border"
                    style={{ borderColor: `var(${colorVar})`, color: `var(${colorVar})` }}
                  >
                    {columnTasks.length}
                  </span>
                </div>
                <Droppable droppableId={status} type="TASK">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 space-y-2 overflow-y-auto min-h-[300px] p-1 transition-colors"
                      style={{
                        backgroundColor: snapshot.isDraggingOver ? "rgba(255, 217, 61, 0.05)" : "transparent",
                      }}
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <TaskCard
                              task={task}
                              onSelect={openEditForm}
                              onMoveStatus={moveTask}
                              dragHandleRef={dragProvided.innerRef}
                              draggableProps={dragProvided.draggableProps}
                              dragHandleProps={dragProvided.dragHandleProps}
                              isDragging={dragSnapshot.isDragging}
                            />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {columnTasks.length === 0 && (
                        <EmptyState
                          icon={status === "done" ? "🏆" : status === "in_progress" ? "⚔️" : "📜"}
                          message={STATUS_LABEL[status]}
                          variant="dashed"
                        />
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
