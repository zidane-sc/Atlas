# Atlas — Backlog & Roadmap

**Companion to:** `01-product.md`, `02-architecture.md`, `03-design.md`, `04-development.md`
**This is a living document** — updated every sprint. New ideas go in the Icebox (§5), not into the current phase, per the Non-Goals discipline in `01-product.md` §6.

---

## 1. How This Document Works

```
Epic → Story → (Subtask, ad hoc, only if a story genuinely needs splitting)
```

Every story carries: **ID · Title · Epic · Story Points · Priority · Dependencies · Status**. Larger/ambiguous stories also get a short **User Story** + **Acceptance Criteria** — small, obvious ones don't need the ceremony.

**Status values:** `Backlog → Ready → In Progress → Done` (matches the app's own task statuses — fitting, given what you're building).

**ID convention:** `ATLAS-###`, assigned in build order, never reused.

---

## 2. Phased Roadmap

Rather than the original "notes/journal first" brainstorm, this reflects what you actually decided in `01-product.md`: **task management, gamification, and UX ship together from day one** — nothing here waits for a "gamification phase."

| Phase | Focus | Epics |
|---|---|---|
| **v0.1 — Core Loop** | Smallest usable, already-satisfying version | EPIC-01 to 06 |
| **v0.2 — Organize & Find** | Full task field set, relations, search | EPIC-07 to 13 |
| **v0.3 — Full Gamification** | XP, levels, achievements, streaks, coins, character sheet, companion, recap | EPIC-14 to 18, 25 to 27 |
| **v0.4 — Power Views & Time** | Remaining views, focus timer, stats, export | EPIC-19 to 23 |
| **v1.0 — Polish** | Full test coverage, consistent theming, keyboard coverage | EPIC-24 |

### Epic Index

| Epic | Name | Phase | Status |
|---|---|---|---|
| EPIC-01 | Auth & Foundation | v0.1 | Done |
| EPIC-02 | Task Core (CRUD, core fields) | v0.1 | Done (restore/un-delete + Trash view added 2026-08-02 — see §6) |
| EPIC-03 | Projects (basic) | v0.1 | Done |
| EPIC-04 | Views I — Kanban, List | v0.1 | Done |
| EPIC-05 | Status History & Basic Completion Feedback | v0.1 | Done |
| EPIC-06 | Command Palette & Quick Capture | v0.1 | Done |
| EPIC-07 | Extended Task Fields (Effort, Attachments, Deliverables, Reporter, Owner) | v0.2 | Done — Owner intentionally never reassigned (see `01-product.md` §8.9, revised 2026-08-02) |
| EPIC-08 | Tags | v0.2 | Done |
| EPIC-09 | Sprints | v0.2 | Done (database-wired, Server Actions CRUD) |
| EPIC-10 | Task Relations | v0.2 | Done — Parent/Child/Blocked-By added as relation types 2026-08-02 (no separate `parentId` column, see §6) |
| EPIC-11 | Search & Filters | v0.2 | Done — search now covers projects/attachments; filters got comparators, a Tag facet, and a global AND/OR toggle 2026-08-02 (see §6) |
| EPIC-12 | Views II — Table, Calendar | v0.2 | Done |
| EPIC-13 | Comments, Activity Log & Dashboard v1 | v0.2 | Done (gap: Dashboard is missing "this week: completed vs. estimated vs. actual story points" from §9.4 — see §6) |
| EPIC-14 | XP & Leveling | v0.3 | Done (derived calculations, sidebar XP bar) |
| EPIC-15 | Achievements | v0.3 | Done — "Perfect Week" now a real 7-day-streak check, 500/1000 Quests tiers added 2026-08-02 (see §6) |
| EPIC-16 | Streaks | v0.3 | Done (current streak + longest-ever streak, both dynamically calculated from task completion dates) |
| EPIC-17 | Coins & Room Decoration | v0.3 | Done (Coins persisted in DB, Room Decoration built as JRPG panel and fully persisted) |
| EPIC-18 | Sound & Motion Settings | v0.3 | Done (Default View "Kanban" 404 fixed 2026-08-02 — see §6) |
| EPIC-19 | Views III — Timeline, Today, Waiting, Focus, Project, Archive | v0.4 | Done (smart views fully built & routed in UI; "Archive" tab is intentionally the completed-quests chronicle, not a trash view — see §6) |
| EPIC-20 | Work Sessions (Focus Timer) | v0.4 | Done (Focus Timer work sessions logged and persisted in database, and now aggregated into Statistics — see §6) |
| EPIC-21 | Statistics | v0.4 | Done — all §9.7 metrics now built 2026-08-02: productive weekday/time, avg task duration, completion rate, longest streak, focus hours, est-vs-actual story points (see §6) |
| EPIC-22 | Saved Filters | v0.4 | Done (saved view custom filters added to DB, filter bar updated with saved views select/save UI) |
| EPIC-23 | Data Export | v0.4 | Done — round-trips WorkSession + ActivityLog 2026-08-02; also fixed a bigger bug where Import Data never actually wrote to the DB at all (see §6) |
| EPIC-24 | Polish & Full Test Coverage | v1.0 | Done (linter verified with 0 problems, 100% of unit tests passing, full production build verified) |
| EPIC-25 | Character Sheet (skill levels, stats, class title) | v0.3 | Done (character page fully functional & dynamic) |
| EPIC-26 | Companion (ambient mood widget) | v0.3 | Done (ambient sidebar widget built & mood-reactive) |
| EPIC-27 | Weekly/Monthly Recap Cutscene | v0.3 | Done (recap grade formula, trigger, and stats calculations are fully dynamic without mock dependencies) |
| EPIC-28 | Notes (task-linked notes, attachments, tags, pinning, note-to-note linking) | v2 idea, built ahead of schedule | Done. Not previously tracked as an epic; pulled out of the icebox in `01-product.md` §14 because it already shipped. |
| EPIC-29 | In-App Notifications (toast queue + sound + undo) | not in original scope | Done — `task:overdue`/`task:due-soon` now checked once/day and `task:completed` emitted on completion 2026-08-02 (see §6). Undocumented until this review; see `01-product.md` §9.8. |
| EPIC-30 | Knowledge Map (networked/backlinked notes graph) | v2 idea, built ahead of schedule | Done — force-directed graph over `Note`/`NoteLink`, Focus Mode + breadcrumb, search fly-to-focus, tag-filter dimming, minimap. Design: `docs/superpowers/specs/2026-08-02-knowledge-base-graph-design.md`. See `01-product.md` §14. |


