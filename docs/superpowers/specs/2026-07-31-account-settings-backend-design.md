# Account & Settings Backend Wire-up

**Date:** 2026-07-31  
**Scope:** Four sequential features to wire frontend account/settings UI to backend persistence  
**Status:** Design approved, ready for implementation planning

---

## Overview

Wire 4 independent account and settings features to database:
1. Account fields (Name, Guild) — editable user profile
2. Settings toggles (Sound, Notifications, Compact View) — missing UI for existing data
3. Pomodoro inputs (Focus/Break minutes) — missing UI for existing data
4. Default View routing — redirect on app load to user's preferred view

All use existing persistence patterns. No schema migrations except adding `guild` field.

---

## Feature 1: Account Fields (Name & Guild)

### Current State
- User model has `name` field (from auth session)
- No `guild` field exists
- Account page shows hardcoded "Aric Stormcloak" and "Squad Lead · Uni · Freelancer"
- No edit UI

### Changes Required
**Schema:** Add `guild` field to User model
```prisma
model User {
  guild    String?  @default("Adventurer")
}
```

**Server action:** New `updateUserProfileAction(name, guild)`
- Validates name (non-empty, max 50 chars)
- Validates guild (max 100 chars)
- Updates User record
- Returns updated `{ name, guild }`

**UI:** Account page edit modal/form
- Read-only display of current name/guild
- "Edit" button opens form with inputs
- Form validates and calls `updateUserProfileAction`
- Shows success/error message
- Updates display on save

### Files to Modify
- `prisma/schema.prisma` — add guild field
- `src/lib/actions/user.ts` — add updateUserProfileAction
- `src/app/(dashboard)/account/page.tsx` — add edit form UI

---

## Feature 2: Settings Toggles (Sound, Notifications, Compact View)

### Current State
- Settings JSON has `soundEnabled`, `notifications`, and potential `compactView` keys
- `SettingsProvider` reads and displays them
- No UI toggles on Settings page to change them

### Changes Required
**UI:** Three toggle switches on Settings page
- Sound Effects toggle (reflects `soundEnabled` value)
- Notifications toggle (reflects `notifications` value)
- Compact View toggle (if missing, create with default false)

**Logic:** Reuse existing `updateUserSettingAction(key, value)`
- Click handler calls action with key and new boolean value
- SettingsProvider updates state optimistically
- Toggles reflect DB value immediately

**Display behavior:**
- Sound Effects affects BattleTimer chimes (existing)
- Notifications affects overdue alerts (existing)
- Compact View affects TaskListView layout (future)

### Files to Modify
- `src/app/(dashboard)/settings/page.tsx` — add toggle UI for all 3
- `prisma/schema.prisma` — ensure `compactView` has default in User.settings

---

## Feature 3: Pomodoro Inputs (Focus/Break Minutes)

### Current State
- Settings JSON has `focusMinutes` (default 25) and `breakMinutes` (default 5)
- `SettingsProvider` exposes these values
- No UI to change them on Settings page
- BattleTimer uses current values

### Changes Required
**UI:** Two number inputs on Settings page
- Focus Duration input (min 1, max 120, default 25)
- Break Duration input (min 1, max 120, default 5)

**Validation:**
- Both must be positive integers
- Both capped at 120 minutes max
- Show validation error if invalid

**Logic:** Reuse `updateUserSettingAction`
- On input blur, validate and call action
- SettingsProvider updates state
- BattleTimer uses new values immediately

**Display:** Inputs show current values from DB, update in real-time as user changes them

### Files to Modify
- `src/app/(dashboard)/settings/page.tsx` — add number inputs with validation
- `src/components/providers/SettingsProvider.tsx` — add validation helpers if needed

---

## Feature 4: Default View Routing

### Current State
- `defaultView` setting exists in schema (dashboard/today/focus/kanban)
- No logic uses it on app load
- Always lands on dashboard regardless of preference

### Changes Required
**Logic:** Check `defaultView` in layout or before redirect
- On app load, read user's `defaultView` from settings
- If user not authenticated, skip (normal flow)
- If authenticated and `defaultView` is set, redirect to that route
- If not set, default to dashboard (current behavior)

**UI:** Dropdown on Settings page
- Options: Dashboard, Today, Focus, Kanban
- Shows current selection
- Calls `updateUserSettingAction("defaultView", value)` on change

**Routes affected:**
- `/` (home) — may redirect based on defaultView
- `/dashboard` — standard route
- `/tasks/today`, `/tasks/focus`, `/tasks/kanban` — available alternatives

### Files to Modify
- `src/app/(dashboard)/settings/page.tsx` — add defaultView dropdown
- `src/app/(dashboard)/layout.tsx` — add routing logic to check defaultView

---

## Integration Points

### Existing Patterns Reused
- User model and `updateUserStats` action (similar new action for profile)
- SettingsProvider and `updateUserSettingAction` (already working)
- Form validation in existing components
- Optimistic UI updates in SettingsProvider

### Schema Changes
- Add `guild?: String` to User model (optional, max 100 chars)
- Add `compactView` to default settings if missing (default false)
- Ensure `defaultView` default is "dashboard"

### No Breaking Changes
- All new fields optional or have sensible defaults
- Existing flows unaffected
- Settings page UI enhancements only

---

## Database Impact

**Schema migration needed:**
- Add `guild` column to `users` table (optional string, default null)

**Data:**
- `name` already exists, will be populated from auth
- `guild` will start null, user can set
- Settings JSON fields already exist with defaults

---

## Testing Strategy

1. **Account fields:**
   - Edit name, verify persists and displays
   - Edit guild, verify persists and displays
   - Validation: empty name rejected, too-long inputs rejected

2. **Settings toggles:**
   - Toggle each setting, verify DB persists
   - Refresh page, verify toggles show persisted values
   - Verify side effects work (sound plays, notifications trigger, etc.)

3. **Pomodoro inputs:**
   - Change focus/break minutes, verify persists
   - Invalid input rejected (validation)
   - BattleTimer uses new values on next session

4. **Default view:**
   - Set default view, logout/login
   - Verify app redirects to chosen view
   - Test all 4 view options

---

## Assumptions & Constraints

- Single user app (no multi-user concurrency)
- `defaultView` only applies to authenticated users
- Guild field is cosmetic, no impact on features
- Pomodoro values must be positive integers (1-120)
- All features use existing auth session (no new login flow)

---

## Success Criteria

- [ ] Name and Guild editable on account page, persisted to DB
- [ ] Sound, Notifications, Compact View toggles appear on settings page
- [ ] Focus/Break minute inputs appear on settings page with validation
- [ ] Default View dropdown routes user on app load
- [ ] All changes persist across sessions
- [ ] Settings UI reflects DB values immediately
- [ ] No validation errors when values invalid
- [ ] Tests pass for all 4 features
