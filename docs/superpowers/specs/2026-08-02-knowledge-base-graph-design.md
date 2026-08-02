# Knowledge Base — Note Graph View Design

**Date:** 2026-08-02
**Status:** Design Approved
**Purpose:** Deliver the "Knowledge Base" v2 candidate from `docs/01-product.md` §14 ("networked/backlinked notes, second-brain style") as a Graph view layered on top of the existing Notes system, rather than a new entity.

---

## 1. Overview

Atlas already ships task-scoped Notes with title/content/tags/pinning, task-linking, manual note-to-note linking (`NoteLink`), and a markdown editor with live preview. What's missing to make it feel like a genuine knowledge base is a way to *see* the network of connections at a glance, not just navigate it one link at a time.

This design adds a **Graph view** to the existing `/notes` page: a visual node graph of all notes and their `NoteLink` connections, hand-rolled with a small force-directed layout (no new dependency), styled to match Atlas's pixel/JRPG aesthetic.

**Explicitly not part of this pass:**
- No new entity, schema change, or nav item — reuses `Note`/`NoteLink` as-is and lives inside `/notes`.
- No drag-to-create-links on the graph — linking still happens through the existing note editor's link picker. The graph is a visualization, not an editor.
- No task nodes in the graph — notes only, to keep the knowledge graph distinct from task-scoped context.
- No saved layout persistence — the simulation recomputes each time the Graph view is opened, which is cheap at personal-notes scale.

---

## 2. Data Model & Server Action

No Prisma schema changes. New read-only server action:

```ts
// src/lib/actions/notes.ts
export async function getNoteGraphAction(): Promise<ActionResult<{
  nodes: { id: string; title: string; pinned: boolean }[];
  edges: { source: string; target: string }[];
}>>
```

- Auth-checked like every other action in this file (session → `db.user.findUnique`).
- `nodes`: `db.note.findMany({ where: { userId }, select: { id, title, pinned } })` — every note the user owns, including ones with zero links (isolated nodes are shown, not filtered out).
- `edges`: `db.noteLink.findMany({ where: { noteA: { userId } }, select: { noteAId, noteBId } })` mapped to `{ source: noteAId, target: noteBId }`.
- No pagination — single-user personal note volumes (tens to low hundreds) don't need it. If this ever becomes a real problem, that's a future concern, not a v1 one.

---

## 3. Force Simulation (pure, testable)

New file `src/lib/note-graph.ts`, framework-agnostic:

```ts
export interface GraphNode { id: string; x: number; y: number; vx: number; vy: number; pinned: boolean }
export interface GraphEdge { source: string; target: string }

export function stepSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  bounds: { width: number; height: number }
): GraphNode[]
```

One physics tick, given current positions/velocities, returns updated positions/velocities:

1. **Repulsion** — every node pair pushes apart, force inversely proportional to distance (capped at a max force to avoid explosive velocities when two nodes start at the same point).
2. **Spring attraction** — for each edge, pull the pair toward a target distance (~120px), proportional to the distance error.
3. **Center gravity** — a weak constant pull toward `(width/2, height/2)` so the graph doesn't drift off-canvas over time.
4. **Damping** — velocities multiplied by a decay factor (~0.85) each tick so the system settles instead of oscillating forever.

This function has no DOM/React dependency, so it's unit-testable the same way `calculateStreak`/`applyTaskFilters` are: deterministic single-step assertions (two linked nodes move closer together; two unconnected nodes that start close move apart).

---

## 4. Rendering — `NoteGraph.tsx`

New `src/components/notes/NoteGraph.tsx`, client component:

