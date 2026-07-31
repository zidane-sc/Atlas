# Drawer Search Fields Default Results

**Date:** 2026-07-31

## Problem

The quest form drawer (`TaskFormSheet.tsx`) has three search fields — Project, Sprint, and the relations "Search quest" (task). All three only render their dropdown after the user types. When empty, no options are shown, forcing the user to guess/type before seeing available values.

## Goal

When a search field is focused and the query is empty, show a default list of up to 5 options so the user can pick without typing. Typing filters the full list as before.

## Scope

Single file: `src/components/tasks/TaskFormSheet.tsx`. No data model, server, or dependency changes.

## Behavior

### Shared trigger change
Each field gains an `isFocused` state. The dropdown renders when focused AND (`query` is non-empty OR showing the default list). On blur it hides (dropdown hidden when not focused). Selecting an item clears the query and hides the list (existing behavior).

### Project field (lines 393-425)
- **Empty query (default):** sort `projects` by status rank (active=0, on_hold=1, completed=2), then name ascending; show first 5.
- **With query:** existing substring filter on name, unchanged.

### Sprint field (lines 435-465)
- **Empty query (default):** sort `sprints` by status rank (active=0, planning=1, completed=2), then start date ascending; show first 5.
- **With query:** existing substring filter on name, unchanged.

### Task / relations "Search quest" field (lines 543-565)
- **Empty query (default):** sort `otherTasks` incomplete-first (status !== "done"), then title ascending; show first 5 (existing `.slice(0, 5)` kept).
- **With query:** existing substring filter on title, unchanged.

## Edge cases
- Dropdown hidden on blur via `isFocused` state.
- Default list only applies when query is empty; typing immediately switches to filtered results.
- No "no results" empty state is added (out of scope; not present today).

## Testing
Manual: focus each field → 5 options shown; type → filtered; clear → defaults restored; blur → hidden.
