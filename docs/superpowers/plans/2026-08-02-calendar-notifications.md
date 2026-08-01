# Calendar Drag-Drop + Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement drag-to-reschedule for calendar tasks and notifications system for task + gamification events.

**Architecture:** Two independent systems. Notifications: event emitter + queue component. Calendar: react-beautiful-dnd with dual-view toggle.

**Tech Stack:** React, react-beautiful-dnd, existing updateTask action, Web Audio API.

## Global Constraints

- No breaking changes to existing calendar view
- Notifications stack max 5 concurrent toasts
- Drag validation: no past dates, validated on drop
- Sound toggle in existing User.settings
- Maintain retro pixel art aesthetic
- Mobile: react-beautiful-dnd native touch support

---

## PHASE 1: NOTIFICATIONS SYSTEM

### Task 1: Create notification event types

**Files:**
- Create: `src/lib/notification-events.ts`

**Interfaces:**
- Produces: `NotificationPayload` (union type), `NotificationEvent` (type definition)

- [ ] **Step 1: Create event types file**

```typescript
// src/lib/notification-events.ts

export type NotificationEvent = 
  | { type: 'task:overdue'; taskId: string; title: string }
  | { type: 'task:due-soon'; taskId: string; title: string; dueDate: string }
  | { type: 'task:completed'; taskId: string; title: string }
  | { type: 'task:rescheduled'; taskId: string; title: string; newDate: string }
  | { type: 'gamification:level-up'; newLevel: number; xp: number }
  | { type: 'gamification:achievement-unlocked'; achievementId: string; name: string }
  | { type: 'gamification:streak-milestone'; days: number; vibe: string };

export interface NotificationPayload {
  id: string;
  event: NotificationEvent;
  timestamp: number;
  dismissedAt?: number;
}

export function getNotificationMessage(event: NotificationEvent): { icon: string; text: string } {
  switch (event.type) {
    case 'task:overdue':
      return { icon: '⚠️', text: `Quest overdue: ${event.title}` };
    case 'task:due-soon':
      return { icon: '⏰', text: `Quest due soon: ${event.title}` };
    case 'task:completed':
      return { icon: '✓', text: `Quest completed: ${event.title}` };
    case 'task:rescheduled':
      return { icon: '📅', text: `Rescheduled to ${event.newDate}` };
    case 'gamification:level-up':
      return { icon: '📈', text: `Level up to ${event.newLevel}!` };
    case 'gamification:achievement-unlocked':
      return { icon: '⭐', text: `Achievement unlocked: ${event.name}` };
    case 'gamification:streak-milestone':
      return { icon: '🔥', text: `${event.days}-day streak! (${event.vibe})` };
  }
}

export function shouldPlaySound(event: NotificationEvent): boolean {
  return event.type === 'gamification:level-up' 
    || event.type === 'gamification:achievement-unlocked'
    || event.type === 'gamification:streak-milestone';
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notification-events.ts
git commit -m "feat: define notification event types and message formatting"
```

---

### Task 2: Create useNotifications hook and event emitter

**Files:**
- Create: `src/hooks/useNotifications.ts`

**Interfaces:**
- Produces: `useNotifications()` hook, `notificationEmitter` (singleton event bus)

- [ ] **Step 1: Create event emitter singleton**

```typescript
// src/hooks/useNotifications.ts

import { useContext, useCallback } from 'react';
import { NotificationContext } from '@/components/providers/NotificationProvider';
import type { NotificationEvent } from '@/lib/notification-events';

class NotificationEmitter {
  private listeners: Array<(event: NotificationEvent) => void> = [];

  subscribe(listener: (event: NotificationEvent) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  emit(event: NotificationEvent) {
    this.listeners.forEach(listener => listener(event));
  }
}

export const notificationEmitter = new NotificationEmitter();

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }

  const emit = useCallback((event: NotificationEvent) => {
    notificationEmitter.emit(event);
  }, []);

  return { emit, notifications: context.notifications };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useNotifications.ts
git commit -m "feat: create notification emitter and useNotifications hook"
```

---

### Task 3: Create NotificationQueue component and provider