- On mount: call `getNoteGraphAction()`, seed each node at a random position within the SVG viewport, `vx`/`vy` = 0.
- Run `stepSimulation` on a `requestAnimationFrame` loop. Positions are held in a `ref` (not React state) — each frame, update node `<circle>`/`<line>` positions imperatively via direct DOM attribute writes (`element.setAttribute("cx", ...)`), skipping React reconciliation entirely. This keeps per-frame cost proportional to node count, not to a full component re-render.
- Stop condition: track total kinetic energy (sum of `vx²+vy²` across nodes) each tick; once it drops below a small threshold, cancel the animation frame. Typically settles in ~2-3 seconds. Saves CPU/battery instead of animating indefinitely.
- **Nodes:** small diamond/square glyphs consistent with the existing `STATUS_SHAPE` glyph style elsewhere in the app. Gold border (`--color-primary-gold`) if `pinned`, muted border (`--color-border`) otherwise. Truncated title label beside/below each node.
- **Edges:** thin lines (`--color-border`) between connected nodes.
- **Isolated nodes** (no edges): still rendered, positioned wherever repulsion + center gravity settle them — typically the periphery. This is deliberate: it's an honest picture of what's connected vs. not, and a visual nudge to go link them.
- **Pan:** drag on empty background translates a wrapping `<g transform="translate(...) scale(...)">`.
- **Zoom:** scroll wheel adjusts the same `<g>`'s scale, clamped to a sane range (e.g. 0.3×–3×).
- **Click a node:** navigate via the existing `/notes?edit=<id>` query-param pattern already used by `src/app/(dashboard)/notes/page.tsx`'s edit flow — no new navigation mechanism.
- **Tag filter:** the Graph view receives the same `selectedTags` state the List view already uses (lifted in the parent `notes/page.tsx`). Nodes whose note doesn't match the active tag filter are dimmed (reduced opacity), not removed from the layout — keeps the whole graph's shape stable while filtering, rather than reflowing the simulation on every filter change.

---

## 5. UI Integration

`src/app/(dashboard)/notes/page.tsx`:

- Add a small "List / Graph" toggle next to the existing search input — same pattern as the Tasks page's List/Table toggle (`src/app/(dashboard)/tasks/page.tsx`).
- `viewMode` state (`"list" | "graph"`), default `"list"` (no behavior change for existing users until they opt in).
- When `viewMode === "graph"`, render `<NoteGraph notes={notes} selectedTags={selectedTags} onSelectNote={handleSelectNote} />` in place of `<NoteList>`. Reuses the same `notes`/`selectedTags`/`handleSelectNote` already in scope — the Graph view doesn't fetch its own note list, only its own edge data via `getNoteGraphAction()`.

---

## 6. Error Handling

- `getNoteGraphAction()` failure (unauthenticated, DB error): render the existing inline-error pattern used elsewhere in the Notes page (a centered message, no crash).
- Zero notes: empty-state message, same tone as the existing "No notes yet" state in `NoteList`.
- Notes with zero edges: not an error case — they render as isolated nodes (§4).

---

## 7. Testing Strategy

- **Unit tests** (`src/lib/note-graph.test.ts`, vitest, matching this project's existing convention of testing pure `lib/` functions rather than server actions or React components):
  - Two nodes connected by an edge, started far apart → after one `stepSimulation` tick, distance between them decreases.
  - Two unconnected nodes started close together → after one tick, distance between them increases (repulsion wins with no counteracting spring).
  - A single isolated node with no edges, started off-center → after one tick, moves measurably toward center (gravity term alone).
  - Velocities shrink tick-over-tick with no forces applied (damping in isolation) — confirms the system can settle rather than oscillate forever.
- `getNoteGraphAction` itself is not unit tested, consistent with the rest of `src/lib/actions/*.ts` in this codebase (no test coverage on server actions currently — only pure `lib/` helpers are tested).
- No component/UI tests for `NoteGraph.tsx` itself — matches this project's existing test coverage shape (pure-logic unit tests only, no React Testing Library setup present).

---

## 8. File Structure

**New files:**
- `src/lib/note-graph.ts` — `stepSimulation` and supporting types
- `src/lib/note-graph.test.ts` — unit tests
- `src/components/notes/NoteGraph.tsx` — rendering + interaction

**Modified files:**
- `src/lib/actions/notes.ts` — add `getNoteGraphAction`
- `src/app/(dashboard)/notes/page.tsx` — List/Graph toggle, render `NoteGraph` when selected

---

## 9. Constraints & Decisions

- **No new dependency.** Considered `d3-force`/`react-force-graph`/similar; rejected in favor of a small hand-rolled simulation to avoid bundle weight and because every other visual element in this app (charts aside, via Recharts) is custom-styled to the pixel/JRPG aesthetic rather than a general-purpose library's default look.
- **Notes-only graph**, no task nodes — keeps the knowledge graph conceptually distinct from task-scoped context, per the product doc's framing of Knowledge Base as being "for durable knowledge rather than task-scoped notes."
- **View + navigate only**, no in-graph link editing — the note editor's existing link picker remains the single way to create/remove links, avoiding two competing UIs for the same action.
- **Isolated notes shown, not hidden** — an honest picture beats a tidier-looking but incomplete one.
