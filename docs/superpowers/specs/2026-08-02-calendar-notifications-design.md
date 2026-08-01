# Calendar Drag-Drop + Notifications Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-reschedule for calendar tasks and implement a notifications system for task + gamification events.

**Architecture:** Separate, independent implementations. Notifications via event-driven queue system. Calendar drag-drop via react-beautiful-dnd with dual-view toggle (due date vs. start date).

**Tech Stack:** React, react-beautiful-dnd, existing updateTask action, localStorage (optional history), Web Audio API (optional sound).

## Global Constraints

- No breaking changes to existing calendar view
- Notifications stack max 5 concurrent toasts (older auto-dismiss)
- Drag validation: no past dates, validated on drop
- Sound toggle in existing settings UI
- Must maintain retro pixel art aesthetic
- Mobile: Drag-drop works via touch (react-beautiful-dnd supports this)

---

## FEATURE 1: NOTIFICATIONS SYSTEM

### Architecture

**Components:**
- `NotificationQueue`: Manager component, renders active toast list
- `useNotifications()`: Hook to emit events from anywhere
- Event emitter pattern: Simple event bus for cross-component communication

**Event Types:**

Task Events:
- `task:overdue` — Task past due date, status ≠ "done"
- `task:due-soon` — Task due within 24h
- `task:completed` — Task status changed to "done"
- `task:rescheduled` — Due/start date changed (via drag or form)

Gamification Events:
- `gamification:level-up` — User reached new level
- `gamification:achievement-unlocked` — New achievement earned
- `gamification:streak-milestone` — Streak reached 7/14/30 days

**Storage:** In-memory queue (NotificationQueue state). Optional: Recent notifications cached to localStorage for quick history recall (not required for MVP).

**Sound:** Toggle in User.settings (already exists). Plays on: level-up, achievement-unlock, streak-milestone. File: `/public/sounds/notification.mp3` (retro beep, <1KB). Use Web Audio API or HTML5 audio element.

### UI/UX

**Toast Component:**
- Position: Top-right corner
- Auto-dismiss: 5 seconds
- Dismissable: Manual close button
- Stack: Multiple toasts stack vertically, no overlap
- Icons: Event-specific emoji (⚠️ overdue, 🔥 streak, ⭐ achievement, 📈 level-up)
- Text: "{Icon} {Event message}" e.g., "⚠️ Quest overdue: Fix auth bug"
- Dark mode: Consistent with existing toast styling

**History (Optional, Phase 2):** Bell icon in header opens sidebar with recent 10 notifications. Not required for MVP.

### Data Flow

```
1. Server action completes (createTask, updateTask, completeTask, levelUp, etc.)
2. Client receives success response
3. Component/Provider calls: notificationEmitter.emit('task:completed', {taskId, title})
4. NotificationQueue listener catches event
5. Toast added to queue state
6. React renders toast with auto-dismiss timer
7. Sound plays (if setting enabled)
8. After 5s or manual dismiss, remove from queue
```

### Error Handling

- Silent fail if sound file missing (don't break notification on audio error)
- Graceful degrade if Web Audio API unavailable (use HTML5 <audio> fallback)
- Notification still shows even if sound fails

---

## FEATURE 2: CALENDAR DRAG-DROP

### Architecture

**Component Changes:**
- `CalendarTab.tsx`: Add view-toggle button (Due Date | Start Date)
- Calendar grid: Wrap with `<DragDropContext>` and `<Droppable>` zones
- Task cards: Make `<Draggable>` with grab cursor on hover

**Library:** react-beautiful-dnd (already established pattern in Kanban)

**Interaction Model:**

View Toggle:
- Button near calendar header: "View by: [Due Date] [Start Date]"
- Clicking switches calendar to re-render tasks by selected field
- Persisted to User.settings.defaultCalendarView (optional, Phase 2)

Drag Interaction:
- User drags task card from one date cell to another
- Drop zone highlights on drag-over (subtle background color change)
- On drop: Call updateTask(taskId, { dueDate: newDate }) or updateTask(taskId, { startDate: newDate })
- Toast confirms: "✓ Rescheduled to Aug 15"
- Undo button in toast (revert API call within 5s window)

**Constraints & Validation:**
- Cannot drag to past dates — show error toast "Cannot reschedule to past"
- If both dueDate and startDate exist, dueDate must be >= startDate (show warning if violated)
- Multi-task drag: Not in MVP (Phase 2). Single task only for initial release.

### Data Changes

**updateTask call:**
- If dragging in "Due Date view" → `{ dueDate: newDate }`
- If dragging in "Start Date view" → `{ startDate: newDate }`
- API already handles partial updates (PATCH semantics), no schema changes needed

**No new DB columns/migrations required.**

### UI/UX

**Visual Feedback:**
- Grab cursor on task hover (CSS: `cursor: grab`)
- Dragging: Opacity 50%, ghost follows cursor
- Drop zone: Light highlight on drag-over (background color shift)
- Post-drop toast: "✓ Rescheduled to Aug 15" with undo button

**Mobile Support:**
- react-beautiful-dnd has native touch support
- On mobile, long-press to start drag (handled by library)
- Same visual feedback applies

**Accessibility:**
- Keyboard drag not in MVP (add in Phase 2)
- Drag-drop semantics: ARIA-disabled for screen readers initially (acceptable for Phase 1)

### Error Handling

- Network error on updateTask: Show error toast, revert UI to original position
- Validation error (past date, constraint violation): Show error toast, no API call
- Concurrent drag conflict: Lock UI during flight, prevent double-submit

---

## FILES TO CREATE/MODIFY

**Create:**
- `/src/components/notifications/NotificationQueue.tsx` — Manager component
- `/src/hooks/useNotifications.ts` — Hook for emitting events
- `/src/lib/notification-events.ts` — Event type definitions
- `/public/sounds/notification.mp3` — Retro beep sound (optional)

**Modify:**
- `/src/app/(dashboard)/tasks/page.tsx` — CalendarTab: add view toggle, integrate drag-drop
- `/src/components/tasks/TaskCard.tsx` — Add Draggable wrapper
- `/src/components/providers/TasksProvider.tsx` — Emit notifications on task/gamification events
- `/src/lib/gamification.ts` — Emit notifications on level-up, achievement, streak milestone
- `/src/app/layout.tsx` — Add NotificationQueue to root layout
- `/prisma/schema.prisma` — Optional: Add User.defaultCalendarView (Phase 2)

---

## TESTING

**Notifications:**
- Toast appears on task completion
- Multiple notifications stack without overlap
- Auto-dismiss after 5s
- Manual close works
- Sound plays (if enabled in settings)
- No notifications on failed API calls

**Calendar Drag-Drop:**
- View toggle switches between due date and start date perspectives
- Drag task to future date updates task
- Error toast on past date attempt
- Undo reverts changes within 5s
- Concurrent drags handled gracefully
- Mobile: Long-press drag works (if testing on device)

---

## PHASE 2 (Future)

- Notification history sidebar (bell icon)
- Keyboard accessible drag (arrow keys)
- Multi-task drag
- Persist calendar view preference (defaultCalendarView)
- Bulk drag-reschedule
- Notification sound customization
- Notification grouping (e.g., "3 tasks overdue")

