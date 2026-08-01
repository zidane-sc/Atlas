"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { List as ListIcon, Plus, Table2, ChevronLeft, ChevronRight } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "react-beautiful-dnd";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/tasks/KanbanBoard";
import { PriorityMark } from "@/components/tasks/PriorityMark";
import { StatusBadge } from "@/components/tasks/StatusBadge";
import { TaskFilterBar } from "@/components/tasks/TaskFilterBar";
import { TaskRow } from "@/components/tasks/TaskRow";
import { PixBar } from "@/components/ui/PixBar";
import { useTasks } from "@/components/providers/TasksProvider";
import { useProjects } from "@/components/providers/ProjectsProvider";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/components/providers/ToastProvider";
import { calcTaskXP, completedAt, isTaskOnTime } from "@/lib/gamification";
import { formatDueDate, isOverdue } from "@/lib/task-utils";
import { applyTaskFilters, EMPTY_TASK_FILTERS, type TaskFilters } from "@/lib/task-filters";
import { MOCK_NOW, PRIORITY_COLOR_VAR, STATUS_COLOR_VAR, TYPE_ICON } from "@/lib/mock-data";
import type { Project } from "@/types/gamification";
import type { Priority, Task, TaskStatus } from "@/types/task";

type Tab = "kanban" | "list" | "calendar" | "timeline" | "by-project" | "archive";
const TABS: [Tab, string, string][] = [
  ["kanban", "⊞", "KANBAN"],
  ["list", "≡", "LIST"],
  ["calendar", "◫", "CALENDAR"],
  ["timeline", "⇥", "TIMELINE"],
  ["by-project", "◧", "PROJECTS"],
  ["archive", "📖", "ARCHIVE"],
];
const PRIORITY_ORDER: Priority[] = ["p0", "p1", "p2", "p3", "p4"];

export default function Page() {
  const searchParams = useSearchParams();
  const { tasks: allTasks, openEditForm, openCreateForm } = useTasks();
  const { projects } = useProjects();
  const [tab, setTab] = useState<Tab>("kanban");
  const [listMode, setListMode] = useState<"list" | "table">("list");
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_TASK_FILTERS);

  useEffect(() => {
    const filterParam = searchParams.get("filter");
    if (filterParam === "blocked") {
      setTab("list");
      setFilters((prev) => ({ ...prev, statuses: ["blocked"] as TaskStatus[] }));
    }
  }, [searchParams]);

  const projectNames = useMemo(() => projects.map((p) => p.name), [projects]);
  const filteredTasks = useMemo(() => applyTaskFilters(allTasks, filters), [allTasks, filters]);
  const hasStatusFilter = filters.statuses.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex items-center gap-0 px-2 pt-2"
        style={{ borderBottom: "2px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        {TABS.map(([id, shape, label]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm whitespace-nowrap transition-all font-medium"
              style={{
                color: active ? "var(--color-primary-gold)" : "var(--color-text-muted)",
                backgroundColor: active ? "var(--color-bg-panel)" : "transparent",
                borderBottom: active ? "3px solid var(--color-primary-gold)" : "3px solid transparent",
                marginBottom: active ? "-3px" : "0",
                boxShadow: active ? "0 2px 0 0 rgba(0,0,0,0.1) inset" : "none",
              }}
            >
              <span style={{ color: active ? "var(--color-primary-gold)" : "var(--color-dim)" }}>{shape}</span>
              {label}
            </button>
          );
        })}
        {tab === "list" ? (
          <div className="ml-auto mr-2 flex items-center gap-0 border border-border">
            <button
              onClick={() => setListMode("list")}
              className="flex items-center gap-1 px-2 py-0.5 text-sm transition-colors"
              style={{ backgroundColor: listMode === "list" ? "var(--color-bg-panel)" : "transparent", color: listMode === "list" ? "var(--color-primary-gold)" : "var(--color-text-muted)" }}
            >
              <ListIcon size={10} /> List
            </button>
            <button
              onClick={() => setListMode("table")}
              className="flex items-center gap-1 px-2 py-0.5 text-sm transition-colors"
              style={{ backgroundColor: listMode === "table" ? "var(--color-bg-panel)" : "transparent", color: listMode === "table" ? "var(--color-primary-gold)" : "var(--color-text-muted)" }}
            >
              <Table2 size={10} /> Table
            </button>
          </div>
        ) : (
          <div className="ml-auto mr-2">
            <Button size="sm" onClick={openCreateForm}><Plus size={12} /> New Quest</Button>
          </div>
        )}
      </div>

      <TaskFilterBar filters={filters} onChange={setFilters} projectNames={projectNames} />

      <div className="flex-1 overflow-hidden">
        {tab === "kanban" && <KanbanBoard tasks={filteredTasks} />}
        {tab === "list" && listMode === "list" && <ListTab tasks={filteredTasks} hideDoneByDefault={!hasStatusFilter} onSelect={openEditForm} />}
        {tab === "list" && listMode === "table" && <TableTab tasks={filteredTasks} onSelect={openEditForm} />}
        {tab === "calendar" && <CalendarTab tasks={filteredTasks} onSelect={openEditForm} />}
        {tab === "timeline" && <TimelineTab tasks={filteredTasks} projects={projects} onSelect={openEditForm} />}
        {tab === "by-project" && <ByProjectTab tasks={filteredTasks} projects={projects} onSelect={openEditForm} />}
        {tab === "archive" && <ArchiveTab tasks={filteredTasks} onSelect={openEditForm} />}
      </div>
    </div>
  );
}

