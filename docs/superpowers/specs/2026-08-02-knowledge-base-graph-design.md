# Knowledge Base — Knowledge Map Design

**Date:** 2026-08-02
**Status:** Design Approved (v2 — expanded after first review round)
**Purpose:** Deliver the "Knowledge Base" v2 candidate from `docs/01-product.md` §14 ("networked/backlinked notes, second-brain style") as a **Knowledge Map** view layered on top of the existing Notes system, rather than a new entity.

---

## 1. Overview

Atlas already ships task-scoped Notes with title/content/tags/pinning, task-linking, manual note-to-note linking (`NoteLink`), and a markdown editor with live preview. What's missing to make it feel like a genuine knowledge base is a way to *see* the network of connections at a glance, and *explore* it without getting lost in hundreds of nodes at once.

This design adds a **Knowledge Map** view to the existing `/notes` page: a visual node map of all notes and their `NoteLink` connections, hand-rolled with a small force-directed layout (no new dependency), styled to match Atlas's pixel/JRPG aesthetic — plus a **Focus Mode** for drilling into one note's neighborhood instead of always facing the whole map at once.

**Explicitly not part of this pass:**
- No new entity, schema change, or nav item — reuses `Note`/`NoteLink` as-is and lives inside `/notes`.
- No drag-to-create-links on the map — linking still happens through the existing note editor's link picker. The map is a visualization, not an editor.
- No task nodes on the map — notes only, to keep the knowledge map conceptually distinct from task-scoped context.
- No saved layout persistence — the simulation recomputes each time the Knowledge Map is opened, which is cheap at personal-notes scale.

---

## 2. Data Model & Server Action

No Prisma schema changes. New read-only server action:

```ts
// src/lib/actions/notes.ts
export async function getNoteGraphAction(): Promise<ActionResult<{
  nodes: { id: string; title: string; pinned: boolean; linkCount: number }[];
  edges: { source: string; target: string }[];
}>>
```

- Auth-checked like every other action in this file (session → `db.user.findUnique`).
- `nodes`: every note the user owns (`db.note.findMany({ where: { userId }, select: { id, title, pinned } })`), including ones with zero links (isolated nodes are shown, not filtered out). `linkCount` is derived server-side by counting each note's `linksAsA`/`linksAsB` rows — this is what drives node size (§4).
- `edges`: `db.noteLink.findMany({ where: { noteA: { userId } }, select: { noteAId, noteBId } })` mapped to `{ source: noteAId, target: noteBId }`.
- No pagination — single-user personal note volumes (tens to low hundreds) don't need it.

---

## 3. Force Simulation (pure, testable)

New file `src/lib/note-graph.ts`, framework-agnostic:

```ts
export interface GraphNode { id: string; x: number; y: number; vx: number; vy: number; pinned: boolean; linkCount: number }
export interface GraphEdge { source: string; target: string }

export function stepSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  bounds: { width: number; height: number }
): GraphNode[]

/** BFS outward from `centerId` up to `maxHops` edges — powers Focus Mode (§5). */
export function getNeighborhood(
  centerId: string,
  edges: GraphEdge[],
  maxHops: number
): Map<string, number> // noteId -> hop distance (0 for center itself)

/** Radial layout for Focus Mode: center note fixed at origin, hop-1 ring, hop-2 ring. */
export function layoutRadial(
  centerId: string,
  neighborhood: Map<string, number>,
  edges: GraphEdge[],
  bounds: { width: number; height: number }
): Map<string, { x: number; y: number }>
```

**`stepSimulation`** — one physics tick for the full-map organic layout:
1. **Repulsion** — every node pair pushes apart, inversely proportional to distance (capped to avoid explosive velocities when two nodes start at the same point).
2. **Spring attraction** — each edge pulls its pair toward a target distance (~120px), proportional to distance error.
3. **Center gravity** — a weak constant pull toward `(width/2, height/2)`.
4. **Damping** — velocities decay (~0.85/tick) so the system settles instead of oscillating forever.

**`getNeighborhood`** — plain BFS over the edge list, returns every note within `maxHops` (2, per Focus Mode) along with its hop distance. Pure, trivially testable.

**`layoutRadial`** — deterministic, non-physics layout used only inside Focus Mode: center note at the origin; hop-1 notes placed evenly around a circle of radius `R1`; hop-2 notes on a further circle of radius `R2`, angularly grouped near whichever hop-1 note connects them (so the "spokes" in the ASCII sketch stay visually coherent instead of a random scatter). Also pure and testable (given fixed inputs, assert expected positions/radii).

All three are framework-agnostic, tested the same way `calculateStreak`/`applyTaskFilters` are.

---

## 4. Node Sizing