---

## 3. v0.1 — Detailed Backlog (build this first)

Two stories below are written out in full as a template; the rest follow the same shape, just condensed to the table.

### Example — full format

**ATLAS-005 — Create Task Server Action**
- **Epic:** EPIC-02
- **User Story:** As the sole user, I want to create a task with at least a title so I can capture work in under 10 seconds, per the success metric in `01-product.md` §13.
- **Acceptance Criteria:**
  - Title is the only required field; all others (project, status, etc.) default sensibly (status → `inbox`, reporter → `self`, per `02-architecture.md` §4.4/§4.8).
  - Returns the uniform `ActionResult` shape from `04-development.md` §3.
  - Invalid input returns `VALIDATION_ERROR` and writes nothing.
- **Story Points:** 3 · **Priority:** P0 · **Dependencies:** ATLAS-004 · **Status:** Backlog

**ATLAS-010 — Kanban View**
- **Epic:** EPIC-04
- **User Story:** As the sole user, I want to see and drag tasks between status columns so status changes feel immediate and physical.
- **Acceptance Criteria:**
  - Columns match the status list in `01-product.md` §8.2.
  - Dragging a card calls `updateTaskStatus` and writes a `task_status_logs` row (`04-development.md` §3).
  - Card style follows the dialogue-box pattern in `03-design.md` §5, not a generic flat card.
- **Story Points:** 8 · **Priority:** P0 · **Dependencies:** ATLAS-006 · **Status:** Backlog

### Full v0.1 list

