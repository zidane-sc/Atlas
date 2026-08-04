# Saved Views: Edit (Rename + Update Filters)

## Problem

Saved Views currently support create (`saveFilterAction`) and delete (`deleteFilterAction`) only. Users cannot rename an existing view or update its stored filters — the only way to change a saved view today is to delete it and save a new one under the old name.

## Data Model

No schema change. `SavedFilterClient { id: string; name: string; filters: TaskFilters }` (`src/lib/actions/filters.ts:27-31`) already carries everything an edit needs. `savedFilters` stays a `Json` column on `User` (`prisma/schema.prisma:27`), stored as the full array on every write, same as today's save/delete actions.

## Server Action

Add `updateFilterAction(id: string, name: string, filters: TaskFilters): Promise<ActionResult<SavedFilterClient[]>>` to `src/lib/actions/filters.ts`, following the same load → mutate → write-back shape as `deleteFilterAction` (`filters.ts:92-126`):

1. Auth check (`session?.user?.email`), same as existing actions.
2. Validate `{ name, filters }` with the existing `saveFilterInputSchema` (`filters.ts:22-25`) — no new schema needed.
3. Load `user.savedFilters`, 404 (`NOT_FOUND`) if no entry matches `id`.
4. Name-collision check excluding self: reject (`CONFLICT`) if `currentFilters.some(f => f.id !== id && f.name.toLowerCase() === name.toLowerCase())`.
5. Replace the matching entry in place (preserve original `id`), write the full array back via `db.user.update`, return the updated array — same `ActionResult<SavedFilterClient[]>` contract as `saveFilterAction`/`deleteFilterAction`.

## Provider

`src/components/providers/TasksProvider.tsx`: add `updateFilter: (id: string, name: string, filters: TaskFilters) => Promise<boolean>` alongside `saveFilter`/`deleteFilter` (`TasksProvider.tsx:139-140`, `:711-732`). Same shape: call the action, `setSavedFilters(res.data)` and `notify(..., "success")` on success, `notify(res.error.message, "error")` on failure. Expose it on the context value and type.

## UI — Rename (inline)

In the saved-views dropdown row (`src/components/tasks/TaskFilterBar.tsx:151-172`):

- Add a pencil icon next to the existing delete `X` button on each row.
- Clicking it swaps the name `button` for a text `input`, prefilled with the current name, autofocused.
- `Enter` or blur commits: calls `updateFilter(view.id, trimmedName, view.filters)`. Empty/unchanged name cancels without a call. `Escape` cancels without saving.
- Validation/collision errors surface through the existing `notify()` toast channel — no new error UI.

## UI — Edit Filters (load-then-update)

- `TaskFilterBar` tracks a new `activeSavedViewId: string | null` state.
- Clicking a saved view's name button (`TaskFilterBar.tsx:153-162`) does what it does today (`onChange(normalizeFilters(view.filters))`) plus sets `activeSavedViewId = view.id`.
- Clicking "Clear" (`:290`) or loading a different view resets/reassigns `activeSavedViewId`.
- Compute `isDirty = activeSavedViewId != null && !deepEqual(filters, normalizeFilters(activeView.filters))` where `activeView = savedFilters.find(v => v.id === activeSavedViewId)`. Use a small local deep-equal (e.g. `JSON.stringify` comparison is sufficient given `TaskFilters` is a flat, serializable shape with array/string/enum fields only — no functions, dates, or `undefined` holes to normalize away).
- The existing "💾 Save View" button (`:278-286`) behavior branches on state:
  - No active view (or active view not dirty): unchanged — acts as "Save as new" if there are active filters, hidden otherwise (current behavior, per `activeCount > 0` gate at `:248`).
  - Active view loaded and dirty: button reads "Update View" and calls `updateFilter(activeSavedViewId, activeView.name, filters)` directly (no name prompt — name is unchanged, only filters update). A small secondary "Save as new" affordance stays available next to it, reusing the existing `isSaving`/`saveName` input flow, so users can save the tweaked filters as a separate view instead of overwriting.
- If the active view is loaded and *not* dirty, no Save/Update button shows — same as today's "nothing to save" state.

## Error Handling

No new error surface. All new failure paths (`NOT_FOUND`, `CONFLICT`, `VALIDATION_ERROR`, `INTERNAL`) route through the same `notify(res.error.message, "error")` toast already used by `saveFilter`/`deleteFilter` in `TasksProvider`.

## Testing

Add Vitest coverage for `updateFilterAction` only (existing `saveFilterAction`/`deleteFilterAction` currently have zero test coverage — out of scope to backfill here):

- Renaming a view succeeds and preserves its `id` and `filters`.
- Updating filters succeeds and preserves `id` and `name`.
- Rejects with `CONFLICT` when the new name collides with a *different* existing view.
- Allows saving with the view's own unchanged name (no false-positive self-collision).
- Returns `NOT_FOUND` when `id` doesn't match any saved view.

No component tests planned for the inline-rename/update-button UI — no existing test coverage or harness for `TaskFilterBar.tsx` to extend; manual verification in-browser instead.

## Out of Scope

- Editing a view's filters without first loading it into the active filter bar (rejected in favor of load-then-update).
- Rename via modal/popover (rejected in favor of inline edit).
- Backfilling tests for `saveFilterAction`/`deleteFilterAction`.
- Any change to the `TaskFilters` shape itself.
