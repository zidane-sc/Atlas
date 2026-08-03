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

  const moveTask = async (task: Task, status: TaskStatus) => {
    if (task.status === status) return;
    const success = await updateTask(task.id, {
      title: task.title,
      description: task.description,
      project: task.project,
      status,
      type: task.type,
      priority: task.priority,
      effort: task.effort,
      storyPoint: task.storyPoint,
      dueDate: task.dueDate,
      waitingOn: task.waitingOn,
      sprint: task.sprint,
      reporter: task.reporter,
      tags: task.tags,
      relations: task.relations,
      attachments: task.attachments,
      deliverables: task.deliverables,
    });
    if (success) {
      notify(`${STATUS_LABEL[status]}: "${task.title}"`, "success");
    }
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
        <div className="flex h-full min-w-max gap-3 p-4">
          {KANBAN_COLUMNS.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status);
            const colorVar = STATUS_COLOR_VAR[status];
            return (
              <div key={status} className="flex w-60 shrink-0 flex-col">
                <div className="mb-3 flex items-center gap-2 border-b-2 pb-2" style={{ borderColor: `var(${colorVar})` }}>
                  <span style={{ color: `var(${colorVar})` }}>{STATUS_SHAPE[status]}</span>
                  <span className="text-sm tracking-widest" style={{ color: `var(${colorVar})` }}>{STATUS_LABEL[status].toUpperCase()}</span>
                  <span className="text-sm text-muted-foreground">({columnTasks.length})</span>
                </div>
                <Droppable droppableId={status} type="TASK">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex-1 space-y-2 overflow-y-auto border-2 p-1"
                      style={{ borderColor: snapshot.isDraggingOver ? "var(--color-primary-gold)" : "transparent" }}
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
                        <EmptyState icon="─" message={STATUS_LABEL[status]} variant="dashed" />
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
