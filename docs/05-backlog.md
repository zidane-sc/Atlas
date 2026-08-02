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
| EPIC-10 | Task Relations | v0.2 | Done — Parent/Child/Blocked-By added as relation types 2026-08-02 (no separate `parentId` column, see §6). Single-Parent requirement dropped 2026-08-02 — `parent` is now unlimited like Related/Blocks/Duplicate (`01-product.md` §8.10) |
| EPIC-11 | Search & Filters | v0.2 | Done — search now covers projects/attachments; filters got comparators, a Tag facet, and a global AND/OR toggle 2026-08-02 (see §6) |
| EPIC-12 | Views II — Table, Calendar | v0.2 | Done |
| EPIC-13 | Comments, Activity Log & Dashboard v1 | v0.2 | Done (gap: Dashboard is missing "this week: completed vs. estimated vs. actual story points" from §9.4 — see §6) |
| EPIC-14 | XP & Leveling | v0.3 | Done (derived calculations, sidebar XP bar). **Critical bug found & fixed 2026-08-02** (see §7): task-completion XP was being double-counted — fixed, `bonusXp` reset to 0 |
| EPIC-15 | Achievements | v0.3 | Done — "Perfect Week" now a real 7-day-streak check, 500/1000 Quests tiers added 2026-08-02 (see §6) |
| EPIC-16 | Streaks | v0.3 | Done (current streak + longest-ever streak, both dynamically calculated from task completion dates) |
| EPIC-17 | Coins & Room Decoration | v0.3 | Done (Coins persisted in DB, Room Decoration built as JRPG panel and fully persisted) |
| EPIC-18 | Sound & Motion Settings | v0.3 | Done (Default View "Kanban" 404 fixed 2026-08-02 — see §6) |
| EPIC-19 | Views III — Timeline, Today, Waiting, Focus, Project, Archive | v0.4 | Done (smart views fully built & routed in UI; "Archive" tab is intentionally the completed-quests chronicle, not a trash view — see §6) |
| EPIC-20 | Work Sessions (Focus Timer) | v0.4 | Done (Focus Timer work sessions logged and persisted in database, and now aggregated into Statistics — see §6) |
| EPIC-21 | Statistics | v0.4 | Done — all §9.7 metrics now built 2026-08-02: productive weekday/time, avg task duration, completion rate, longest streak, focus hours, est-vs-actual story points (see §6). Week-over-week "created" delta gap found in §7 audit, fixed same day — real `prevCreated` query added |
| EPIC-22 | Saved Filters | v0.4 | Done (saved view custom filters added to DB, filter bar updated with saved views select/save UI) |
| EPIC-23 | Data Export | v0.4 | Done — round-trips WorkSession + ActivityLog 2026-08-02; also fixed a bigger bug where Import Data never actually wrote to the DB at all (see §6) |
| EPIC-24 | Polish & Full Test Coverage | v1.0 | Done (linter verified with 0 problems, 100% of unit tests passing, full production build verified) |
| EPIC-25 | Character Sheet (skill levels, stats, class title) | v0.3 | Done (character page fully functional & dynamic) |
| EPIC-26 | Companion (ambient mood widget) | v0.3 | Done (ambient sidebar widget built & mood-reactive) |
| EPIC-27 | Weekly/Monthly Recap Cutscene | v0.3 | Done (recap grade formula, trigger, and stats calculations are fully dynamic without mock dependencies) |
| EPIC-28 | Notes (task-linked notes, attachments, tags, pinning, note-to-note linking) | v2 idea, built ahead of schedule | Done. Not previously tracked as an epic; pulled out of the icebox in `01-product.md` §14 because it already shipped. |
| EPIC-29 | In-App Notifications (toast queue + sound + undo) | not in original scope | Done — `task:overdue`/`task:due-soon` now checked once/day and `task:completed` emitted on completion 2026-08-02 (see §6). Undocumented until this review; see `01-product.md` §9.8. |
| EPIC-30 | Knowledge Map (networked/backlinked notes graph) | v2 idea, built ahead of schedule | Done — force-directed graph over `Note`/`NoteLink`, Focus Mode + breadcrumb, search fly-to-focus, tag-filter dimming, minimap. Design: `docs/superpowers/specs/2026-08-02-knowledge-base-graph-design.md`. See `01-product.md` §14. (§7 audit initially flagged minimap as missing — false negative from a keyword grep that missed the unlabeled `KnowledgeMap.tsx:367-405` implementation; corrected same day.) |