function ListTab({ tasks, hideDoneByDefault, onSelect }: { tasks: Task[]; hideDoneByDefault: boolean; onSelect: (t: Task) => void }) {
  const [sort, setSort] = useState<"priority" | "due" | "status">("priority");

  const filtered = useMemo(() => {
    let t = hideDoneByDefault ? tasks.filter((x) => x.status !== "done") : tasks;
    t = [...t];
    if (sort === "priority") t.sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
    else if (sort === "due") t.sort((a, b) => (a.dueDate || "z").localeCompare(b.dueDate || "z"));
    else t.sort((a, b) => a.status.localeCompare(b.status));
    return t;
  }, [tasks, hideDoneByDefault, sort]);

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
        style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="border bg-secondary px-2 py-0 text-sm text-foreground"
            style={{ borderColor: "var(--color-border)" }}
          >
            <option value="priority">Priority</option>
            <option value="due">Due</option>
            <option value="status">Status</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="py-20 text-center text-base text-muted-foreground">[ NO QUESTS ]</p>
        ) : (
          filtered.map((t) => <TaskRow key={t.id} task={t} onSelect={onSelect} />)
        )}
      </div>
    </div>
  );
}

type SortCol = "priority" | "title" | "status" | "due" | "sp";

function SortableCol({ col, ch, sc, sd, onSort }: { col: SortCol; ch: string; sc: SortCol; sd: "asc" | "desc"; onSort: (col: SortCol) => void }) {
  return (
    <th
      onClick={() => onSort(col)}
      className="cursor-pointer px-3 py-2 text-left text-sm tracking-widest whitespace-nowrap select-none"
      style={{ color: sc === col ? "var(--color-primary-gold)" : "var(--color-text-muted)" }}
    >
      {ch}{sc === col ? (sd === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

function TableTab({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  const [sc, setSc] = useState<SortCol>("priority");
  const [sd, setSd] = useState<"asc" | "desc">("asc");

  const rows = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (sc === "priority") { av = PRIORITY_ORDER.indexOf(a.priority); bv = PRIORITY_ORDER.indexOf(b.priority); }
      else if (sc === "title") { av = a.title.toLowerCase(); bv = b.title.toLowerCase(); }
      else if (sc === "status") { av = a.status; bv = b.status; }
      else if (sc === "due") { av = a.dueDate || "z"; bv = b.dueDate || "z"; }
      else if (sc === "sp") { av = a.storyPoint ?? 0; bv = b.storyPoint ?? 0; }
      return sd === "asc" ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });
  }, [tasks, sc, sd]);

  const sortHeaderProps = { sc, sd, onSort: (col: SortCol) => { setSd(sc === col && sd === "asc" ? "desc" : "asc"); setSc(col); } };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <table className="w-full border-collapse">
        <thead className="sticky top-0" style={{ backgroundColor: "var(--color-bg-deep)", borderBottom: "2px solid var(--color-border)" }}>
          <tr>
            <SortableCol col="priority" ch="PRIORITY" {...sortHeaderProps} />
            <th className="px-3 py-2 text-left text-sm font-mono font-bold" style={{ color: "var(--color-primary-gold)" }}>CODE</th>
            <SortableCol col="status" ch="STATUS" {...sortHeaderProps} />
            <th className="px-3 py-2 text-left text-sm text-muted-foreground">TYPE</th>
            <SortableCol col="title" ch="TITLE" {...sortHeaderProps} />
            <SortableCol col="due" ch="DUE" {...sortHeaderProps} />
            <SortableCol col="sp" ch="SP" {...sortHeaderProps} />
            <th className="px-3 py-2 text-left text-sm text-muted-foreground">EFFORT</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const ov = isOverdue(t.dueDate, MOCK_NOW) && t.status !== "done";
            return (
              <tr
                key={t.id}
                onClick={() => onSelect(t)}
                className="cursor-pointer border-b border-border transition-colors hover:bg-[var(--color-bg-panel-alt)]"
              >
                <td className="px-3 py-2"><PriorityMark priority={t.priority} withLabel /></td>
                <td className="px-3 py-2 text-xs font-mono font-bold" style={{ color: "var(--color-primary-gold)" }}>{t.code}</td>
                <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                <td className="px-3 py-2 text-sm">{TYPE_ICON[t.type]}</td>
                <td className="max-w-xs truncate px-3 py-2 text-sm text-foreground">{t.title}</td>
                <td className="px-3 py-2 text-sm" style={{ color: ov ? "var(--color-status-blocked)" : "var(--color-text-muted)" }}>{formatDueDate(t.dueDate)}</td>
                <td className="px-3 py-2 text-sm text-muted-foreground">{t.storyPoint ?? "—"}</td>
                <td className="px-3 py-2 text-sm text-muted-foreground uppercase">{t.effort ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CalendarTab({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  const { updateTask } = useTasks();
  const { emit: emitNotification, setUndoState, setUndoCallback } = useNotifications();
  const { toast } = useToast();
  const [viewDate, setViewDate] = useState(new Date(MOCK_NOW));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<'due-date' | 'start-date'>('due-date');
  const [lastReschedule, setLastReschedule] = useState<{
    taskId: string;
    previousDate: string;
    newDate: string;
    timeoutId: NodeJS.Timeout;
  } | null>(null);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalRows = Math.ceil((firstWeekday + daysInMonth) / 7);

  useEffect(() => {
    if (!openDay) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenDay(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openDay]);

  const handleDragEnd = async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;

    const task = tasks.find((t) => t.id === draggableId);
    if (!task) return;

    const dateStr = destination.droppableId.replace("date-", "");
    const dropDate = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dropDate < today) {
      toast("Cannot reschedule to past date", "error");
      return;
    }

    const updateData = calendarView === "due-date"
      ? { dueDate: dateStr }
      : { startDate: dateStr };

    // Store previous date for undo
    const previousDate = calendarView === "due-date" ? task.dueDate : task.startDate;
    if (lastReschedule?.timeoutId) {
      clearTimeout(lastReschedule.timeoutId);
    }

    const timeoutId = setTimeout(() => {
      setLastReschedule(null);
      if (setUndoState) {
        setUndoState(null);
      }
    }, 5000);

    const undoStateData = {
      taskId: task.id,
      previousDate: previousDate || '',
      newDate: dateStr,
      timeoutId,
    };

    setLastReschedule(undoStateData);
    if (setUndoState) {
      setUndoState(undoStateData);
    }

    // Register undo callback to restore previous date when undo is clicked
    if (setUndoCallback) {
      setUndoCallback(() => {
        updateTask(task.id, {
          title: task.title,
          description: task.description,
          project: task.project,
          status: task.status,
          type: task.type,
          priority: task.priority,
          effort: task.effort,
          storyPoint: task.storyPoint,
          ...{ [calendarView === "due-date" ? "dueDate" : "startDate"]: previousDate || '' },
          waitingOn: task.waitingOn,
          sprint: task.sprint,
          reporter: task.reporter,
          tags: task.tags,
          relations: task.relations,
          attachments: task.attachments,
          deliverables: task.deliverables,
        } as any);
      });
    }

    await updateTask(task.id, {
      title: task.title,
      description: task.description,
      project: task.project,
      status: task.status,
      type: task.type,
      priority: task.priority,
      effort: task.effort,
      storyPoint: task.storyPoint,
      ...updateData,
      waitingOn: task.waitingOn,
      sprint: task.sprint,
      reporter: task.reporter,
      tags: task.tags,
      relations: task.relations,
      attachments: task.attachments,
      deliverables: task.deliverables,
    } as any);

    emitNotification({
      type: "task:rescheduled",
      taskId: task.id,
      title: task.title,
      newDate: dateStr,
    });
  };

  const byDate: Record<string, Task[]> = {};
  for (const t of tasks) {
    const dateField = calendarView === 'due-date' ? t.dueDate : t.startDate;
    if (!dateField) continue;
    (byDate[dateField] ??= []).push(t);
  }
  const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 px-6 py-2" style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setViewDate(new Date(year, month - 1, 1))}><ChevronLeft size={11} /></Button>
          <span className="min-w-[150px] text-center text-sm text-foreground">
            {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setViewDate(new Date(year, month + 1, 1))}><ChevronRight size={11} /></Button>
        </div>
      </div>
      <div className="flex gap-2 px-6 py-2" style={{ backgroundColor: "var(--color-bg-panel-alt)", borderBottom: "1px solid var(--color-border)" }}>
        <button
          onClick={() => setCalendarView('due-date')}
          className="px-3 py-1 border-2 font-mono text-sm"
          style={{
            borderColor: calendarView === 'due-date' ? 'var(--color-primary-gold)' : 'var(--color-border)',
            backgroundColor: calendarView === 'due-date' ? 'var(--color-primary-gold)' : 'transparent',
            color: calendarView === 'due-date' ? 'black' : 'var(--color-foreground)'
          }}
        >
          Due Date
        </button>
        <button
          onClick={() => setCalendarView('start-date')}
          className="px-3 py-1 border-2 font-mono text-sm"
          style={{
            borderColor: calendarView === 'start-date' ? 'var(--color-primary-gold)' : 'var(--color-border)',
            backgroundColor: calendarView === 'start-date' ? 'var(--color-primary-gold)' : 'transparent',
            color: calendarView === 'start-date' ? 'black' : 'var(--color-foreground)'
          }}
        >
          Start Date
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center text-sm tracking-widest text-muted-foreground">{d}</div>
          ))}
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayTasks = byDate[dateStr] ?? [];
              const isToday = dateStr === MOCK_NOW;
              const colIndex = (firstWeekday + i) % 7;
              const rowIndex = Math.floor((firstWeekday + i) / 7);
              const openRight = colIndex >= 5;
              const openUpward = rowIndex >= totalRows - 1;
              const taskColorVar = (t: Task) =>
                isOverdue(t.dueDate, MOCK_NOW) && t.status !== "done" ? "--color-status-blocked" : PRIORITY_COLOR_VAR[t.priority];
              return (
                <Droppable key={day} droppableId={`date-${dateStr}`} type="TASK">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="relative min-h-[68px] bg-card p-1.5"
                      style={{
                        border: `1px solid ${isToday ? "var(--color-primary-gold)" : "var(--color-border)"}`,
                        backgroundColor: snapshot.isDraggingOver ? "var(--color-bg-panel-alt)" : undefined,
                      }}
                    >
                      <div className="mb-1 text-sm" style={{ color: isToday ? "var(--color-primary-gold)" : "var(--color-text-muted)" }}>{day}</div>
                      {dayTasks.slice(0, 2).map((t, index) => (
                        <Draggable key={t.id} draggableId={t.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => onSelect(t)}
                              className={`mb-0.5 cursor-grab truncate px-1 text-sm ${snapshot.isDragging ? 'opacity-50' : ''}`}
                              style={{ color: `var(${taskColorVar(t)})`, borderLeft: `2px solid var(${taskColorVar(t)})`, ...provided.draggableProps.style }}
                            >
                              {isOverdue(t.dueDate, MOCK_NOW) && t.status !== "done" && "⚠ "}{TYPE_ICON[t.type]} <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--color-primary-gold)" }}>{t.code}</span> {t.title}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {dayTasks.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setOpenDay((d) => (d === dateStr ? null : dateStr))}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          +{dayTasks.length - 2}
                        </button>
                      )}
                      {openDay === dateStr && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenDay(null)} />
                          <div
                            className={`absolute z-50 w-56 border-2 border-primary bg-card p-2 ${openUpward ? "bottom-full mb-1" : "top-full mt-1"} ${openRight ? "right-0" : "left-0"}`}
                            style={{ boxShadow: "4px 4px 0 var(--color-bg-deep)" }}
                          >
                            <div className="mb-1.5 text-sm text-muted-foreground">{formatDueDate(dateStr)} · {dayTasks.length} quests</div>
                            <div className="flex flex-col gap-0.5">
                              {dayTasks.map((t) => (
                                <div
                                  key={t.id}
                                  onClick={() => { onSelect(t); setOpenDay(null); }}
                                  className="cursor-pointer truncate px-1 py-0.5 text-sm hover:bg-secondary"
                                  style={{ color: `var(${taskColorVar(t)})`, borderLeft: `2px solid var(${taskColorVar(t)})` }}
                                >
                                  {isOverdue(t.dueDate, MOCK_NOW) && t.status !== "done" && "⚠ "}{TYPE_ICON[t.type]} <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--color-primary-gold)", marginLeft: "2px" }}>{t.code}</span> <span style={{ fontSize: "11px", fontWeight: "bold", color: "var(--color-primary-gold)" }}>{t.code}</span> {t.title}
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
}

/** Per-priority bar-fill luminance, so the title text stays readable on both light and dark bars. */
const PRIORITY_BAR_TEXT_VAR: Record<Priority, string> = {
  p0: "--color-text-primary",
  p1: "--color-bg-deep",
  p2: "--color-bg-deep",
  p3: "--color-text-primary",
  p4: "--color-text-primary",
};

function TimelineTab({ tasks, projects, onSelect }: { tasks: Task[]; projects: Project[]; onSelect: (t: Task) => void }) {
  const TOTAL_DAYS = 28;
  const DAY_MS = 86_400_000;
  const start = new Date(MOCK_NOW);
  const active = tasks.filter((t) => t.status !== "done" && t.dueDate);
  const dayOffset = (dueDate: string) => Math.max(0, Math.min(TOTAL_DAYS - 1, Math.floor((new Date(dueDate).getTime() - start.getTime()) / DAY_MS)));
  const dayWidthPct = 100 / TOTAL_DAYS;
  const gridlineStyle = {
    backgroundImage: `repeating-linear-gradient(to right, var(--color-border) 0px, var(--color-border) 1px, transparent 1px, transparent ${dayWidthPct}%)`,
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="mb-3 ml-36 flex pb-2" style={{ borderBottom: "1px solid var(--color-border)", ...gridlineStyle }}>
        {Array.from({ length: 4 }).map((_, i) => {
          const d = new Date(start);
          d.setDate(start.getDate() + i * 7);
          return (
            <div key={i} className="flex-1 pl-1 text-sm text-muted-foreground">
              {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          );
        })}
      </div>
      {projects.map((p) => {
        const projectTasks = active.filter((t) => t.project === p.name);
        if (projectTasks.length === 0) return null;
        return (
          <div key={p.id} className="mb-2 flex items-center">
            <div className="flex w-36 shrink-0 items-center gap-1 truncate text-sm" style={{ color: `var(${p.colorVar})` }}>
              <span>{p.emoji}</span>{p.name}
            </div>
            <div className="relative h-7 flex-1" style={gridlineStyle}>
              {projectTasks.map((t) => {
                const pct = (dayOffset(t.dueDate!) / TOTAL_DAYS) * 100;
                return (
                  <button
                    key={t.id}
                    type="button"
                    title={t.title}
                    onClick={() => onSelect(t)}
                    className="absolute top-1 h-5 max-w-[140px] min-w-[90px] cursor-pointer overflow-hidden px-1.5 transition-opacity hover:opacity-70"
                    style={{ left: `${pct}%`, backgroundColor: `var(--color-priority-${t.priority})`, border: `1px solid var(${STATUS_COLOR_VAR[t.status]})` }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "10px" }}>
                      <span style={{ fontWeight: "bold", textTransform: "uppercase" }}>{t.code}</span>
                      <span className="block truncate text-sm font-bold" style={{ color: `var(${PRIORITY_BAR_TEXT_VAR[t.priority]})` }}>
                        {t.title}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ByProjectTab({ tasks, projects, onSelect }: { tasks: Task[]; projects: Project[]; onSelect: (t: Task) => void }) {
  const active = tasks.filter((t) => t.status !== "done");
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex flex-col gap-6">
        {projects.map((p) => {
          const projectTasks = active.filter((t) => t.project === p.name);
          const done = tasks.filter((t) => t.project === p.name && t.status === "done").length;
          const total = tasks.filter((t) => t.project === p.name).length;
          return (
            <div key={p.id}>
              <div className="mb-2 flex items-center gap-3 border-b-2 pb-2" style={{ borderColor: `var(${p.colorVar})` }}>
                <span className="text-xl">{p.emoji}</span>
                <span className="text-base" style={{ color: `var(${p.colorVar})` }}>{p.name}</span>
                <span className="text-sm text-muted-foreground">{p.category} ({projectTasks.length})</span>
                <div className="ml-auto w-40"><PixBar value={done} max={total || 1} colorVar={p.colorVar} blocks={10} /></div>
              </div>
              {projectTasks.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">No active quests</p>
              ) : (
                projectTasks.map((t) => <TaskRow key={t.id} task={t} onSelect={onSelect} />)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ArchiveTab({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  const archived = tasks
    .filter((t) => t.status === "done")
    .map((t) => ({ task: t, completedAt: completedAt(t) }))
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 py-2" style={{ borderBottom: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-panel-alt)" }}>
        <p className="text-sm text-muted-foreground">{archived.length} completed quests chronicled</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {archived.length === 0 ? (
          <p className="py-20 text-center text-base text-muted-foreground">[ HALL IS EMPTY ]</p>
        ) : (
          archived.map(({ task, completedAt: doneAt }) => {
            const xp = calcTaskXP(task.priority, task.storyPoint, isTaskOnTime(task));
            return (
              <button
                key={task.id}
                type="button"
                onClick={() => onSelect(task)}
                className="flex w-full items-center gap-3 border-b border-border px-4 py-2 text-left opacity-60 transition-opacity hover:opacity-100"
              >
                <span style={{ color: "var(--color-status-done)" }}>✓</span>
                <span className="text-sm">{TYPE_ICON[task.type]}</span>
                <span className="text-xs font-mono font-bold" style={{ color: "var(--color-primary-gold)" }}>{task.code}</span>
                <span className="flex-1 truncate text-sm text-muted-foreground line-through">{task.title}</span>
                <span className="text-sm text-muted-foreground">{task.project}</span>
                <span className="text-sm font-bold" style={{ color: "var(--color-xp-gold)" }}>+{xp} XP</span>
                <span className="text-sm" style={{ color: "var(--color-status-done)" }}>{doneAt ? formatDueDate(doneAt) : "—"}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
