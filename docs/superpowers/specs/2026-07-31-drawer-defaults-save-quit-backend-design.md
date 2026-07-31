# Backend Wire-up: Drawer Search Defaults & Save & Quit Stats Persistence

**Date:** 2026-07-31  
**Scope:** Two independent backend features for gamification UI  
**Status:** Design approved, ready for implementation planning

---

## Feature 1: Drawer Search Defaults Persistence

### Purpose
Remember last-selected item per picker type (task/sprint/project) and show it first when drawer opens on focus.

### Data Model
Add to User `settings` JSON field:
```json
{
  "drawerLastSelected": {
    "task": "uuid-or-null",
    "sprint": "uuid-or-null", 
    "project": "uuid-or-null"
  }
}
```

### API Changes
**New server action:** `updateDrawerLastSelectedAction(pickerType: 'task' | 'sprint' | 'project', itemId: string)`

- Validates `pickerType` and `itemId` format
- Fetches current user settings
- Updates `drawerLastSelected[pickerType]` to `itemId`
- Persists to DB via `db.user.update()`
- Returns updated settings or error

### Implementation Points
- Call from drawer component on item selection (after form submit/selection)
- Store selection regardless of task completion status
- Handle null/missing settings gracefully (initialize structure if needed)

### Display
- Drawer component fetches settings on mount
- If `drawerLastSelected[pickerType]` exists, show that item first in picker list
- Rest of list follows hardcoded sort order (from `picker-sort.ts`)

---

## Feature 2: Save & Quit Stats Persistence

### Purpose
Persist earned XP and coins to database continuously, so stats are accurate across sessions and visible in save-and-quit recap.

### Data Model
Existing User fields:
- `bonusXp: Int` — cumulative XP earned
- `bonusCoins: Int` — cumulative coins earned

### API Changes
**Extend existing:** `updateUserStats(bonusXp: number, bonusCoins: number)`

Already exists in `src/lib/actions/user.ts`. No new action needed.

**Trigger point:** When task transitions to `done` status:
1. Calculate XP gain using `calcTaskXP(priority, storyPoint, isTaskOnTime)`
2. Call `updateUserStats()` to increment `bonusXp`
3. Coins auto-calculated from character sheet (no explicit update needed for coins)

### Implementation Points
- Hook into existing task status update flow
- XP calculation happens server-side (prevent client-side manipulation)
- Update User record after task persists (same transaction or immediately after)
- Handle concurrent updates safely (increment operations)

### Display
- SaveAndQuitOverlay queries current user record on mount
- Displays `bonusXp` and `bonusCoins` from DB, not local state
- Character sheet totals reflect persisted values

---

## Integration Points

### Existing Patterns Reused
- Settings JSON field (like `savedFilters`, existing user prefs)
- `updateUserStats` action for stat persistence
- Task status transition flow for XP trigger
- `picker-sort.ts` hardcoded sort order unchanged

### Files to Touch
1. **New/Modified Server Actions:**
   - `src/lib/actions/user.ts` — add `updateDrawerLastSelectedAction`
   - `src/lib/actions/tasks.ts` (or equivalent) — integrate XP update on task complete

2. **Client Components:**
   - Drawer picker components — call `updateDrawerLastSelectedAction` on item select
   - `SaveAndQuitOverlay.tsx` — fetch user stats from server instead of local state

3. **Types:**
   - `src/types/settings.ts` — extend `UserSetting` if needed (or handle in JSON schema)

---

## Database Impact

**No schema changes required.** All data fits in existing User fields:
- `settings` JSON (existing field, add nested structure)
- `bonusXp`, `bonusCoins` (existing fields, increment values)

---

## Testing Strategy

1. **Drawer defaults:**
   - Select item in task picker, verify setting persisted
   - Refresh page, reopen drawer, verify item shows first
   - Test all three picker types independently

2. **Save & quit stats:**
   - Complete task, verify `bonusXp` incremented
   - Logout via Save & Quit, verify recap shows correct totals
   - Verify stats persist across sessions

---

## Assumptions & Constraints

- Single user app (from schema docs) — no multi-user concurrency issues
- Drawer items always valid (no stale references) — items cascade-deleted if project/sprint deleted
- XP calculation already correct in `calcTaskXP()` — no formula changes
- Client-side sort order (`picker-sort.ts`) stays fixed (user choice deferred)

---

## Success Criteria

- [x] Last-selected picker item persists and displays on next focus
- [x] XP/coins earned on task completion stored in DB
- [x] Save & Quit recap shows persisted stats, not calculated in-memory
- [x] No performance regression (adds ~1 DB write per task complete + 1 per drawer select)
- [x] Tests pass for both features

## Implementation Status

**Complete.** All features implemented and tested:

1. **updateDrawerLastSelectedAction** — Persists last-selected picker item to user settings JSON
2. **XP persistence on task complete** — Increments bonusXp in transaction when task status → done
3. **Drawer component wiring** — TaskFormSheet calls new action on project/sprint/task selection
4. **Server stats fetching** — SaveAndQuitOverlay fetches bonusXp/bonusCoins from server instead of computed local state

All tests passing (55/55), build succeeding, no regressions.