| ID | Title | Epic | SP | Priority | Dependencies | Status |
|---|---|---|---|---|---|---|
| ATLAS-001 | Next.js + Tailwind + shadcn/ui project setup, pixel theme tokens | EPIC-01 | 3 | P0 | — | Done |
| ATLAS-002 | Auth.js config, single allow-listed email | EPIC-01 | 3 | P0 | ATLAS-001 | Done |
| ATLAS-003 | Prisma + Neon setup, `users` migration | EPIC-01 | 2 | P0 | ATLAS-001 | Done |
| ATLAS-004 | `tasks` table + Prisma schema (core fields) | EPIC-02 | 3 | P0 | ATLAS-003 | Done |
| ATLAS-005 | `createTask` Server Action + Zod schema | EPIC-02 | 3 | P0 | ATLAS-004 | Done |
| ATLAS-006 | `updateTask` / soft-delete `deleteTask` actions | EPIC-02 | 3 | P0 | ATLAS-005 | Done |
| ATLAS-007 | Task creation form (slide-over panel) | EPIC-02 | 5 | P0 | ATLAS-005 | Done |
| ATLAS-008 | `projects` table + CRUD actions | EPIC-03 | 3 | P0 | ATLAS-003 | Done |
| ATLAS-009 | Project picker in task form | EPIC-03 | 2 | P0 | ATLAS-007, ATLAS-008 | Done |
| ATLAS-010 | Kanban view (drag-and-drop status change) | EPIC-04 | 8 | P0 | ATLAS-006 | Done |
| ATLAS-011 | List view | EPIC-04 | 3 | P1 | ATLAS-006 | Done |
| ATLAS-012 | `task_status_logs` write-on-status-change | EPIC-05 | 2 | P0 | ATLAS-006 | Done |
| ATLAS-013 | Task-complete animation + basic XP number | EPIC-05 | 3 | P1 | ATLAS-010 | Done |
| ATLAS-014 | Command palette shell + "create task" quick action | EPIC-06 | 5 | P1 | ATLAS-007 | Done |

**v0.1 total: ~46 story points** (≈ 46 hours at the 1 SP ≈ 1 hour convention from `04-development.md` §6 — a realistic first slice for evenings/weekends, not a "2–3 week sprint" fantasy).

---

## 4. v0.2–v1.0 — Scope Summary (not yet broken into stories)

Detailed story breakdowns for these get written when v0.1 is actually done — writing them now would go stale before you get there. Scope per phase, traceable back to where each was specified:

- **v0.2:** Effort/Attachments/Deliverables/Reporter/Owner fields (`01-product.md` §8.6–8.9), Tags & Sprints (§8.11), Task Relations (§8.10), Search & Filters (§9.3), Table & Calendar views (§9.2), Comments/Activity Log (§9.1), Dashboard v1 (§9.4).
- **v0.3:** XP & Leveling, Achievements (now grouped into 4 categories — `01-product.md` §9.6), Streaks, Coins & Room Decoration, Sound/Motion settings, Character Sheet (skill/stat/class-title derivation), Companion (mood widget), Weekly/Monthly Recap cutscene (grade formula) — all formulas already defined in `03-design.md` §11, just need implementing.
- **v0.4:** Remaining views (Timeline, Today, Waiting, Focus, Project, Archive — `01-product.md` §9.2), Work Sessions (§9.5), Statistics (§9.7), Saved Filters, Data Export (`02-architecture.md` §8).
- **v1.0:** Full test suite per `04-development.md` §5, consistent theming pass, full keyboard-shortcut coverage.

---

## 5. Icebox (future ideas — not scheduled)

Straight from `01-product.md` §14 — kept here too so new ideas land in one obvious place instead of interrupting whatever phase is active:

**v2 candidates:** ~~Notes (task/note-linked)~~ — built, see EPIC-28. ~~Knowledge Base~~ — built, see EPIC-30. Team Load Tracking (read-only), Calendar free-time tracking, AI task breakdown/planning, GitHub integration, calendar sync.

**v3 candidates:** Life journal, habit tracker, personal wiki, desktop/terminal widgets.

New idea mid-build? It goes here, not into the current phase — that discipline is what keeps `01-product.md`'s vision stable.

---

## 6. Review Findings (found 2026-08-02, fixed same day unless noted)

A code review found every epic above genuinely wired to real DB data (no mock/hardcoded UI) — but "Done" at the epic level had hidden a batch of smaller unfinished pieces. All were fixed in the same pass except where marked otherwise:

