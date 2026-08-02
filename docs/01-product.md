# Atlas — Product Document
### Subtitle: *Your Second Brain*

**Type:** Personal, single-user productivity system
**Status:** v0.1 draft
**Owner:** You (sole user, sole PM, sole engineer)

---

## 1. Overview

Atlas is a personal task management system built for one person. It combines powerful, Jira-grade task tracking with a pixel/8-bit visual identity and RPG-inspired gamification, so that managing work across a full-time job (as a squad lead), university, freelance projects, and side projects feels satisfying rather than exhausting.

This document is the single source of truth for what SC is, who it's for, what it does, and — just as importantly — what it deliberately does not do.

---

## 2. Vision & Mission

**Vision**
> Build a delightful personal operating system that makes managing work feel rewarding rather than exhausting.

**Mission**
> Help me manage work across my full-time job, university, freelance projects, and personal projects — while reducing mental overhead through excellent UX and meaningful gamification.

---

## 3. Target User

There is exactly one user: you.

```
Software Engineer — Squad Lead
University Student
Side Project Builder
Occasionally: Freelancer
```

Because there is only one user, every design decision optimizes for *your* workflow specifically — not for generalization, configurability, or onboarding ease.

---

## 4. Core Problems

- Tasks and context are scattered across tools (Jira, notes apps, chat, memory).
- Work handed off to others (QA, code review) disappears from view instead of staying tracked as "waiting."
- Investigation/research work and its findings get lost once the task is closed.
- No feeling of accomplishment after finishing work — task management feels like admin, not progress.
- Hard to tell, at a glance, what's overdue, blocked, or waiting on someone else.
- Hard to recall, days or weeks later, what was actually accomplished.

---

## 5. Product Principles

1. **Fast** — common actions feel instant (target: under ~300ms perceived latency).
2. **Keyboard First** — every important action has a shortcut; a command palette (Ctrl+K) exists.
3. **Offline Friendly** — the app should not block productivity on a bad connection.
4. **Everything Has Context** — a task is never just a title; it carries project, priority, history, attachments, deliverables, and relationships.
5. **Joyful Productivity** — completing work should feel satisfying, not childish.
6. **Reduce Thinking** — the app should answer "what should I do next?" without requiring analysis.
7. **No Bloat** — if a feature doesn't help complete work faster or with more clarity, it doesn't belong.

### Product Rules (the constitution)

- Every feature must reduce mental load.
- Every screen has one primary action.
- Every task must be completable from the keyboard.
- Gamification must encourage productivity, not addiction.
- Every important action produces satisfying feedback.
- Avoid modal dialogs unless absolutely necessary.
- Common actions should never require more than three clicks.
- Data belongs to the user and must be exportable.
- Performance is a feature, not an afterthought.
- Simple beats powerful, unless power actually saves time.

---

## 6. Non-Goals (v1)

Explicitly **out of scope**, to prevent feature creep:

- Team collaboration, sharing, comments-with-others, permissions
- Enterprise features, multi-tenancy, billing
- Public API, marketplace
- AI features (smart breakdown, auto-summaries, daily AI review)
- GitHub / calendar / external automation integrations
- Complex multi-device cloud sync

These may become **v2/v3** ideas (see §14), but are not part of the initial build. If a new idea falls into this list, the default answer is "not yet."

> **Note:** "No team collaboration" refers to other people *using* Atlas — shared editing, permissions, notifications to others. Read-only visibility into your own team's workload (as a squad lead observing, not collaborating) is a different concept and is tracked separately in §14, not ruled out by this list.

---

## 7. Product Pillars

| Pillar | Description |
|---|---|
| **Task Management** | The core — powerful, structured, context-rich tasks |
| **Gamification** | XP, achievements, streaks, room decoration — makes progress feel rewarding |
| **Organization** | Projects, tags, sprints, relationships, full history |
| **Speed** | Every interaction feels instant and frictionless |

**UX Philosophy:** The app should feel like playing an old pixel RPG instead of managing work. Animations are quick, sounds are subtle, nothing interrupts productivity, and every interaction feels responsive.

**Art Direction:** Inspired by Stardew Valley, Pokémon GBA, Terraria, Celeste UI, and old JRPG menus. Explicitly *not* inspired by cyberpunk, glassmorphism, Material Design, or corporate dashboards.

---

## 8. Core Concepts (Domain Overview)

Everything in SC hangs off a single central entity: the **Task**.