**All epics EPIC-01–30 done — v0.1 through v1.0 fully shipped.** Only the Icebox (§5) remains open.

---

## 3. v0.1 — Detailed Backlog (shipped — kept as the story-format reference)

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

## 4. v0.2–v1.0 — Scope Summary

Shipped straight from this phase-level scope to epic-level tracking (Epic Index above) — the planned per-story breakdown for v0.2+ (each with its own ATLAS-### like §3) never happened; day-to-day tracking and gaps instead live in the Review Findings (§6). Scope per phase, traceable back to where each was specified:

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

- ~~**Dashboard is missing the story-point comparison from §9.4**~~ → **Fixed 2026-08-02**: "this week: completed vs. estimated vs. actual story points" now rendered on Statistics page PRODUCTIVITY panel. Calls `calcEstimatedVsActualStoryPoints` on `doneThisWeek` filter (trailing 7 days). (EPIC-13).
- ~~"Kanban" as Default View 404s~~ → **Fixed 2026-08-02**: Kanban is the default tab shown at `/tasks` itself, not a route of its own (`src/app/(dashboard)/tasks/page.tsx` defaults its tab state to `"kanban"`). `DefaultViewRedirect` (`src/components/layout/DefaultViewRedirect.tsx`) now special-cases `defaultView === "kanban"` to push `/tasks` instead of the nonexistent `/tasks/kanban` (EPIC-18).

---

## 7. Feature Status Audit (2026-08-02, fresh pass)

A second, skeptical code-tracing pass — not relying on the "Done" labels above, checking actual server actions/UI wiring per feature. Every epic (built or icebox) listed, including the ones with no code at all.

| Feature | Status | Missing implementation | Why |
|---|---|---|---|
| EPIC-01 Auth & Foundation | ✅ Done | — | — |
| EPIC-02 Task Core (CRUD, soft delete/restore/trash) | ✅ Done | — | — |
| EPIC-03 Projects (basic) | ✅ Done | — | — |
| EPIC-04 Views I — Kanban, List | ✅ Done | — | — |
| EPIC-05 Status History & Completion Feedback | ✅ Done | — | — |
| EPIC-06 Command Palette & Quick Capture | ✅ Done | — | — |
| EPIC-07 Extended Task Fields | ✅ Done | — | — |
| EPIC-08 Tags | ✅ Done | — | — |
| EPIC-09 Sprints | ✅ Done | — | — |
| EPIC-10 Task Relations | ✅ Done | — | Flagged as a gap earlier same day, but resolved as a requirement change, not a bug: single-Parent was dropped 2026-08-02, `parent` is now unlimited like Related/Blocks/Duplicate (`01-product.md` §8.10) |
| EPIC-11 Search & Filters | ✅ Done | — | — |
| EPIC-12 Views II — Table, Calendar | ✅ Done | — | — |
| EPIC-13 Comments, Activity Log & Dashboard v1 | ✅ Done | — | — |
| EPIC-14 XP & Leveling | ⚠️ Critical bug, fixed same day | task-completion XP was double-counted — `actions/tasks.ts` added `xpEarned` into `user.bonusXp` on every status→done transition, while `computeCharacterSheet` (`gamification.ts:131-138`) *also* independently sums XP from every done task, then adds `bonusXp` on top | `bonusXp` was only meant for rewards with no backing task (Daily Quest claims, per the doc comment at `gamification.ts:122-123`) — the task-completion path was never supposed to write there at all. Fixed by removing the write entirely; XP for done tasks stays purely derived-live, as originally intended. Considered switching to a stored/incremental XP ledger instead — rejected: at single-user task-history scale, live recompute is cheap, and a stored ledger just generalizes the same dual-bookkeeping bug (every mutation path — delete/restore/un-complete/edit-after-done — would need to keep the ledger in sync forever). Account's already-inflated `bonusXp` (60) reset to 0 in DB same day. |
| EPIC-15 Achievements | ✅ Done | — | — |
| EPIC-16 Streaks | ✅ Done | — | — |
| EPIC-17 Coins & Room Decoration | ✅ Done | — | — |
| EPIC-18 Sound & Motion Settings | ✅ Done | — | — |
| EPIC-19 Views III | ✅ Done | — | — |
| EPIC-20 Work Sessions (Focus Timer) | ✅ Done | — | — |
| EPIC-21 Statistics | ✅ Done | — | Week-over-week "created" delta was fabricated (`Math.max(weekly.created - 1, 0)`); fixed 2026-08-02 — `buildRecap()` now computes a real `prevCreated` count over `[prevFrom, from)`, same pattern as the existing `donePrev` query |
| EPIC-22 Saved Filters | ✅ Done | — | — |
| EPIC-23 Data Export/Import | ✅ Done | — | — |
| EPIC-24 Polish & Full Test Coverage | ✅ Done | — | — |
| EPIC-25 Character Sheet | ✅ Done | — | — |
| EPIC-26 Companion | ✅ Done | — | — |
| EPIC-27 Weekly/Monthly Recap Cutscene | ✅ Done | — | — |
| EPIC-28 Notes | ✅ Done | — | — |
| EPIC-29 In-App Notifications | ✅ Done | — | — |
| EPIC-30 Knowledge Map | ✅ Done | — | Corrected same day: minimap does exist (`KnowledgeMap.tsx:367-405`, click-to-pan + viewport rect) — initial "missing" finding was a false negative from a keyword grep that missed the unlabeled implementation |
| Icebox — Team Load Tracking | ❌ Not built | everything | Brainstormed 2026-08-02 — no data source decided (squad members aren't Atlas `User` rows), deferred; tracked manually in Notes instead |
| Icebox — Calendar free-time tracking | ❌ Not built | everything | Brainstormed 2026-08-02 — no "busy time" definition decided, deferred |
| Icebox — AI task breakdown/planning | ❌ Not built | everything | Explicit non-goal (`01-product.md` §6), zero AI-related code in repo |
| Icebox — GitHub integration (PR merged → done) | ❌ Not built | everything | Explicit non-goal (§6); "github" only exists as OAuth provider name + attachment-type enum value, no automation |
| Icebox — Calendar sync (external) | ❌ Not built | everything | Explicit non-goal (§6), zero code |

**Open gaps: none** from the epic-level audit. A deeper edge-case pass the same day found further real bugs beyond epic-completeness — see §8.

---

## 8. Deeper Edge-Case Audit (2026-08-02)

The §7 audit checked "is each epic genuinely built." This pass goes further: hunting for bugs that survive even when a feature is fully built — wrong behavior under unusual input/state, not missing functionality. Five parallel passes across Task/Relations, Gamification math, Statistics/Dashboard calc, Notes/Export-Import, and UI/UX polish.

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | Task-completion XP double-counted (`actions/tasks.ts` wrote to `bonusXp` on every done transition, on top of `computeCharacterSheet`'s independent live sum) | Critical | **Fixed** — see EPIC-14 above |
| 2 | Statistics page crashes with zero projects — `StatisticsContent.tsx:100-105`, `.reduce()` on an empty `completedByProject` array returns `undefined`, then `.project` throws | High | **Fixed** — guarded the reduce (`completedByProject.length > 0`), `RecapData.topProject` is now `\| null`, `RecapCutscene` renders a neutral "No projects yet" fallback card instead of crashing |
| 3 | Data Export/Import silently destroys all Note↔Task links, every import — `import.ts:110-116` wipes `Task`, cascades `NoteTaskLink`, never recreates it (Notes aren't in the export payload at all) | High | **Fixed** — `importWorkspaceData` now snapshots `NoteTaskLink` rows for surviving task ids before the wipe, and restores them after tasks are recreated, in the same transaction. Notes/NoteTaskLink still deliberately excluded from the payload itself (not a backup gap being introduced) — this only stops the wipe from collaterally destroying links that already existed |
| 4 | Notes autosave fails silently — `NoteEditor.tsx:52-116` has no error path on save failure; user has no indication a save didn't happen | High | **Fixed** — both `handleAutoSave` and `handleSave` now call `notify(result.error?.message ?? ..., "error")` on failure, matching the pattern already used elsewhere (e.g. `CharacterContent.tsx`) |
| 5 | Task Relations: no server-side self-relation guard (`schemas/task.ts:56`, client-only filter), no cycle detection, dangling stale relation refs when target is soft-deleted | Medium | **Fixed (partial)** — `updateTask` now rejects any relation whose `taskId` equals the task's own id (`VALIDATION_ERROR`). Cycle detection intentionally skipped: single-parent isn't a real invariant anymore (see EPIC-10), so a parent/child cycle is a semantic oddity, not a crash risk (no recursive tree renderer exists). Dangling refs now surfaced instead of prevented: `TaskFormSheet` checks each relation's `taskId` against `allTimeTasks` and renders `(trashed)` in muted italic when the target no longer exists, instead of silently showing a stale cached title forever |
| 6 | Race condition in task-code generation (`task-code.ts:5`, unlocked `SELECT ... ORDER BY`) — concurrent creates can collide, second one fails with an opaque `"Failed to create task."` (P2002 not special-cased) | Medium | **Fixed** — `createTask` now retries up to 3 times on a `P2002` code collision, recomputing the next code number fresh each attempt, before giving up. Self-heals the race instead of losing the create |
| 7 | ActivityHeatmap (local calendar day via `formatLocalDate`) vs Weekly Throughput chart (UTC day via `toISOString()`/`getUTCDay()`) disagree on which day/weekday a task lands in near local midnight, for any non-UTC timezone | Medium | **Fixed** — `buildWeeklyThroughput` now anchors on `parseLocalDate(nowStr)` and buckets/labels with local `Date` methods (`getDay()`) instead of UTC ones, matching `ActivityHeatmap`'s existing local-day bucketing |
| 8 | Trash list/restore failures rendered as empty state, not an error — `tasks/page.tsx:656-677` | Medium | **Fixed** — both the trash-list load and restore now call `notify(result.error?.message ?? ..., "error")` on failure instead of silently rendering an empty/unchanged list |
| 9 | Knowledge Map node tooltip hardcoded to "Double-click to open" instead of the full title — `KnowledgeMap.tsx:346` vs the 20-char-truncated label at `:360`; truncated titles have no way to be recovered without opening the note | Medium | **Fixed** — tooltip is now `` `${node.title} — double-click to open` `` |
| 10 | No `startDate ≤ dueDate` validation (`schemas/task.ts:95-96,126-127`) | Low | **Fixed** — both `createTaskSchema` and `updateTaskSchema` now `.refine()` that `startDate <= dueDate` when both are present in the same request (string comparison is safe for `YYYY-MM-DD`). Known gap: a partial update that changes only one date against an already-set other date on the existing row isn't checked — input-shape validation only, no access to the row being patched |
| 11 | `getLevelInfo` could return negative `currentXP` on negative XP input — not currently reachable (`storyPoint`/`bonusXp` are both validated non-negative), flagged only because #1 showed the bonus ledger isn't as isolated as assumed | Low | **Fixed** — `getLevelInfo` now clamps its input with `Math.max(0, xp)` before computing |
| 12 | Same silent-failure pattern in smaller spots: `TaskNoteLinks.tsx:26-33`, `Sidebar.tsx:90-98` (pinned notes fetch) | Low | **Fixed** — both now call `notify(..., "error")` on failure |
| 13 | Command Palette has no direct "mark task done" quick action — gap relative to the "every task completable from keyboard" claim (§5), though not a dead end (Kanban/task sheet are still keyboard-reachable) | Low | **Fixed** — searching a task now surfaces a "Mark Done: `<title>`" item right after its "open" item, calling `updateTask` directly with `status: "done"` via a new `taskToFormValues` helper (rebuilds the full field set from the existing task so only `status` changes). Only shown once the user searches, matching the existing project/sprint-item convention — doesn't clutter the default browsing list |
| 14 | Knowledge Map `stepSimulation` is O(n²) per animation frame with no cap — janks on a large, mostly-disconnected note graph | Low | **Fixed (mitigated)** — added a hard `MAX_SIMULATION_TICKS` (600, ~10s at 60fps) cap alongside the existing kinetic-energy stop condition, so a graph that never settles can't run the O(n²) tick forever. Doesn't fix the O(n²) complexity itself (would need a bigger physics rewrite — Barnes-Hut or similar spatial partitioning); bounds the damage instead |
| 16 | Every full dashboard navigation eagerly fetched nested `statusHistory`(20)+`comments`(10) for all 200 interactive tasks, even though only one task's edit sheet is ever open at a time — real cost on every page load regardless of which view was open | Medium (perf, proactively raised, not from the original audit pass) | **Fixed** — added a real `Task.createdAt` scalar field (client type + `mapDbTaskToClient`), replacing the `statusHistory[0]` proxy `createdAt()` used exclusively before. Bulk fetches (`layout.tsx`, `tasks-load-more.ts`) now select zero nested relations; a new `getTaskDetails(taskId)` action fetches full history+comments on-demand when `TaskFormSheet` opens an existing task. Necessary prerequisite found along the way: Data Export read `task.statusHistory`/`.comments` straight off the now-trimmed client `tasks` state, which would've silently produced incomplete backups — fixed with a new `getTasksForExport()` action that queries fresh, complete data straight from the DB at export time (same one-time-cost pattern `getWorkspaceHistoryForExport` already used for WorkSession/ActivityLog), instead of depending on client memory |
| 15 | Gamification/Statistics silently excluded historical data beyond the 200-task fetch cap — `layout.tsx:43` caps the interactive task fetch at 200 most-recently-created (any status); Character Sheet XP/level/skills, achievements, longest-ever streak, completion rate, avg task duration, focus hours, and activity heatmap all derived from that same capped list, so once total task count passed 200, older completions would silently stop counting | Medium (was 0 impact today at only 16 total tasks, but a real correctness ceiling for long-term use) | **Fixed** — added a second, unbounded `status: "done"` query in `layout.tsx` (minimal fields, no `take` limit) exposed as `allTimeTasks` via `TasksProvider`/`useTasks()` (union of the capped `tasks` + the done tasks outside that window, deduped by id). All lifetime metrics above now read `allTimeTasks` instead of `tasks`. Current streak, this-week/month recap, trailing throughput, and all interactive views correctly kept on the existing capped `tasks` — those are naturally recent-window already. Considered also fetching an unbounded all-status list for `calcCompletionRate`/`calcFocusHours` (which technically want a full all-status total, not just done) — skipped: would require tracking huge numbers of stale *active* (non-done) tasks past the window, unrealistic for a personal single-user backlog; documented as an accepted edge case rather than built. |
| 17 | Statistics and Achievements pages computed all derived data (completion rate, achievements, streaks, etc.) client-side from a bulk task array, instead of server-side | Architecture improvement (user-raised, not from the audit) | **Fixed** — both pages are now `async` Server Components (`app/(dashboard)/statistics/page.tsx`, `.../achievements/page.tsx`) that fetch fresh unbounded data and call the same unchanged pure functions in `gamification.ts`/`statistics.ts` server-side, passing one plain computed object down as a prop. `StatisticsContent`/`AchievementsContent` are now pure rendering components with no data-fetching. Character Sheet (XP/level/coins) deliberately stays client-computed — see `docs/superpowers/specs/2026-08-02-server-computed-stats-achievements-design.md` §2 for why, and the "Phase 2" note there for what's still open |
| 18 | Character Sheet (XP/level/coins) and the level-up/achievement-unlock live-feedback mechanism were still client-computed from `allTimeTasks` after Phase 1 (deliberately deferred, see finding #17) | Architecture improvement (Phase 2, user-raised) | **Fixed** — new `getCharacterSheetData(ownerId)` helper (mirrors the Phase 1 pattern) computes the character sheet + achievement unlock state server-side, called once per page load (`layout.tsx`) and again inline from `updateTask`/`createTask`/`claimDailyQuestAction` after their DB write. `TasksProvider` adopts the server's returned value directly instead of scanning `allTimeTasks` before/after a mutation — closes the double-bookkeeping bug class (finding #1) at the architecture level, not just the one instance. The per-task "+XP" toast and current-streak-milestone detection are untouched — both were already correct, per-task/recent-window-only calculations with no dependency on full history. `allTimeTasks` stays in `TasksProvider`, narrowed to its one remaining consumer (`TaskFormSheet`'s relation-trashed check). See `docs/superpowers/specs/2026-08-03-server-computed-character-sheet-design.md` |

~~Also noticed in passing: Data Export only ever exported the capped 200-task `tasks` list~~ → **Fixed alongside finding #16**: Export now calls the dedicated `getTasksForExport()` action instead of using client state.

Achievement hour-window comments (`gamification.ts:298-303`) claim UTC but check local time — flagged during the pass, but ruled out as a real bug: no timezone is specified in the design doc, so local-time behavior is arguably correct for a personal "night owl" badge; only the code comment is misleading, not the behavior. (Relations parent-limit turned out to be a requirement change, not a bug — see EPIC-10 above. Statistics "created" delta fixed 2026-08-02 — real `prevCreated` query added to `buildRecap()`. Knowledge Map minimap was never actually missing — the original finding was a false negative from a keyword-only grep; the feature was already shipped, corrected same day.)