**Files:**
- Create: `src/components/providers/NotificationProvider.tsx`
- Create: `src/components/notifications/NotificationQueue.tsx`

**Interfaces:**
- Consumes: `notificationEmitter`, `NotificationEvent`, `getNotificationMessage`, `shouldPlaySound`
- Produces: `NotificationContext`, `NotificationProvider` component, `NotificationQueue` component

- [ ] **Step 1: Create NotificationProvider**

```typescript
// src/components/providers/NotificationProvider.tsx

'use client';

import { createContext, useState, useEffect, useCallback } from 'react';
import { notificationEmitter } from '@/hooks/useNotifications';
import type { NotificationPayload, NotificationEvent } from '@/lib/notification-events';

export interface NotificationContextValue {
  notifications: NotificationPayload[];
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);

  useEffect(() => {
    const handleEvent = (event: NotificationEvent) => {
      const id = crypto.randomUUID();
      const payload: NotificationPayload = {
        id,
        event,
        timestamp: Date.now(),
      };

      setNotifications(prev => {
        const next = [payload, ...prev];
        // Keep max 5 concurrent notifications
        if (next.length > 5) {
          return next.slice(0, 5);
        }
        return next;
      });

      // Auto-dismiss after 5s
      const timer = setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 5000);

      return () => clearTimeout(timer);
    };

    return notificationEmitter.subscribe(handleEvent);
  }, []);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications }}>
      {children}
      <NotificationQueue notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}
```

- [ ] **Step 2: Create NotificationQueue component**

```typescript
// src/components/notifications/NotificationQueue.tsx

'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { NotificationPayload } from '@/lib/notification-events';
import { getNotificationMessage, shouldPlaySound } from '@/lib/notification-events';
import { useSettings } from '@/components/providers/SettingsProvider';

export function NotificationQueue({
  notifications,
  onDismiss,
}: {
  notifications: NotificationPayload[];
  onDismiss: (id: string) => void;
}) {
  const { settings } = useSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (notifications.length === 0) return;

    const latest = notifications[0];
    if (shouldPlaySound(latest.event) && settings.soundEnabled) {
      try {
        // Play notification sound if available
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {
            // Silent fail if audio fails
          });
        }
      } catch (err) {
        // Silent fail
      }
    }
  }, [notifications, settings.soundEnabled]);

  return (
    <>
      <audio ref={audioRef} src="/sounds/notification.mp3" />
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {notifications.map((notification) => {
          const { icon, text } = getNotificationMessage(notification.event);
          return (
            <div
              key={notification.id}
              className="flex items-center gap-3 bg-[var(--color-bg-panel)] border-2 border-[var(--color-primary-gold)] px-4 py-3 font-mono text-sm animate-in slide-in-from-top"
              style={{
                backdropFilter: 'blur(4px)',
              }}
            >
              <span className="text-base">{icon}</span>
              <span className="flex-1 truncate">{text}</span>
              <button
                onClick={() => onDismiss(notification.id)}
                className="ml-2 hover:opacity-70"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/providers/NotificationProvider.tsx src/components/notifications/NotificationQueue.tsx
git commit -m "feat: create notification queue component and provider"
```

---

### Task 4: Integrate NotificationProvider into root layout

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `NotificationProvider` component

- [ ] **Step 1: Add NotificationProvider to layout**

Find the root layout where providers are wrapped. Add `<NotificationProvider>` around the children:

```typescript
// src/app/layout.tsx - in the root RootLayout or similar

import { NotificationProvider } from '@/components/providers/NotificationProvider';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <NotificationProvider>
          {/* other providers */}
          {children}
        </NotificationProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add NotificationProvider to root layout"
```

---

### Task 5: Emit task notifications from TasksProvider

**Files:**
- Modify: `src/components/providers/TasksProvider.tsx:200-220`

**Interfaces:**
- Consumes: `useNotifications()` hook
- Emits: `task:completed`, `task:rescheduled` events

- [ ] **Step 1: Add useNotifications hook**

At top of TasksProvider, import and use:

```typescript
import { useNotifications } from '@/hooks/useNotifications';

// Inside TasksProvider component:
const { emit: emitNotification } = useNotifications();
```

- [ ] **Step 2: Emit on task completion**

In updateTask logic, when status changes to "done":

```typescript
if (statusChanged && values.status === "done") {
  emitNotification({
    type: 'task:completed',
    taskId: id,
    title: prev.title,
  });
}
```

- [ ] **Step 3: Emit on date reschedule**

When dueDate or startDate changes:

```typescript
const dateChanged = (oldTask.dueDate !== values.dueDate) || (oldTask.startDate !== values.startDate);
if (dateChanged) {
  emitNotification({
    type: 'task:rescheduled',
    taskId: id,
    title: prev.title,
    newDate: values.dueDate || values.startDate || 'unscheduled',
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/providers/TasksProvider.tsx
git commit -m "feat: emit task notifications on completion and reschedule"
```

---

### Task 6: Emit gamification notifications from gamification.ts

**Files:**
- Modify: `src/lib/gamification.ts` (location of levelUp, achievementProgress logic)

**Interfaces:**
- Consumes: `notificationEmitter`
- Emits: `gamification:level-up`, `gamification:achievement-unlocked`, `gamification:streak-milestone`

- [ ] **Step 1: Import emitter at top**

```typescript
import { notificationEmitter } from '@/hooks/useNotifications';
```

- [ ] **Step 2: Emit on level up**

In the function that computes level (likely `getLevelInfo` or similar), after detecting level increased:

```typescript
if (newLevel > oldLevel) {
  notificationEmitter.emit({
    type: 'gamification:level-up',
    newLevel,
    xp: totalXp,
  });
}
```

- [ ] **Step 3: Emit on achievement unlock**

In `computeAchievementProgress` or similar, when an achievement transitions from incomplete to complete:

```typescript
if (wasIncomplete && isNowComplete) {
  notificationEmitter.emit({
    type: 'gamification:achievement-unlocked',
    achievementId: achievement.id,
    name: achievement.name,
  });
}
```

- [ ] **Step 4: Emit on streak milestone**

In streak calculation logic, when streak reaches 7, 14, or 30:

```typescript
const milestones = [7, 14, 30];
if (milestones.includes(streak.days)) {
  notificationEmitter.emit({
    type: 'gamification:streak-milestone',
    days: streak.days,
    vibe: streak.vibe, // or compute vibe here
  });
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/gamification.ts
git commit -m "feat: emit gamification notifications on level-up, achievements, streaks"
```

---

## PHASE 2: CALENDAR DRAG-DROP

### Task 7: Add react-beautiful-dnd dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependency**

```bash
npm install react-beautiful-dnd @types/react-beautiful-dnd
```

- [ ] **Step 2: Verify install**

```bash
npm ls react-beautiful-dnd
```

Expected: `react-beautiful-dnd@13.x.x` or latest

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add react-beautiful-dnd for drag-drop"
```

---

### Task 8: Add calendar view toggle UI

**Files:**
- Modify: `src/app/(dashboard)/tasks/page.tsx:CalendarTab`

**Interfaces:**
- Consumes: Tab state management
- Produces: `calendarView` state (due-date | start-date)

- [ ] **Step 1: Add view state to CalendarTab**

Inside the CalendarTab component (or create if missing), add:

```typescript
const [calendarView, setCalendarView] = useState<'due-date' | 'start-date'>('due-date');
```

- [ ] **Step 2: Add toggle button UI**

Above the calendar grid, add button group:

```typescript
<div className="flex gap-2 mb-4">
  <button
    onClick={() => setCalendarView('due-date')}
    className={`px-3 py-1 border-2 font-mono text-sm ${
      calendarView === 'due-date'
        ? 'border-[var(--color-primary-gold)] bg-[var(--color-primary-gold)] text-black'
        : 'border-[var(--color-border)] text-foreground'
    }`}
  >
    Due Date
  </button>
  <button
    onClick={() => setCalendarView('start-date')}
    className={`px-3 py-1 border-2 font-mono text-sm ${
      calendarView === 'start-date'
        ? 'border-[var(--color-primary-gold)] bg-[var(--color-primary-gold)] text-black'
        : 'border-[var(--color-border)] text-foreground'
    }`}
  >
    Start Date
  </button>