```
Task
├── Project           (which area of life/work)
├── Status            (where it is in the workflow)
├── Type               (what kind of work it is)
├── Priority / Effort / Story Point
├── Attachments        (typed links to external artifacts)
├── Deliverables       (typed output produced when done)
├── Relations          (parent/child/blocks/duplicate/etc.)
├── Tags
├── Reporter / Owner
├── Status History Log
├── Comments / Activity Timeline
├── Work Sessions      (focus/timer sessions)
├── Sprint
└── XP Events
```

### 8.1 Projects

Projects group tasks by area of life/work. Suggested initial structure (freely editable):

```
🏢 Full-time         (e.g. ATS, Event, HRIS)
🎓 University         (Thesis, Assignment, Group Project)
💼 Freelance          (Client A, Client B)
🚀 Side Project       (SC itself, other builds)
🏠 Personal
```

### 8.2 Status

A task moves through a defined lifecycle. "Waiting External" is the deliberate answer to *"bolanya di orang lain"* — work that's out of your hands but must not disappear from view.

```
Inbox → Todo → Ready → In Progress → Blocked → Waiting External
     → Testing → Done → Archived
```

| Status | Meaning |
|---|---|
| Inbox | Captured but not yet organized/analyzed |
| Todo | Organized, not yet ready to start |
| Ready | Analyzed, can start immediately |
| In Progress | Actively being worked on |
| Blocked | Can't continue — missing dependency (API, DB, requirement) |
| Waiting External | With someone else (QA, code review, PM, client) |
| Testing | Verifying the fix/feature works |
| Done | Complete |
| Archived | Done and put away |

### 8.3 Task Type

| Type | Icon |
|---|---|
| Coding | 💻 |
| Investigation | 🔍 |
| Study | 📖 |
| Analysis | 📊 |
| Documentation | 📝 |
| Bug | 🐞 |
| Deployment | 🚀 |
| Testing | 🧪 |
| Meeting/Discussion | 👥 |
| Research | 💡 |
| Design | 🎨 |
| Maintenance | ⚙️ |
| Refactor | 📦 |
| Incident | 🔥 |
| Communication | 📞 |

### 8.4 Priority

Impact-based rather than generic High/Medium/Low:

```
P0 — Critical
P1 — High
P2 — Normal
P3 — Low
P4 — Someday
```

### 8.5 Effort vs. Story Point (kept as two separate fields)

- **Effort** (complexity): `XS · S · M · L · XL · XXL`
- **Story Point** (time, 1 SP ≈ 1 hour): `1, 2, 3, 5, 8, 13, 21`

### 8.6 Attachments (typed)

`GitHub PR · GitHub Issue · Confluence · Figma · Slack · Discord · Google Docs · Google Drive · Meeting Recording · Website · File Upload · Other`

### 8.7 Deliverables (typed output)

Not every task ends in a PR — capture what it *actually* produced:
`PR · Confluence Page · Presentation · Meeting Notes · Design · Video · PDF · Research Doc`

**Decision:** Deliverables are always optional — a task can move to Done with no deliverable attached. This avoids blocking quick/simple tasks (e.g. a meeting or a small fix) on a field that doesn't always apply.

### 8.8 Reporter

`Self · QA · Manager · PM · Client · Lecturer · Friend · Other` — enables filters like "all QA-reported bugs."

**Decision:** defaults silently to **Self** on task creation — no prompt, no required selection. You only change it when a task genuinely originated from someone else (e.g. a QA-reported bug).

### 8.9 Owner (replaces "Delegate")

**Decision (revised 2026-08-02):** Auth allow-lists exactly one email (`01-product.md` §3, EPIC-01) — there is only ever one `User` row. That makes both "Watchers" and "reassign Owner to someone else" structurally meaningless: there is no second account to point at. Dropped as a non-goal instead of built:

- **Watchers** — removed from scope entirely. Won't build.
- **Owner** — stays as-is: auto-fills to you on task creation, never reassigned. The "delegated to someone else" case this was meant to cover is fully handled by the **Reporter** field (§8.8, tracks *who it came from*, not a User FK) plus the **Waiting External** status (tracks *who it's currently with*) — no Owner picker needed.

### 8.10 Task Relations

`Parent · Child · Blocks · Blocked By · Related · Duplicate · Caused By · Generated From`

This directly supports your investigation → fix workflow: investigate a bug, then spin off child tasks for the fix, review, and deploy — all linked back to the original.

**Decision:** a task has at most **one Parent** (single-parent hierarchy, matching Jira/Linear conventions), but unlimited **Related/Blocks/Duplicate** links. This keeps the hierarchy simple to visualize while still allowing arbitrary cross-references.

**Status:** Parent/Child hierarchy is modeled as relation types (`parent`/`child`), alongside Blocks/Blocked-By/Related/Duplicate/Caused-By/Generated-From — not as a separate `parentId` column (that field existed in the schema but was dead, never set by any UI, and has been removed). See `05-backlog.md` §6.

### 8.11 Tags & Sprint

Both are select-with-freetext fields: pick an existing option or type a new one, which becomes available going forward.

---

## 9. Functional Requirements

### 9.1 Task Management
- Create/edit/delete/archive/restore/duplicate tasks.
- Full field set as defined in §8 (project, status, type, priority, effort, story point, tags, sprint, dates, attachments, deliverables, reporter, owner/watcher, relations).
- Convert a task into a parent with child tasks; create a related/duplicate/blocking task directly from an existing one.
- Full status-change history log (and ideally a log of any field change: priority, description, tags, assignee, etc.).
- Comment/activity timeline per task.

### 9.2 Views
`Kanban · List · Table · Calendar · Timeline · Today · Waiting (External only) · Focus (high-priority + Ready only) · Project (grouped) · Archive`

### 9.3 Search & Filter
- One universal search box across tasks, projects, tags, attachments.
- Advanced filters combinable with AND/OR (e.g. `Project = ATS AND Priority >= P2 AND Status != Done AND Tag = Backend`).
- Saved filters/views.

### 9.4 Dashboard
On opening the app, surface:
- Today's quest (tasks due/planned today)
- Due today / Overdue / Blocked / Waiting External counts
- Current sprint progress
- Recent wins (XP gained)
- This week: completed vs. estimated vs. actual story points

**Status:** all built and dynamic, real DB data. Dashboard now includes weekly story point comparison (quests completed, SP estimated vs. actual hours, trailing 7 days) surfaced via the existing `calcEstimatedVsActualStoryPoints` calculation — closed EPIC-13 gap 2026-08-02.

### 9.5 Work Sessions (Focus Timer)
- Start/stop a focus session on a task; log actual time spent automatically, feeding statistics (estimated vs. actual).

### 9.6 Gamification
- **XP**: earned per completed task, formula based on Priority + Story Point + bonuses.
- **Achievements**: grouped into four categories — Combat, Exploration, Crafting, Social (e.g. First Blood, 100/500/1000 Quests, Night Owl, Sprint Hero, Bug Hunter, Scholar, Guild Master).
- **Streaks**: represented as a campfire that grows with consecutive productive days.
- **Coins & Room Decoration**: earn coins from completed tasks, spend on cosmetic items for a personal pixel "room/office" (chair, monitor, plants, etc.) rather than only a character avatar.
- **Daily Quest**: one goal auto-selected each day from a rotating pool of quest templates (e.g. "complete 3 quests," "finish a P0," "clear a Blocked quest"), each with its own XP/coin reward, manually claimed once complete.
- **Character Sheet**: an aggregate progression view — global level, a per-Task-Type "skill" level (XP earned from completed tasks of that type), six derived RPG stats (STR/DEX/CON/INT/WIS/CHA) mapped from skill levels, and a "class title" (e.g. Coder, Bug Slayer, Investigator) derived from your highest-leveled skill.
- **Companion**: a small persistent companion whose mood (excited/happy/idle/sad) reflects recent completions and current streak — ambient encouragement, not a separate screen.
- **Weekly/Monthly Recap**: an on-demand cutscene-style summary — quests done vs. the prior period, XP earned, top project, streak, and a letter grade (S–D) based on completion velocity.
- Satisfying, lightweight completion feedback (animation/particles/sound) on marking a task done, and a bigger celebration when all planned tasks for the day are complete.

### 9.7 Statistics
Heatmap of activity, most productive weekday/time, average task duration, completion rate, longest streak, focus hours, estimated vs. actual story points, week-over-week deltas (throughput / created / completed vs. last week).

**Status:** all of the above are built and dynamic, including most-productive weekday/time, average task duration, completion rate, longest-ever streak, focus hours (aggregated from `WorkSession` rows, §9.5), and estimated-vs-actual story points. See `05-backlog.md` §6.

### 9.8 Notifications (built, not originally spec'd)

Not part of the original plan, but shipped alongside the work above: an in-app toast queue with sound (gated on the sound setting), used for CRUD success/error feedback, a 5-second "Undo" on calendar reschedule, and gamification events (level-up, achievement unlocked, streak milestone). Overdue and due-soon task alerting runs once per calendar day, surfacing the single most urgent overdue/due-soon task; a `task:completed` toast also fires on completion. See `05-backlog.md` EPIC-29.

---

## 10. Information Architecture

```
Workspace
├── Dashboard
├── Tasks
│   ├── Kanban
│   ├── List
│   ├── Table
│   ├── Calendar
│   ├── Timeline
│   └── Archive
├── Projects
├── Sprints
├── Character Sheet
├── Achievements
├── Statistics
└── Settings
```

**In-app RPG naming layer** (brand stays clean externally, playful internally):

| Standard term | In-app name |
|---|---|
| Tasks | Quests |
| Dashboard | Command Center |
| Archive | Hall of Records |
| History | Chronicle |
| Achievements | Achievements |
| Statistics | Progress |
| Progression / skill breakdown | Character Sheet |

---

## 11. Key User Flows

**Complete a task**
`Open task → Mark done → XP animation → (if last task of the day) celebration → Dashboard updates`

**Investigate → Fix workflow**
`Create "Investigate X" task → findings logged in comments → mark done → spin off child task(s): "Fix Y", "Review", "Deploy" → all linked to the original`

**Daily loop**
`Open app → Dashboard → Today's tasks → Start Focus on a task → complete it → XP/streak update → next task`

**Capture (Brain Dump/Inbox)**
`Quick-capture a raw thought → lands in Inbox, unsorted → later triaged into a proper task with project/type/priority`

---

## 12. Acceptance Criteria (high level)

- A task can be created with only a title in under 10 seconds; all other fields are optional at creation time.
- Any task can be found via search in under 5 seconds.
- Status changes are always recorded in the history log with a timestamp.
- Marking a task "Done" always triggers XP feedback.
- The dashboard loads and answers "what's due/blocked/waiting today" without further navigation.
- A task can be linked to at least one related task via any of the defined relation types.

---

## 13. Success Metrics

- Used every day, replacing all other personal task tools.
- Capturing a task takes under 10 seconds.
- Finding any task takes under 5 seconds.
- Finishing a task consistently feels rewarding (subjective, but tracked via continued daily use).
- Covers all four areas of work (full-time, university, freelance, personal) without needing a separate tool for any of them.

---

## 14. Future Ideas (Not Committed — Direction Only)

**v2 candidates:**
- ~~**Notes** — free-form notes that can reference a task, or reference other notes (many-to-many linking).~~ → **Built** (built ahead of schedule, outside the phased plan — see `05-backlog.md` EPIC-28). Task-linked notes, attachments, tags, pinning, and note-to-note linking all ship.
- ~~**Knowledge Base** — networked/backlinked notes, second-brain style (Obsidian-like), for durable knowledge rather than task-scoped notes.~~ → **Built** as **Knowledge Map** (see `05-backlog.md` EPIC-30): force-directed graph view over existing `Note`/`NoteLink` data, with Focus Mode, breadcrumb drill-down, search fly-to-focus, tag-filter dimming, and minimap. Design in `docs/superpowers/specs/2026-08-02-knowledge-base-graph-design.md`.
- **Team Load Tracking** — read-only visibility into your team members' task load/capacity, as a squad lead. Observational only — no shared editing, permissions, or notifications to others (see §6 note).
- **Calendar (free-time tracking)** — beyond deadline tracking, surface your own open/available time blocks, not just due dates.
- AI task breakdown, AI daily planning & end-of-day review, brain-dump auto-sorting.
- GitHub integration (PR merged → task done), calendar sync, auto-notes summarization.

**v3 candidates:** Life journal, habit tracker, personal wiki, desktop/terminal widgets.

These stay explicitly *ideas*, not requirements, until a version bump deliberately pulls them in. Note that Notes and Knowledge Base, once built, would attach to the central Task entity the same way Attachments and Deliverables do now (per §8) — no redesign of the core data model should be needed when they land.

---

## 15. Open Questions

**Resolved:**
- ~~Can a task have multiple parents?~~ → No — single Parent, unlimited Related/Blocks/Duplicate links (see §8.10).
- ~~Should Deliverables be required before Done?~~ → No — always optional (see §8.7).
- ~~Should Reporter default silently or require selection?~~ → Defaults silently to Self (see §8.8).

**Deliberately deferred:**
- Exact XP formula and level curve — placeholder in §9.6, to be finalized in `design.md` (doesn't block architecture work).