- **Task restore / trash** — `deleteTask` only soft-deleted (`deletedAt`) with no way back. Added `restoreTask` + `listDeletedTasks` server actions and a "Trash" section in the Archive tab with per-task Restore (EPIC-02).
- **"Archive" tab naming** — investigated as a possible bug ("shows completed tasks, not a trash view") but this is correct as built: it's the "Hall of Records" chronicle of completed quests per `01-product.md` §10's IA table, a different concept from trash. Trash was added as its own section instead of repurposing Archive (EPIC-19).
- ~~Owner is not reassignable~~ / ~~Watchers don't exist~~ → **Resolved as non-goals, not bugs**: only one `User` row can ever exist (single allow-listed email, EPIC-01), so neither "reassign Owner" nor "Watchers" has anyone to point at. See `01-product.md` §8.9.
- **Parent/Child hierarchy** — `Task.parentId` was dead schema/action plumbing (accepted by Zod, self-parent-guarded, but never set by any UI). Removed the dead column entirely and added `parent`/`child`/`blocked_by` as relation types instead, so hierarchy works through the existing flat Relations system rather than a second, parallel mechanism (EPIC-10).
- **Search coverage** — was task-title/tag only. Now also matches project name and attachment label/URL, per `01-product.md` §9.3 (EPIC-11).
- **Filter expressiveness** — was AND-of-OR-per-facet only. Added a Status "is/is not" toggle, a Priority "any/≥/≤" comparator, a dedicated Tag facet, and a global AND/OR combine toggle across all active facets, per the `Project = ATS AND Priority >= P2 AND Status != Done AND Tag = Backend` example in §9.3 (EPIC-11).
- **Achievement "Perfect Week"** — was hardcoded to return `null` progress (no "Perfect Day" concept existed). Now real: 7 consecutive days with a quest completed, reusing the new `calculateLongestStreak` helper. Also added the missing 500/1000 Quests tiers alongside the existing 100 (EPIC-15).
- **Longest-ever streak** — only the current consecutive-day streak existed. Added `calculateLongestStreak`, used by both Perfect Week and the new Statistics panel (EPIC-16, EPIC-21).
- **Statistics §9.7 gaps** — most-productive weekday/time, average task duration, completion rate, longest streak, focus hours, and estimated-vs-actual story points were all missing (only heatmap + week-over-week deltas existed). All six added as a "Productivity" panel, reading real `timeSpentSeconds`/`completedAt`/`storyPoint` data (EPIC-21).
- **Data Export/Import — found a bigger bug than scoped**: the Import Data button never called the `importWorkspaceData` server action at all — it only swapped client-side React state, so an imported backup silently vanished on the next page reload with no data actually written to the DB. Fixed by wiring the button to the real action (which now also restores `WorkSession`/`ActivityLog` rows) followed by a full reload; removed the now-dead client-only `loadTasks`/`loadProjects`/`loadSprints` provider methods that this bug depended on (EPIC-23).
- **Notifications: overdue/due-soon/completed** — `task:overdue`/`task:due-soon`/`task:completed` event types existed but nothing ever emitted them. Added a once-per-calendar-day proactive check (via `checkAndEmitDueDateNotifications`) that surfaces the single most urgent overdue/due-soon task, plus a real `task:completed` emit on status → done (EPIC-29).
- **Notes note-to-note linking** — the one piece of the original Notes idea not built alongside the rest. Added a `NoteLink` model (undirected, canonical-ordered pair) plus `linkNotesAction`/`unlinkNotesAction` and a "Linked Notes" picker in the note editor (EPIC-28).

**Found in a follow-up pass (2026-08-02):**

- ~~**Dashboard is missing the story-point comparison from §9.4**~~ → **Fixed 2026-08-02**: "this week: completed vs. estimated vs. actual story points" now rendered on Dashboard as new "THIS WEEK" panel after Active Sprint. Calls `calcEstimatedVsActualStoryPoints` on `doneThisWeek` filter (trailing 7 days). (EPIC-13).
- ~~"Kanban" as Default View 404s~~ → **Fixed 2026-08-02**: Kanban is the default tab shown at `/tasks` itself, not a route of its own (`src/app/(dashboard)/tasks/page.tsx` defaults its tab state to `"kanban"`). `DefaultViewRedirect` (`src/components/layout/DefaultViewRedirect.tsx`) now special-cases `defaultView === "kanban"` to push `/tasks` instead of the nonexistent `/tasks/kanban` (EPIC-18).