</div>
```

- [ ] **Step 3: Pass view to calendar render logic**

Modify calendar grid rendering to use `calendarView` when grouping tasks by date.

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/tasks/page.tsx
git commit -m "feat: add calendar view toggle (due date vs start date)"
```

---

### Task 9: Make TaskCard draggable in calendar

**Files:**
- Modify: `src/components/tasks/TaskCard.tsx` (or create calendar-specific variant)
- Create: `src/components/tasks/DraggableTaskCard.tsx` (optional, if needed for calendar-only variant)

**Interfaces:**
- Consumes: `Draggable` from react-beautiful-dnd
- Produces: Draggable task card with grab cursor

- [ ] **Step 1: Wrap TaskCard in Draggable**

Inside CalendarTab's calendar grid rendering, wrap task cards:

```typescript
import { Draggable } from 'react-beautiful-dnd';

{tasks.map((task, index) => (
  <Draggable key={task.id} draggableId={task.id} index={index}>
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        className={`cursor-grab ${snapshot.isDragging ? 'opacity-50' : ''}`}
        style={{
          ...provided.draggableProps.style,
          backgroundColor: snapshot.isDragging ? 'rgba(0,0,0,0.5)' : 'inherit',
        }}
      >
        <TaskCard task={task} onSelect={openEditForm} />
      </div>
    )}
  </Draggable>
))}
```

- [ ] **Step 2: Add grab cursor to TaskCard**

In TaskCard.tsx, add:

```typescript
className="... cursor-grab hover:cursor-grab active:cursor-grabbing ..."
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/TaskCard.tsx src/app/(dashboard)/tasks/page.tsx
git commit -m "feat: make calendar task cards draggable"
```

---

### Task 10: Wire up drag-drop zones and updateTask calls

**Files:**
- Modify: `src/app/(dashboard)/tasks/page.tsx:CalendarTab`

**Interfaces:**
- Consumes: `updateTask` action, `useNotifications()` hook
- Handles: drop zone logic, API calls, undo state

- [ ] **Step 1: Wrap calendar in DragDropContext**

```typescript
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';

<DragDropContext onDragEnd={handleDragEnd}>
  <Droppable droppableId="calendar-grid" type="TASK">
    {(provided, snapshot) => (
      <div
        ref={provided.innerRef}
        className={`border-2 ${
          snapshot.isDraggingOver ? 'bg-[var(--color-primary-gold)]/10' : ''
        }`}
      >
        {/* calendar grid with draggable tasks */}
      </div>
    )}
  </Droppable>
</DragDropContext>
```

- [ ] **Step 2: Implement handleDragEnd**

```typescript
const handleDragEnd = async (result: DropResult) => {
  const { draggableId, destination } = result;

  if (!destination) return; // Dropped outside droppable

  const task = tasks.find(t => t.id === draggableId);
  if (!task) return;

  // Extract date from destination.droppableId (e.g., "date-2026-08-15")
  const dateStr = destination.droppableId.replace('date-', '');
  
  // Validate not past date
  if (new Date(dateStr) < new Date()) {
    emitNotification({
      type: 'task:overdue', // Reuse for error; improve later with error type
      taskId: task.id,
      title: 'Cannot reschedule to past date',
    });
    return;
  }

  const updateData = calendarView === 'due-date'
    ? { dueDate: dateStr }
    : { startDate: dateStr };

  await updateTask(task.id, updateData);
  
  emitNotification({
    type: 'task:rescheduled',
    taskId: task.id,
    title: task.title,
    newDate: dateStr,
  });
};
```

- [ ] **Step 3: Update droppable IDs for each date cell**

When rendering date cells, use:

```typescript
<Droppable droppableId={`date-${dateStr}`} type="TASK">
  {(provided, snapshot) => (
    <div
      ref={provided.innerRef}
      className={`... ${snapshot.isDraggingOver ? 'bg-yellow-200/20' : ''}`}
    >
      {/* tasks for this date */}
    </div>
  )}
</Droppable>
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/tasks/page.tsx
git commit -m "feat: wire up calendar drag-drop with updateTask calls"
```

