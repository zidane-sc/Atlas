# Import Preview Design

**Date:** 2026-08-03  
**Feature:** Enhanced import with preview + validation before committing data

## Overview

Current import flow skips directly from file selection to data import, offering no chance to review what's being imported or catch validation errors before they're committed to the database. This design adds a preview step that shows data summaries and validation errors, blocking import if errors are found.

## User Flow

1. User clicks "Import Data" in settings
2. File picker opens → user selects JSON export file
3. File parsed and validated
4. **Preview modal appears** showing:
   - Summary counts (tasks, projects, sprints, notes, work sessions, activity logs)
   - Validation report (errors block import, clean data shows ✓)
5. User reviews modal:
   - If errors: Cancel only (import disabled)
   - If clean: Cancel or Import (proceed with current import logic)
6. On confirm: import executes, page reloads

## Modal Design

**Header:**
- Title: "Review Import"
- Close button (X)

**Body:**

### Counts Section
Display counts for each data type in a simple list:
- Tasks: N
- Projects: N
- Sprints: N
- Notes: N
- Work Sessions: N
- Activity Logs: N

### Validation Section
- **If errors exist:** Red section showing each error with context
  - Format: `[Category Index] Item Name: Error message`
  - Example: `[Task 3] "Design homepage": Invalid task status "in_progress_draft". Must be one of: inbox, todo, ready, in_progress, blocked, waiting_external, testing, done`
  - If item name unavailable (e.g., missing title), show: `[Category Index]: Error message`
- **If no errors:** Green checkmark + "No validation issues"

**Footer:**
- Cancel button (secondary)
- Import button (primary, disabled if errors present)

## Data Validation

Validation runs during parse → before modal shows. Errors are collected (not thrown immediately) so all errors display together.

### Error Types to Display
- Invalid enum values (status, type, priority, effort, project/sprint status)
- Invalid date formats
- Missing required fields (if applicable)
- Type mismatches (e.g., bonus.xp is string instead of number)

### Error Collection Strategy
Build validation during JSON parse phase:
1. For each top-level entity (task, project, sprint, note), run validators
2. Collect errors in array: `{ category, message, context }`
3. Pass errors to modal alongside counts
4. Import only if errors array is empty

## Implementation Points

### New Components
- `ImportPreviewModal` component
  - Props: counts, errors, loading, onCancel, onConfirm
  - Display based on error state (empty errors → import enabled)

### Modified Logic in `settings/page.tsx`
- `onImportFile` flow:
  1. Parse JSON
  2. Validate and collect errors
  3. Calculate counts (tasks, projects, sprints, notes, workSessions, activityLogs)
  4. Show modal with counts + errors
  5. Modal's onConfirm → call existing `importWorkspaceData`
  6. Existing success/error handling unchanged

### New Validation Helper
- `validateImportPayload(payload)` → `{ counts, errors }`
- Runs all validators without throwing
- Returns structured error list for UI display

## Data Flow Diagram

```
File Selected
    ↓
JSON Parse
    ↓
Validate & Collect Errors
    ↓
Calculate Counts
    ↓
Show Modal (counts, errors)
    ↓
User Clicks Import
    ↓
importWorkspaceData() [existing]
    ↓
Success → Reload
Error → Toast
```

## No Breaking Changes
- Export format unchanged
- Import payload structure unchanged
- Existing error handling (post-import) preserved
- Backwards compatibility maintained (v1/v2 exports still work)

## Success Criteria
- User can see import summary before committing
- All validation errors visible in one place
- Import blocked if any errors present
- Clean imports proceed as before
- Modal is responsive and scrollable if errors are long