Radius = `baseRadius + sizeScale * sqrt(linkCount)` (sqrt keeps perceived *area* roughly linear in link count, not perceived radius — standard practice so a note with 4× the links doesn't look 4× as wide). Clamped to a min/max so an isolated note (0 links) and a heavily-linked hub both stay legible.

- **Size** → structural importance (how connected a note is — `linkCount`).
- **Border color** → personal importance (`--color-primary-gold` if pinned, `--color-border` otherwise).

These are deliberately two different signals on two different visual channels, not stacked into one "importance score" — a glance should be able to tell "this is a hub" (size) separately from "this is pinned" (color). Recently-edited is *not* encoded visually this pass — a third channel would be more than a glance-test needs, and recency is already visible by opening the note.

---

## 5. Focus Mode

**Entry:** single-click a node → that note becomes the *center*. Camera animates (lerp over ~300ms, eased) to center it. `getNeighborhood(centerId, edges, 2)` computes the visible set (center + 1-hop + 2-hop); `layoutRadial` positions them. Everything else fades to near-zero opacity rather than being abruptly removed — keeps spatial continuity through the transition.

```
           A

      B         C

   D     ME      E

      F         G
```
(center = clicked note, ring 1 = direct links, ring 2 = links-of-links)

**Exit:** click empty background, click the "Knowledge Map" root breadcrumb (§6), or press Escape → fades back to the full organic map (resume/continue the full-graph simulation rather than re-seeding from scratch, so it doesn't visibly "jump").

**Within Focus Mode:** clicking a *visible* neighbor node re-centers Focus Mode on it (new 2-hop neighborhood, new radial layout, same animated transition) and extends the breadcrumb (§6). Clicking a node that's part of the current 2-hop set but not directly adjacent to the current center still works the same way — Focus Mode always recomputes from whichever node you just centered on.

**Double-click** (anywhere: full map or inside Focus Mode) → opens the note editor directly (`/notes?edit=<id>`), same as the original single-click-to-open behavior, now moved to double-click so single-click is free for select/focus.

---

## 6. Breadcrumb

A bar above the map: `Knowledge Map / Authentication / JWT / Refresh Token`.

- Clicking a node while in the **full map** (not yet in Focus Mode) starts a new path: `Knowledge Map / <that note>`.
- Clicking a neighbor **while already in Focus Mode** appends to the path: `.../ <previous note> / <newly centered note>`.
- Clicking an **earlier crumb** re-centers Focus Mode on that note and truncates the path after it (jumping back, not just visually — the neighborhood/layout recompute for that note).
- Clicking **"Knowledge Map"** (the root crumb) exits Focus Mode entirely and clears the path.
- Jumping to a node via **Search** (§8) that isn't a continuation of the current path starts a fresh path: `Knowledge Map / <searched note>` (a search jump isn't a "drill-down," so it doesn't try to append to unrelated history).

---

## 7. Minimap

Shown only in **full map** mode (not inside Focus Mode, where the visible set is already small enough not to need one). A small fixed-position panel (bottom-right corner) rendering the same node positions already computed by `stepSimulation`, projected into a small `viewBox` — no second simulation needed, just a scaled-down read of the same data.

A rectangle overlay shows the main viewport's currently-visible region, derived from the main view's pan/zoom transform. Dragging the rectangle (or clicking elsewhere inside the minimap) pans the main view to that region.

---

## 8. Search

A search input on the Knowledge Map view itself (separate from the List view's server-side title/content search — this one's purpose is "find and jump to," not "filter the list down," so it works differently):

- Client-side substring match against already-loaded node titles (all nodes are already in memory for the map — no server round-trip per keystroke).
- Matching nodes get a highlight ring (pulsing gold); non-matching nodes dim — same dimming mechanism used for the tag filter (§9), combined with it by AND (a node must pass both the active tag filter *and* the search term to stay fully visible), consistent with how this app's other filters already combine (AND-across-facets, per the Tasks filter bar).
- On Enter (or selecting a suggestion, if multiple match): camera animates (flies) to center that node and triggers the same single-click "enter Focus Mode" behavior (§5) — search and click converge on the same entry point into Focus Mode.

---

## 9. Tag Filter (inherited from List view)

The Knowledge Map receives the same `selectedTags` state the List view already uses (lifted in the parent `notes/page.tsx`). Nodes whose note doesn't match the active tag filter dim, same mechanism as Search (§8) — the two combine by AND, not by replacing each other.

---

## 10. Rendering — `KnowledgeMap.tsx`

New `src/components/notes/KnowledgeMap.tsx`, client component:

- On mount: call `getNoteGraphAction()`, seed each node at a random position, `vx`/`vy` = 0.
- Full-map mode: `stepSimulation` on a `requestAnimationFrame` loop, positions held in a `ref` and written directly to SVG element attributes each frame (skips React reconciliation — cost stays proportional to node count, not to a full component re-render). Stops once total kinetic energy drops below a threshold (typically ~2-3s), resumes if the user exits back out of Focus Mode into a map that hasn't fully settled yet.
- Focus Mode: swaps to `layoutRadial`'s static positions with one animated transition, no continuous physics tick needed since it's not a live simulation.
- **Nodes:** diamond/square glyphs consistent with the existing `STATUS_SHAPE` style. Sized per §4, bordered per §4. Truncated title label beside/below.
- **Edges:** thin lines (`--color-border`).
- **Isolated nodes:** still rendered (full map only — Focus Mode by definition only shows connected notes within 2 hops of the center).
- **Pan/zoom:** drag background / scroll wheel adjust a wrapping `<g transform>`, clamped zoom range (~0.3×–3×).
- **Click vs. double-click:** single = select/focus (§5), double = open editor.

---

## 11. UI Integration

`src/app/(dashboard)/notes/page.tsx`:

- Add a "List / Knowledge Map" toggle next to the existing search input — same pattern as the Tasks page's List/Table toggle.
- `viewMode` state (`"list" | "map"`), default `"list"` (no behavior change until a user opts in).
- When `viewMode === "map"`, render `<KnowledgeMap selectedTags={selectedTags} onOpenNote={handleSelectNote} />` in place of `<NoteList>`. The map fetches its own node/edge data via `getNoteGraphAction()` (it needs `linkCount` and edges, which the List view's `notes` prop doesn't carry) rather than reusing the List view's `notes` state.

---

## 12. Error Handling

- `getNoteGraphAction()` failure: existing inline-error pattern used elsewhere on the Notes page.
- Zero notes: empty-state message, same tone as `NoteList`'s existing "No notes yet."
- Notes with zero edges: not an error — rendered as isolated nodes in full-map mode (Focus Mode simply can't be entered from one, since there's nowhere to drill — clicking still centers on it with an empty 1-hop/2-hop ring, which is a valid, if sparse, Focus Mode view).
- Search with no matches: all nodes dim, no crash, no camera movement.

---

## 13. Testing Strategy

**Unit tests** (`src/lib/note-graph.test.ts`, matching this project's convention of testing pure `lib/` functions, not server actions or components):
- `stepSimulation`: two linked nodes started far apart move closer after one tick; two unconnected nodes started close move apart; an off-center isolated node drifts toward center (gravity alone); velocities decay tick-over-tick with no forces applied (damping).
- `getNeighborhood`: returns exactly the center + correct 1-hop + 2-hop sets for a small fixed graph fixture; a note 3+ hops away is excluded; an isolated note's neighborhood is just itself.
- `layoutRadial`: hop-1 nodes land at distance `R1` from center, hop-2 nodes at distance `R2`; center is always at the origin.

Not tested (consistent with existing project conventions): `getNoteGraphAction` (server actions aren't unit tested anywhere in this codebase), `KnowledgeMap.tsx` itself (no React Testing Library setup present — this app's test coverage is pure-logic-only).

---

## 14. File Structure

**New files:**
- `src/lib/note-graph.ts` — `stepSimulation`, `getNeighborhood`, `layoutRadial`, shared types
- `src/lib/note-graph.test.ts` — unit tests
- `src/components/notes/KnowledgeMap.tsx` — rendering, pan/zoom, Focus Mode, breadcrumb, minimap, search

**Modified files:**
- `src/lib/actions/notes.ts` — add `getNoteGraphAction`
- `src/app/(dashboard)/notes/page.tsx` — List/Knowledge Map toggle, render `KnowledgeMap` when selected

---

## 15. Constraints & Decisions

- **No new dependency.** Considered `d3-force`/`react-force-graph`/similar; rejected for a small hand-rolled simulation to avoid bundle weight and keep the pixel/JRPG aesthetic under our own control.
- **Notes-only map**, no task nodes — keeps it conceptually distinct from task-scoped context.
- **View + navigate only**, no in-map link editing — the note editor's existing link picker remains the single way to create/remove links.
- **Isolated notes shown, not hidden** (full-map mode) — an honest picture beats a tidier-looking but incomplete one.
- **Node size = link count, not pinned** — pinned already owns the border-color channel; doubling it into size too would waste a channel that recency/other future signals could use instead.
- **Minimap ships this pass**, per explicit request, even though it primarily earns its keep at note counts larger than a typical single-user personal collection — cheap to build (reuses already-computed positions, no second simulation) so the cost of shipping it early is low.

---

## 16. Suggested Build Order (for the implementation plan)

This grew from a single map view into several coupled interactions. Recommended sequencing so each slice is independently demoable:
1. Data + full-map render (§2–4, §10 minus Focus Mode) + List/Map toggle (§11) — a working, pannable/zoomable map with sized/colored nodes, click = open editor (no Focus Mode yet).
2. Focus Mode + breadcrumb + click/double-click split (§5–6) — the exploration model.
3. Search (§8) — since it targets Focus Mode entry, built after step 2.
4. Minimap (§7) — purely additive to the full-map view, no dependency on Focus Mode/Search, can land last.