---

### Task 11: Add undo toast functionality

**Files:**
- Modify: `src/components/notifications/NotificationQueue.tsx`
- Modify: `src/app/(dashboard)/tasks/page.tsx`

**Interfaces:**
- Consumes: `updateTask` action
- Tracks: Previous state for undo within 5s window

- [ ] **Step 1: Add undo state tracking**

In CalendarTab, track last reschedule:

```typescript
const [lastReschedule, setLastReschedule] = useState<{
  taskId: string;
  previousDate: string;
  newDate: string;
  timeoutId: NodeJS.Timeout;
} | null>(null);

const handleDragEnd = async (result: DropResult) => {
  // ... existing code ...

  // Store previous state for undo
  const previousDate = calendarView === 'due-date' ? task.dueDate : task.startDate;
  if (lastReschedule?.timeoutId) {
    clearTimeout(lastReschedule.timeoutId);
  }

  const timeoutId = setTimeout(() => {
    setLastReschedule(null);
  }, 5000);

  setLastReschedule({
    taskId: task.id,
    previousDate: previousDate || '',
    newDate: dateStr,
    timeoutId,
  });
};
```

- [ ] **Step 2: Add undo button to notification**

Modify NotificationQueue to show undo button for rescheduled events:

```typescript
{notification.event.type === 'task:rescheduled' && lastReschedule && (
  <button
    onClick={async () => {
      clearTimeout(lastReschedule.timeoutId);
      const undoData = calendarView === 'due-date'
        ? { dueDate: lastReschedule.previousDate }
        : { startDate: lastReschedule.previousDate };
      await updateTask(lastReschedule.taskId, undoData);
      setLastReschedule(null);
      onDismiss(notification.id);
    }}
    className="ml-2 px-2 py-1 border border-current hover:bg-white/10"
  >
    Undo
  </button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/tasks/page.tsx src/components/notifications/NotificationQueue.tsx
git commit -m "feat: add undo button to reschedule notification (5s window)"
```

---

### Task 12: Add validation (no past dates)

**Files:**
- Modify: `src/app/(dashboard)/tasks/page.tsx:handleDragEnd`

**Interfaces:**
- Validates: Drop date is not in the past

- [ ] **Step 1: Add date validation**

```typescript
const handleDragEnd = async (result: DropResult) => {
  const { draggableId, destination } = result;

  if (!destination) return;

  const task = tasks.find(t => t.id === draggableId);
  if (!task) return;

  const dateStr = destination.droppableId.replace('date-', '');
  const dropDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (dropDate < today) {
    // Emit error notification
    emitNotification({
      type: 'task:overdue',
      taskId: task.id,
      title: 'Cannot reschedule to past',
    });
    return;
  }

  // Continue with reschedule...
};
```

- [ ] **Step 2: Test validation**

- Try dragging to past date → should show error toast and not update

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/tasks/page.tsx
git commit -m "feat: validate calendar drag drops (no past dates)"
```

---

## SUMMARY

**Notifications (Tasks 1-6):**
- ✅ Event types defined
- ✅ useNotifications hook created
- ✅ NotificationQueue component
- ✅ Integrated into root layout
- ✅ Task events emitted
- ✅ Gamification events emitted

**Calendar Drag-Drop (Tasks 7-12):**
- ✅ react-beautiful-dnd dependency added
- ✅ View toggle UI (due date | start date)
- ✅ TaskCard draggable
- ✅ Drop zones wired with API calls
- ✅ Undo toast (5s window)
- ✅ Validation (no past dates)

**Total tasks: 12**

**Testing checklist:**
- [ ] Toast appears on task completion
- [ ] Multiple toasts stack without overlap
- [ ] View toggle switches calendar perspective
- [ ] Drag task to future date updates it
- [ ] Error toast on past date attempt
- [ ] Undo reverts within 5s
- [ ] Sound plays on level-up (if enabled)
- [ ] Build passes: `npm run build`
- [ ] No console errors in browser

