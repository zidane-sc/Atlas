# Atlas — Development Guidelines

**Companion to:** `01-product.md`, `02-architecture.md`, `03-design.md`
**Covers:** Naming conventions, git/commit standards, Server Action & validation patterns, error handling, testing strategy, and story point convention.

*(Continuing the numbered sequence — assuming this one next, before the backlog.)*

---

## 1. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Component files | PascalCase.tsx | `TaskCard.tsx` |
| Utility/action files | kebab-case.ts | `task-actions.ts` |
| React components | PascalCase | `TaskCard`, `XpBar` |
| Functions & variables | camelCase | `createTask`, `isOverdue` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_STORY_POINT` |
| Prisma model fields (TypeScript side) | camelCase | `dueDate`, `storyPoint` |
| Database columns (Postgres side) | snake_case, via Prisma `@map` | `due_date`, `story_point` |
| Database tables | snake_case, plural, via `@@map` | `tasks`, `task_relations` |

This resolves the naming gap between the two layers: `02-architecture.md` documents the *database* in snake_case (that's what's actually in Postgres), while the Prisma schema and application code stay idiomatic camelCase — `@map`/`@@map` bridges the two, so nobody hand-writes snake_case in TypeScript.

---

## 2. Git Conventions

**Commits** — Conventional Commits format:

```
<type>(<scope>): <short description>

feat(tasks): add single-parent constraint on task creation
fix(xp): correct on-time multiplier rounding
docs(design): update XP formula after playtesting
refactor(relations): simplify blocked-by query
test(xp): add unit tests for level curve
chore(deps): bump prisma to latest
```

Types: `feat, fix, docs, refactor, test, style, perf, chore`.

**Branches** — `type/short-description`, e.g. `feature/task-relations`, `fix/xp-rounding`.

Solo project, so no PR-approval ceremony is needed — but keeping commits scoped and typed still pays off the first time you need `git log --grep="feat(xp)"` six months from now.

---

## 3. Server Action Conventions

One file per domain in `lib/actions/` (per `02-architecture.md` §5): `tasks.ts`, `projects.ts`, `relations.ts`, `xp.ts`, `achievements.ts`.

**Naming pattern:** `verbNoun` — `createTask`, `updateTaskStatus`, `addTaskRelation`, `startWorkSession`.

**Uniform return shape** — every action returns a discriminated union, never throws to the client:

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ErrorCode; message: string } };
```

```typescript
type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"        // e.g., assigning a second parent to a task
  | "UNAUTHORIZED"
  | "INTERNAL";
```

This keeps error handling in the UI uniform: check `result.success`, show a toast with `result.error.message` on failure, no try/catch scattered through components.

**Mutation side-effects are explicit, not hidden:** any action that changes `status` writes a `task_status_logs` row in the same transaction; any action that changes another tracked field writes an `activity_logs` row; completing a task writes an `xp_logs` row and runs the (cheap, synchronous) achievement check from `03-design.md` §11.7. Bundling these in one Prisma transaction avoids partial-state bugs (e.g., XP awarded but no log row written).

---

## 4. Validation

- **Zod** schemas, one per entity, colocated in `lib/schemas/` (e.g. `task.ts`, `relation.ts`).
- Every Server Action parses its input through the matching schema before touching Prisma — invalid input returns `VALIDATION_ERROR`, never reaches the database.
- Schemas are the single place enum values (status, type, priority, effort, reporter, relation type) are defined, then inferred into TypeScript types — so the enum lives in exactly one place, not duplicated between Zod and Prisma.

---

## 5. Testing Strategy

Scaled for a one-person project — the goal is confidence in the decisions that matter, not a coverage percentage.

**Testing pyramid, applied to Atlas:**

```
        /   E2E   \      A handful of daily-critical flows only
       / Integration \    Server Actions against a real test DB
      /  Unit Tests   \   Pure business logic — many, fast
```

| Layer | Tool | What it covers |
|---|---|---|
| Unit | Vitest | XP formula, level curve, coin formula, on-time multiplier, streak-milestone logic, single-parent validation |
| Integration | Vitest + a test Postgres (or Neon branch, per `02-architecture.md` §10) | Server Actions end-to-end: `createTask` writes the row *and* the initial status log; `completeTask` writes `xp_logs` *and* checks achievements in the same transaction |
| E2E | Playwright, small suite | Create task → appears on Today view · Mark Done → XP toast appears · Drag Kanban card → status persists on reload |

**Explicitly worth testing** (business-critical, tied directly to decisions already made in `01`–`03`):
- XP/level/coin formulas (§11 of `03-design.md`) — easy to get subtly wrong, hard to notice without a test
- Status transitions always produce a log row
- A task cannot be given a second parent (the §8.10 decision)
- Deliverables remain optional — completing a task with zero deliverables must succeed
- Reporter silently defaults to `self` when not set

**Explicitly skipped:** shadcn/ui primitive rendering, trivial CRUD getters, full visual regression testing, framework internals. Not a good use of solo-dev time for a one-user app.

No fixed coverage-percentage target — the bar is "every decision logged in `01-product.md`, `02-architecture.md`, and `03-design.md` has at least one test guarding it."

---

## 6. Story Point Convention (recap)

Restated here since it's a convention developers (well — you) need to apply consistently, not just a product concept:

- Allowed values: `1, 2, 3, 5, 8, 13, 21`.
- 1 SP ≈ 1 hour of focused work.
- Estimate at task creation; `work_sessions` (§4.12 of `02-architecture.md`) capture actual time, so estimate-vs-actual becomes a real statistic over time, not a guess.

---

## 7. Code Style

- TypeScript strict mode on; no `any` (use `unknown` + narrowing if a type is genuinely not known yet).
- Server Components by default; `"use client"` only on components that need interactivity (forms, drag-and-drop, animations).
- Prettier + ESLint, default Next.js config — not worth customizing further for a solo project.
- Complex business logic (the XP formula, relation-constraint checks) gets a short JSDoc comment linking back to the source section, e.g. `// see 03-design.md §11.1` — cheap breadcrumb back to *why* a number is what it is.

---

## 8. Definition of Done (for building Atlas itself)

A nice parallel to the app's own "Done" status — a feature isn't Done until:

- [ ] Server Action(s) return the uniform `ActionResult` shape
- [ ] Input validated via the matching Zod schema
- [ ] Relevant log rows (`task_status_logs` / `activity_logs`) are written where applicable
- [ ] Unit test exists for any new business logic
- [ ] Manually checked against the relevant Product Rule in `01-product.md` §5

---

## 9. Decisions Log

No open questions remain — testing tools (Vitest + Playwright), naming conventions, and the Server Action return shape are all settled above.
