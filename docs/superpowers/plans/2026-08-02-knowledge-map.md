# Knowledge Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Knowledge Map" view to the existing Notes page — a visual node map of notes and their links, with Focus Mode drill-down, search, and a minimap.

**Architecture:** No schema changes. A new read-only server action (`getNoteGraphAction`) exposes notes + `NoteLink` edges. A new pure module (`src/lib/note-graph.ts`) holds all graph math (force simulation, neighborhood BFS, radial layout, search matching) so it's unit-testable without a DOM. A new client component (`KnowledgeMap.tsx`) renders it as hand-rolled SVG, driving the force simulation with direct DOM attribute writes per animation frame (not React state) to keep per-frame cost proportional to node count. The existing `/notes` page gains a List/Knowledge Map toggle.

**Tech Stack:** Next.js App Router, React, TypeScript, Prisma, vitest. No new npm dependencies.

## Global Constraints

- No Prisma schema changes — reuses `Note` and `NoteLink` as-is.
- No new dependency for graph rendering/physics — hand-rolled SVG + a small force simulation.
- Notes-only nodes — no task nodes on the map.
- View + navigate only — no creating/editing links from the map itself (that stays in the note editor's existing link picker).
- Isolated notes (no links) are shown on the full map, not hidden.
- Server actions in this codebase are not unit tested (no exceptions here); only pure `src/lib/*.ts` functions get vitest coverage. There is no React component test setup (no RTL) — component tasks are verified manually via `npm run dev`, not automated tests.
- Follow existing action patterns exactly: `"use server"`, `auth()` → `db.user.findUnique` by email, `ActionResult<T>` return shape from `src/lib/actions/types.ts`.
- Full spec: `docs/superpowers/specs/2026-08-02-knowledge-base-graph-design.md`.

---

## Task 1: `getNoteGraphAction` server action

**Files:**
- Modify: `src/lib/actions/notes.ts` (append at end of file, after `unlinkNotesAction`)

**Interfaces:**
- Produces: `getNoteGraphAction(): Promise<ActionResult<{ nodes: { id: string; title: string; pinned: boolean; linkCount: number }[]; edges: { source: string; target: string }[] }>>`

- [ ] **Step 1: Add the action**

Append to `src/lib/actions/notes.ts`:

```ts
export async function getNoteGraphAction(): Promise<
  ActionResult<{
    nodes: { id: string; title: string; pinned: boolean; linkCount: number }[];
    edges: { source: string; target: string }[];
  }>
> {
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: { code: "UNAUTHORIZED", message: "Sign in required." } };
  }

  try {
    const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (!user) {
      return { success: false, error: { code: "NOT_FOUND", message: "User not found." } };
    }

    const [notes, links] = await Promise.all([
      db.note.findMany({ where: { userId: user.id }, select: { id: true, title: true, pinned: true } }),
      db.noteLink.findMany({ where: { noteA: { userId: user.id } }, select: { noteAId: true, noteBId: true } }),
    ]);

    const linkCounts = new Map<string, number>();
    for (const link of links) {
      linkCounts.set(link.noteAId, (linkCounts.get(link.noteAId) ?? 0) + 1);
      linkCounts.set(link.noteBId, (linkCounts.get(link.noteBId) ?? 0) + 1);
    }

    return {
      success: true,
      data: {
        nodes: notes.map((n) => ({
          id: n.id,
          title: n.title,
          pinned: n.pinned,
          linkCount: linkCounts.get(n.id) ?? 0,
        })),
        edges: links.map((l) => ({ source: l.noteAId, target: l.noteBId })),
      },
    };
  } catch (error) {
    console.error("Failed to fetch note graph:", error);
    return { success: false, error: { code: "INTERNAL", message: "Failed to fetch note graph." } };
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors in `src/lib/actions/notes.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/notes.ts
git commit -m "feat: add getNoteGraphAction for the Knowledge Map"
```

---

## Task 2: `stepSimulation` (force simulation core)

**Files:**
- Create: `src/lib/note-graph.ts`
- Test: `src/lib/note-graph.test.ts`

**Interfaces:**
- Produces: `GraphNode { id: string; x: number; y: number; vx: number; vy: number; pinned: boolean; linkCount: number }`, `GraphEdge { source: string; target: string }`, `stepSimulation(nodes: GraphNode[], edges: GraphEdge[], bounds: { width: number; height: number }): GraphNode[]`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/note-graph.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { stepSimulation, type GraphNode, type GraphEdge } from "./note-graph";

function node(overrides: Partial<GraphNode> & Pick<GraphNode, "id" | "x" | "y">): GraphNode {
  return { vx: 0, vy: 0, pinned: false, linkCount: 0, ...overrides };
}

function distance(a: GraphNode, b: GraphNode): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

describe("stepSimulation", () => {
  it("pulls linked nodes closer together when they start far apart", () => {
    const nodes = [node({ id: "a", x: 100, y: 400 }), node({ id: "b", x: 700, y: 400 })];
    const edges: GraphEdge[] = [{ source: "a", target: "b" }];
    const before = distance(nodes[0], nodes[1]);
    const after = stepSimulation(nodes, edges, { width: 800, height: 800 });
    const afterDist = distance(
      after.find((n) => n.id === "a")!,
      after.find((n) => n.id === "b")!
    );
    expect(afterDist).toBeLessThan(before);
  });

  it("pushes unconnected nodes apart when they start close together", () => {
    const nodes = [node({ id: "a", x: 400, y: 400 }), node({ id: "b", x: 405, y: 400 })];
    const before = distance(nodes[0], nodes[1]);
    const after = stepSimulation(nodes, [], { width: 800, height: 800 });
    const afterDist = distance(
      after.find((n) => n.id === "a")!,
      after.find((n) => n.id === "b")!
    );
    expect(afterDist).toBeGreaterThan(before);
  });

  it("drifts a lone off-center node toward the bounds center via gravity", () => {
    const nodes = [node({ id: "a", x: 100, y: 100 })];
    const before = distance(nodes[0], { ...nodes[0], x: 400, y: 400 });
    const after = stepSimulation(nodes, [], { width: 800, height: 800 });
    const afterNode = after.find((n) => n.id === "a")!;
    const afterDistToCenter = distance(afterNode, { ...afterNode, x: 400, y: 400 });
    expect(afterDistToCenter).toBeLessThan(before);
  });

  it("damps velocity over successive ticks with no external forces", () => {
    // Centered node (no gravity pull) with existing velocity and no other nodes/edges (no repulsion/spring).
    const nodes = [node({ id: "a", x: 400, y: 400, vx: 10, vy: 0 })];
    const after = stepSimulation(nodes, [], { width: 800, height: 800 });
    const afterNode = after.find((n) => n.id === "a")!;
    expect(Math.abs(afterNode.vx)).toBeLessThan(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/note-graph.test.ts`
Expected: FAIL — `./note-graph` module not found.

- [ ] **Step 3: Implement `stepSimulation`**

Create `src/lib/note-graph.ts`:

```ts
export interface GraphNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned: boolean;
  linkCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

const REPULSION_STRENGTH = 20000;
const MAX_REPULSION_FORCE = 50;
const SPRING_LENGTH = 120;
const SPRING_STRENGTH = 0.02;
const CENTER_GRAVITY = 0.01;
const DAMPING = 0.85;

/** One physics tick for the full-map organic layout — pure, no DOM/React dependency. */
export function stepSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  bounds: { width: number; height: number }
): GraphNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const forces = new Map(nodes.map((n) => [n.id, { fx: 0, fy: 0 }]));

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let distSq = dx * dx + dy * dy;
      if (distSq < 0.01) {
        dx = (Math.random() - 0.5) * 0.1;
        dy = (Math.random() - 0.5) * 0.1;
        distSq = dx * dx + dy * dy;
      }
      const dist = Math.sqrt(distSq);
      const force = Math.min(REPULSION_STRENGTH / distSq, MAX_REPULSION_FORCE);
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      forces.get(a.id)!.fx += fx;
      forces.get(a.id)!.fy += fy;
      forces.get(b.id)!.fx -= fx;
      forces.get(b.id)!.fy -= fy;
    }
  }

  for (const edge of edges) {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
    const displacement = dist - SPRING_LENGTH;
    const force = displacement * SPRING_STRENGTH;
    const fx = (dx / dist) * force;
    const fy = (dy / dist) * force;
    forces.get(a.id)!.fx += fx;
    forces.get(a.id)!.fy += fy;
    forces.get(b.id)!.fx -= fx;
    forces.get(b.id)!.fy -= fy;
  }

  const cx = bounds.width / 2;
  const cy = bounds.height / 2;
  for (const n of nodes) {
    const f = forces.get(n.id)!;
    f.fx += (cx - n.x) * CENTER_GRAVITY;
    f.fy += (cy - n.y) * CENTER_GRAVITY;
  }

  return nodes.map((n) => {
    const f = forces.get(n.id)!;
    const vx = (n.vx + f.fx) * DAMPING;
    const vy = (n.vy + f.fy) * DAMPING;
    return { ...n, x: n.x + vx, y: n.y + vy, vx, vy };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/note-graph.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/note-graph.ts src/lib/note-graph.test.ts
git commit -m "feat: add stepSimulation force-layout physics for the Knowledge Map"
```

---

## Task 3: `KnowledgeMap.tsx` — full-map render, pan/zoom, List/Map toggle

**Files:**
- Create: `src/components/notes/KnowledgeMap.tsx`
- Modify: `src/app/(dashboard)/notes/page.tsx`

**Interfaces:**
- Consumes: `getNoteGraphAction` (Task 1), `stepSimulation`, `GraphNode`, `GraphEdge` (Task 2)
- Produces: `KnowledgeMap({ selectedTags: string[]; onOpenNote: (noteId: string) => void })` — a React component

- [ ] **Step 1: Create the component**

Create `src/components/notes/KnowledgeMap.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { getNoteGraphAction } from "@/lib/actions/notes";
import { stepSimulation, type GraphNode, type GraphEdge } from "@/lib/note-graph";

type MapNode = GraphNode & { title: string };

const MIN_RADIUS = 6;
const MAX_RADIUS = 22;
const RADIUS_BASE = 6;
const RADIUS_SCALE = 3;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const KINETIC_ENERGY_STOP_THRESHOLD = 0.05;

function nodeRadius(linkCount: number): number {
  const r = RADIUS_BASE + RADIUS_SCALE * Math.sqrt(linkCount);
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, r));
}

export interface KnowledgeMapProps {
  selectedTags: string[];
  onOpenNote: (noteId: string) => void;
}

export function KnowledgeMap({ onOpenNote }: KnowledgeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<MapNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const nodeElRefs = useRef<Map<string, SVGGElement>>(new Map());
  const edgeElRefs = useRef<Map<number, SVGLineElement>>(new Map());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const [bounds, setBounds] = useState({ width: 800, height: 600 });
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setBounds({ width: rect.width, height: rect.height });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getNoteGraphAction();
      if (cancelled) return;
      if (!result.success) {
        setStatus("error");
        return;
      }
      nodesRef.current = result.data.nodes.map((n) => ({
        id: n.id,
        title: n.title,
        pinned: n.pinned,
        linkCount: n.linkCount,
        x: bounds.width / 2 + (Math.random() - 0.5) * 200,
        y: bounds.height / 2 + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
      }));
      edgesRef.current = result.data.edges;
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
    // Runs once on mount — bounds is only used to seed initial random positions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "ready") return;

    const tick = () => {
      const updated = stepSimulation(nodesRef.current, edgesRef.current, bounds);
      nodesRef.current = updated.map((n, i) => ({ ...n, title: nodesRef.current[i].title }));

      let kineticEnergy = 0;
      for (const n of nodesRef.current) kineticEnergy += n.vx * n.vx + n.vy * n.vy;

      for (const n of nodesRef.current) {
        const el = nodeElRefs.current.get(n.id);
        if (el) el.setAttribute("transform", `translate(${n.x}, ${n.y})`);
      }
      edgesRef.current.forEach((edge, i) => {
        const line = edgeElRefs.current.get(i);
        if (!line) return;
        const a = nodesRef.current.find((n) => n.id === edge.source);
        const b = nodesRef.current.find((n) => n.id === edge.target);
        if (a && b) {
          line.setAttribute("x1", String(a.x));
          line.setAttribute("y1", String(a.y));
          line.setAttribute("x2", String(b.x));
          line.setAttribute("y2", String(b.y));
        }
      });

      if (kineticEnergy > KINETIC_ENERGY_STOP_THRESHOLD) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [status, bounds]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((t) => ({ ...t, scale: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.scale * delta)) }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: transform.x, originY: transform.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setTransform((t) => ({ ...t, x: dragRef.current!.originX + dx, y: dragRef.current!.originY + dy }));
  };

  const handleMouseUp = () => {
    dragRef.current = null;
  };

  if (status === "loading") {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading knowledge map…</div>;
  }
  if (status === "error") {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Couldn't load the knowledge map.</div>;
  }
  if (nodesRef.current.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No notes yet.</div>;
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ backgroundColor: "var(--color-bg-deep)" }}>
      <svg
        width="100%"
        height="100%"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: "grab" }}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {edgesRef.current.map((edge, i) => (
            <line
              key={i}
              ref={(el) => {
                if (el) edgeElRefs.current.set(i, el);
              }}
              stroke="var(--color-border)"
              strokeWidth={1}
              opacity={0.6}
            />
          ))}
          {nodesRef.current.map((node) => (
            <g
              key={node.id}
              ref={(el) => {
                if (el) nodeElRefs.current.set(node.id, el);
              }}
              transform={`translate(${node.x}, ${node.y})`}
              onDoubleClick={() => onOpenNote(node.id)}
              style={{ cursor: "pointer" }}
            >
              <circle
                r={nodeRadius(node.linkCount)}
                fill="var(--color-bg-panel)"
                stroke={node.pinned ? "var(--color-primary-gold)" : "var(--color-border)"}
                strokeWidth={2}
              />
              <text y={nodeRadius(node.linkCount) + 14} textAnchor="middle" fontSize={11} fill="var(--color-text-muted)">
                {node.title.length > 20 ? node.title.slice(0, 20) + "…" : node.title}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
```

Note: `selectedTags` is accepted in the props type now (so the toggle wiring in Step 2 compiles against the final prop shape from the spec) but not yet used inside the component — dimming by tag is wired in Task 5 alongside search dimming, since both share the same opacity mechanism and are easiest to get right together.

- [ ] **Step 2: Wire the List/Knowledge Map toggle into the Notes page**

In `src/app/(dashboard)/notes/page.tsx`, add the import and a `viewMode` state, and swap the list rendering:

```ts
import { List, Map as MapIcon } from "lucide-react";
import { KnowledgeMap } from "@/components/notes/KnowledgeMap";
```

Add state near the other `useState` calls:

```ts
const [viewMode, setViewMode] = useState<"list" | "map">("list");
```

Replace the search-row block:

```tsx
<div className="flex gap-2">
  <input
    type="text"
    placeholder="Search notes..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="flex-1 px-3 py-2 border border-border rounded bg-card text-sm"
  />
  <div className="flex items-center border border-border rounded overflow-hidden">
    <button
      onClick={() => setViewMode("list")}
      className={`flex items-center gap-1 px-3 py-2 text-sm transition-colors ${
        viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
      }`}
    >
      <List size={14} /> List
    </button>
    <button
      onClick={() => setViewMode("map")}
      className={`flex items-center gap-1 px-3 py-2 text-sm transition-colors ${
        viewMode === "map" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
      }`}
    >
      <MapIcon size={14} /> Knowledge Map
    </button>
  </div>
  <button
    onClick={() => setIsCreating(true)}
    className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm"
  >
    New Note
  </button>
</div>
```

Replace the loading/list block at the bottom:

```tsx
{viewMode === "map" ? (
  <KnowledgeMap selectedTags={selectedTags} onOpenNote={(id) => setEditingNoteId(id)} />
) : loading ? (
  <div className="flex items-center justify-center flex-1">Loading...</div>
) : (
  <NoteList notes={notes} onSelectNote={handleSelectNote} onDeleteNote={handleDelete} onPinNote={handlePinNote} />
)}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, open `/notes`, create 3-4 notes, link a couple via the existing "Linked Notes" picker in the note editor, then:
- Click "Knowledge Map" — expect a canvas of nodes settling into place within a few seconds, linked notes pulled toward each other, unlinked ones drifting to the outskirts.
- Scroll to zoom, drag the background to pan.
- Double-click a node — expect it to open that note in the editor.
- Pinned notes should show a gold-bordered node; unpinned a muted border.

- [ ] **Step 5: Commit**

```bash
git add src/components/notes/KnowledgeMap.tsx "src/app/(dashboard)/notes/page.tsx"
git commit -m "feat: add Knowledge Map full-view render with pan/zoom"
```

---

## Task 4: `getNeighborhood` + `layoutRadial` (Focus Mode math)

**Files:**
- Modify: `src/lib/note-graph.ts`
- Modify: `src/lib/note-graph.test.ts`

**Interfaces:**
- Consumes: `GraphEdge` (Task 2)
- Produces: `getNeighborhood(centerId: string, edges: GraphEdge[], maxHops: number): Map<string, number>`, `RadialPosition { x: number; y: number }`, `layoutRadial(centerId: string, neighborhood: Map<string, number>, edges: GraphEdge[], bounds: { width: number; height: number }): Map<string, RadialPosition>`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/note-graph.test.ts`:

```ts
import { getNeighborhood, layoutRadial } from "./note-graph";

describe("getNeighborhood", () => {
  // a - b - c - d  (chain), e is isolated
  const edges: GraphEdge[] = [
    { source: "a", target: "b" },
    { source: "b", target: "c" },
    { source: "c", target: "d" },
  ];

  it("includes the center at distance 0", () => {
    const result = getNeighborhood("a", edges, 2);
    expect(result.get("a")).toBe(0);
  });

  it("includes 1-hop and 2-hop neighbors with correct distances", () => {
    const result = getNeighborhood("a", edges, 2);
    expect(result.get("b")).toBe(1);
    expect(result.get("c")).toBe(2);
  });

  it("excludes notes further than maxHops away", () => {
    const result = getNeighborhood("a", edges, 2);
    expect(result.has("d")).toBe(false);
  });

  it("returns just the center for an isolated note", () => {
    const result = getNeighborhood("e", edges, 2);
    expect(result.size).toBe(1);
    expect(result.get("e")).toBe(0);
  });
});

describe("layoutRadial", () => {
  const edges: GraphEdge[] = [
    { source: "center", target: "hop1" },
    { source: "hop1", target: "hop2" },
  ];
  const neighborhood = new Map([
    ["center", 0],
    ["hop1", 1],
    ["hop2", 2],
  ]);
  const bounds = { width: 800, height: 600 };

  it("places the center at the bounds midpoint", () => {
    const positions = layoutRadial("center", neighborhood, edges, bounds);
    expect(positions.get("center")).toEqual({ x: 400, y: 300 });
  });

  it("places hop-1 nodes at the hop-1 ring radius from center", () => {
    const positions = layoutRadial("center", neighborhood, edges, bounds);
    const center = positions.get("center")!;
    const hop1 = positions.get("hop1")!;
    const dist = Math.sqrt((hop1.x - center.x) ** 2 + (hop1.y - center.y) ** 2);
    expect(dist).toBeCloseTo(150, 0);
  });

  it("places hop-2 nodes at the hop-2 ring radius from center", () => {
    const positions = layoutRadial("center", neighborhood, edges, bounds);
    const center = positions.get("center")!;
    const hop2 = positions.get("hop2")!;
    const dist = Math.sqrt((hop2.x - center.x) ** 2 + (hop2.y - center.y) ** 2);
    expect(dist).toBeCloseTo(280, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/note-graph.test.ts`
Expected: FAIL — `getNeighborhood`/`layoutRadial` not exported.

- [ ] **Step 3: Implement both functions**

Append to `src/lib/note-graph.ts`:

```ts
/** BFS outward from `centerId` up to `maxHops` edges. Returns noteId -> hop distance (0 = center). */
export function getNeighborhood(centerId: string, edges: GraphEdge[], maxHops: number): Map<string, number> {
  const adjacency = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, new Set());
    if (!adjacency.has(e.target)) adjacency.set(e.target, new Set());
    adjacency.get(e.source)!.add(e.target);
    adjacency.get(e.target)!.add(e.source);
  }

  const distances = new Map<string, number>();
  distances.set(centerId, 0);
  let frontier = [centerId];
  for (let hop = 1; hop <= maxHops; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      const neighbors = adjacency.get(id);
      if (!neighbors) continue;
      for (const n of neighbors) {
        if (!distances.has(n)) {
          distances.set(n, hop);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return distances;
}

export interface RadialPosition {
  x: number;
  y: number;
}

const HOP1_RADIUS = 150;
const HOP2_RADIUS = 280;

/** Deterministic Focus Mode layout: center at origin, hop-1 ring, hop-2 ring grouped near their hop-1 parent. */
export function layoutRadial(
  centerId: string,
  neighborhood: Map<string, number>,
  edges: GraphEdge[],
  bounds: { width: number; height: number }
): Map<string, RadialPosition> {
  const cx = bounds.width / 2;
  const cy = bounds.height / 2;
  const positions = new Map<string, RadialPosition>();
  positions.set(centerId, { x: cx, y: cy });

  const hop1 = Array.from(neighborhood.entries())
    .filter(([, hop]) => hop === 1)
    .map(([id]) => id);
  const hop2 = Array.from(neighborhood.entries())
    .filter(([, hop]) => hop === 2)
    .map(([id]) => id);

  const hop1Angle = new Map<string, number>();
  hop1.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(hop1.length, 1);
    hop1Angle.set(id, angle);
    positions.set(id, { x: cx + HOP1_RADIUS * Math.cos(angle), y: cy + HOP1_RADIUS * Math.sin(angle) });
  });

  const parentOfHop2 = new Map<string, string>();
  for (const id of hop2) {
    const parentEdge = edges.find(
      (e) => (e.source === id && hop1.includes(e.target)) || (e.target === id && hop1.includes(e.source))
    );
    if (parentEdge) {
      parentOfHop2.set(id, parentEdge.source === id ? parentEdge.target : parentEdge.source);
    }
  }

  const hop2ByParent = new Map<string, string[]>();
  for (const id of hop2) {
    const key = parentOfHop2.get(id) ?? "__orphan__";
    if (!hop2ByParent.has(key)) hop2ByParent.set(key, []);
    hop2ByParent.get(key)!.push(id);
  }

  for (const [parentId, children] of hop2ByParent) {
    const baseAngle = hop1Angle.get(parentId) ?? 0;
    const spread = Math.PI / 6;
    children.forEach((id, i) => {
      const offset = children.length > 1 ? spread * (i / (children.length - 1) - 0.5) * 2 : 0;
      const angle = baseAngle + offset;
      positions.set(id, { x: cx + HOP2_RADIUS * Math.cos(angle), y: cy + HOP2_RADIUS * Math.sin(angle) });
    });
  }

  return positions;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/note-graph.test.ts`
Expected: PASS (all tests in the file, including the ones from Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/note-graph.ts src/lib/note-graph.test.ts
git commit -m "feat: add getNeighborhood + layoutRadial for Focus Mode"
```

---

## Task 5: Focus Mode, breadcrumb, click/double-click split

**Files:**
- Modify: `src/components/notes/KnowledgeMap.tsx`

**Interfaces:**
- Consumes: `getNeighborhood`, `layoutRadial`, `RadialPosition` (Task 4)
- Produces: internal `focusedNoteId`/`breadcrumbPath` state — no new exported interface, this task changes behavior of the existing `KnowledgeMap` component.

- [ ] **Step 1: Add Focus Mode + breadcrumb state and handlers**

In `src/components/notes/KnowledgeMap.tsx`, update the import line to include the new functions:

```ts
import { stepSimulation, getNeighborhood, layoutRadial, type GraphNode, type GraphEdge } from "@/lib/note-graph";
```

Add state, alongside the existing `transform` state:

```ts
const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
const [breadcrumbPath, setBreadcrumbPath] = useState<{ id: string; title: string }[]>([]);
const focusTransitionRef = useRef<number | undefined>(undefined);
```

Add the click/exit handlers, placed after `handleMouseUp`:

```ts
const enterFocus = (node: MapNode) => {
  setBreadcrumbPath((prev) => {
    const continuingDrillDown = focusedNoteId !== null && prev.some((p) => p.id === focusedNoteId);
    return continuingDrillDown ? [...prev, { id: node.id, title: node.title }] : [{ id: node.id, title: node.title }];
  });
  setFocusedNoteId(node.id);
};

const exitFocus = () => {
  setFocusedNoteId(null);
  setBreadcrumbPath([]);
};

const jumpToBreadcrumb = (index: number) => {
  const target = breadcrumbPath[index];
  setBreadcrumbPath(breadcrumbPath.slice(0, index + 1));
  setFocusedNoteId(target.id);
};
```

- [ ] **Step 2: Animate into/out of Focus Mode**

Add an effect that runs whenever `focusedNoteId` changes, lerping node positions toward the target layout (radial when focused, or back toward wherever the organic simulation last left off when un-focusing):

```ts
useEffect(() => {
  if (status !== "ready") return;

  const startPositions = new Map(nodesRef.current.map((n) => [n.id, { x: n.x, y: n.y }]));
  const neighborhood = focusedNoteId ? getNeighborhood(focusedNoteId, edgesRef.current, 2) : null;
  const targetPositions = focusedNoteId && neighborhood ? layoutRadial(focusedNoteId, neighborhood, edgesRef.current, bounds) : null;

  const duration = 300;
  const startTime = performance.now();

  const animate = (now: number) => {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - (1 - t) * (1 - t); // ease-out

    for (const n of nodesRef.current) {
      const start = startPositions.get(n.id)!;
      const target = targetPositions?.get(n.id) ?? start; // nodes outside the focus set just stay put and fade
      n.x = start.x + (target.x - start.x) * eased;
      n.y = start.y + (target.y - start.y) * eased;

      const el = nodeElRefs.current.get(n.id);
      if (el) {
        el.setAttribute("transform", `translate(${n.x}, ${n.y})`);
        const inFocusSet = !focusedNoteId || (neighborhood?.has(n.id) ?? false);
        el.style.opacity = inFocusSet ? "1" : "0.05";
      }
    }
    edgesRef.current.forEach((edge, i) => {
      const line = edgeElRefs.current.get(i);
      if (!line) return;
      const a = nodesRef.current.find((n) => n.id === edge.source);
      const b = nodesRef.current.find((n) => n.id === edge.target);
      if (a && b) {
        line.setAttribute("x1", String(a.x));
        line.setAttribute("y1", String(a.y));
        line.setAttribute("x2", String(b.x));
        line.setAttribute("y2", String(b.y));
      }
    });

    if (t < 1) {
      focusTransitionRef.current = requestAnimationFrame(animate);
    }
  };
  focusTransitionRef.current = requestAnimationFrame(animate);
  return () => {
    if (focusTransitionRef.current) cancelAnimationFrame(focusTransitionRef.current);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [focusedNoteId]);
```

Modify the main organic-layout `useEffect` from Task 3 to pause while focused — change its guard line from `if (status !== "ready") return;` to:

```ts
if (status !== "ready" || focusedNoteId) return;
```

- [ ] **Step 3: Wire click (select/focus) vs. double-click (open) and the exit-on-background-click**

Update the node `<g>` element's handlers:

```tsx
<g
  key={node.id}
  ref={(el) => {
    if (el) nodeElRefs.current.set(node.id, el);
  }}
  transform={`translate(${node.x}, ${node.y})`}
  onClick={() => enterFocus(node)}
  onDoubleClick={() => onOpenNote(node.id)}
  style={{ cursor: "pointer" }}
>
```

Add a background click-to-exit handler on the `<svg>` itself (only fires when the click target is the svg background, not a node — node clicks are handled by their own `onClick` and React stops the event there since the `<g>` handler doesn't call `stopPropagation`, so we instead check the click target directly):

```tsx
<svg
  width="100%"
  height="100%"
  onWheel={handleWheel}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onMouseLeave={handleMouseUp}
  onClick={(e) => {
    if (e.target === e.currentTarget && focusedNoteId) exitFocus();
  }}
  style={{ cursor: "grab" }}
>
```

Add an Escape-key listener to exit focus, alongside the other top-level effects:

```ts
useEffect(() => {
  if (!focusedNoteId) return;
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") exitFocus();
  };
  window.addEventListener("keydown", onKeyDown);
  return () => window.removeEventListener("keydown", onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [focusedNoteId]);
```

- [ ] **Step 4: Render the breadcrumb bar**

Add above the `<svg>` inside the component's returned JSX (as a sibling, inside the outer `<div ref={containerRef}>`):

```tsx
{breadcrumbPath.length > 0 && (
  <div className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-xs">
    <button onClick={exitFocus} className="text-muted-foreground hover:text-foreground">
      Knowledge Map
    </button>
    {breadcrumbPath.map((crumb, i) => (
      <span key={crumb.id} className="flex items-center gap-1">
        <span className="text-muted-foreground">/</span>
        <button
          onClick={() => jumpToBreadcrumb(i)}
          className={i === breadcrumbPath.length - 1 ? "text-foreground" : "text-muted-foreground hover:text-foreground"}
        >
          {crumb.title}
        </button>
      </span>
    ))}
  </div>
)}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

Run: `npm run dev`, open `/notes` → Knowledge Map, with at least 4 notes linked in a chain (A↔B↔C↔D):
- Single-click A — expect the view to animate to a radial layout centered on A, with B (1-hop) in a ring and C (2-hop) further out; D (3-hop) fades out; breadcrumb shows "Knowledge Map / A".
- Click B (visible in the ring) — expect it to re-center on B, breadcrumb becomes "Knowledge Map / A / B".
- Click the "A" breadcrumb — expect it to jump back, breadcrumb truncates to "Knowledge Map / A".
- Click "Knowledge Map" — expect it to return to the full organic map.
- Press Escape while focused — same as clicking "Knowledge Map".
- Double-click any node (focused or not) — expect it to open that note in the editor.

- [ ] **Step 7: Commit**

```bash
git add src/components/notes/KnowledgeMap.tsx
git commit -m "feat: add Focus Mode + breadcrumb to the Knowledge Map"
```

---

## Task 6: Search (with fly-to-focus) + tag-filter dimming

**Files:**
- Modify: `src/lib/note-graph.ts`
- Modify: `src/lib/note-graph.test.ts`
- Modify: `src/components/notes/KnowledgeMap.tsx`

**Interfaces:**
- Produces: `matchesSearchQuery(title: string, query: string): boolean`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/note-graph.test.ts`:

```ts
import { matchesSearchQuery } from "./note-graph";

describe("matchesSearchQuery", () => {
  it("matches case-insensitively on substring", () => {
    expect(matchesSearchQuery("JWT Refresh Token", "jwt")).toBe(true);
  });

  it("does not match an unrelated title", () => {
    expect(matchesSearchQuery("JWT Refresh Token", "database")).toBe(false);
  });

  it("treats an empty query as matching everything", () => {
    expect(matchesSearchQuery("Anything", "")).toBe(true);
    expect(matchesSearchQuery("Anything", "   ")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/note-graph.test.ts`
Expected: FAIL — `matchesSearchQuery` not exported.

- [ ] **Step 3: Implement it**

Append to `src/lib/note-graph.ts`:

```ts
/** Case-insensitive substring match against a note title. Empty/whitespace query matches everything. */
export function matchesSearchQuery(title: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  return title.toLowerCase().includes(trimmed.toLowerCase());
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/note-graph.test.ts`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit the pure-logic addition**

```bash
git add src/lib/note-graph.ts src/lib/note-graph.test.ts
git commit -m "feat: add matchesSearchQuery for Knowledge Map search"
```

- [ ] **Step 6: Wire search input + dimming + fly-to-focus into the component**

In `src/components/notes/KnowledgeMap.tsx`, update the import:

```ts
import { stepSimulation, getNeighborhood, layoutRadial, matchesSearchQuery, type GraphNode, type GraphEdge } from "@/lib/note-graph";
```

Add state:

```ts
const [searchQuery, setSearchQuery] = useState("");
```

`getNoteGraphAction` (Task 1) doesn't return tags yet, only `id`/`title`/`pinned`/`linkCount` — add tags there first since dimming needs them on each node.

In `src/lib/actions/notes.ts`, update `getNoteGraphAction`'s note query, mapped node, and declared return type together:

```ts
export async function getNoteGraphAction(): Promise<
  ActionResult<{
    nodes: { id: string; title: string; pinned: boolean; tags: string[]; linkCount: number }[];
    edges: { source: string; target: string }[];
  }>
> {
```

```ts
db.note.findMany({ where: { userId: user.id }, select: { id: true, title: true, pinned: true, tags: true } }),
```

```ts
nodes: notes.map((n) => ({
  id: n.id,
  title: n.title,
  pinned: n.pinned,
  tags: n.tags,
  linkCount: linkCounts.get(n.id) ?? 0,
})),
```

Back in `KnowledgeMap.tsx`, carry `tags` on `MapNode` and restore the `selectedTags` prop usage (dropped as unused in Task 3):

```ts
type MapNode = GraphNode & { title: string; tags: string[] };
```

```ts
export function KnowledgeMap({ selectedTags, onOpenNote }: KnowledgeMapProps) {
```

Add state, and a dimming predicate combining the tag filter with search (near the top of the component body, after the refs/state declarations):

```ts
const [searchQuery, setSearchQuery] = useState("");

const isDimmed = (node: MapNode): boolean => {
  const passesTagFilter = selectedTags.length === 0 || selectedTags.some((t) => node.tags.includes(t));
  const passesSearch = matchesSearchQuery(node.title, searchQuery);
  return !(passesTagFilter && passesSearch);
};
```

In the data-fetch effect (Task 3), add `tags: n.tags` to each mapped node object when building `nodesRef.current`.

**Fix a field-loss bug this introduces in Task 3's `tick` function.** Its node-reconstruction line currently only re-attaches `title`, which would silently drop the new `tags` field every frame:

```ts
// Before (Task 3) — drops tags:
nodesRef.current = updated.map((n, i) => ({ ...n, title: nodesRef.current[i].title }));

// After — preserve both fields not returned by stepSimulation:
nodesRef.current = updated.map((n, i) => ({
  ...n,
  title: nodesRef.current[i].title,
  tags: nodesRef.current[i].tags,
}));
```

Apply `isDimmed` in the per-frame tick loop (Task 3's `tick` function) and the focus-mode animation loop (Task 5's `animate` function):

In the Task 3 `tick` function, after setting each node's transform:

```ts
if (el) {
  el.setAttribute("transform", `translate(${n.x}, ${n.y})`);
  el.style.opacity = isDimmed(n) ? "0.15" : "1";
}
```

In the Task 5 `animate` function, combine dimming with focus-set membership (a node must be both in-focus-set and not dimmed to show fully):

```ts
const inFocusSet = !focusedNoteId || (neighborhood?.has(n.id) ?? false);
el.style.opacity = inFocusSet && !isDimmed(n) ? "1" : "0.05";
```

Add the search input and fly-to-focus trigger to the rendered JSX, next to the breadcrumb bar:

```tsx
<div className="absolute top-2 right-2 z-10 w-48">
  <input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    onKeyDown={(e) => {
      if (e.key !== "Enter") return;
      const match = nodesRef.current.find((n) => matchesSearchQuery(n.title, searchQuery));
      if (match) enterFocus(match);
    }}
    placeholder="Search notes..."
    className="w-full rounded border border-border bg-card px-2 py-1 text-xs"
  />
</div>
```

- [ ] **Step 7: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 8: Manual verification**

Run: `npm run dev`, open the Knowledge Map with several notes:
- Type part of a note's title into the search box — expect non-matching nodes to dim while you type.
- Press Enter with one match — expect it to enter Focus Mode centered on that note (same visual as clicking it).
- Select a tag filter chip on the List view, then switch to Knowledge Map — expect only notes with that tag to render at full opacity, others dimmed.

- [ ] **Step 9: Commit**

```bash
git add src/lib/actions/notes.ts src/components/notes/KnowledgeMap.tsx
git commit -m "feat: add search fly-to-focus and tag-filter dimming to the Knowledge Map"
```

---

## Task 7: Minimap

**Files:**
- Modify: `src/components/notes/KnowledgeMap.tsx`

**Interfaces:**
- No new exported interface — purely additive UI inside the existing component.

- [ ] **Step 1: Render the minimap panel**

Add near the bottom of `KnowledgeMap.tsx`'s returned JSX, as a sibling to the search box and breadcrumb (only shown in full-map mode, not inside Focus Mode):

```tsx
{!focusedNoteId && (
  <div
    className="absolute bottom-2 right-2 z-10 border border-border bg-card"
    style={{ width: 150, height: 100 }}
  >
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${bounds.width} ${bounds.height}`}
      onClick={(e) => {
        const svg = e.currentTarget;
        const rect = svg.getBoundingClientRect();
        const scaleX = bounds.width / rect.width;
        const scaleY = bounds.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;
        // Center the main view on the clicked minimap point.
        setTransform((t) => ({
          ...t,
          x: bounds.width / 2 - clickX * t.scale,
          y: bounds.height / 2 - clickY * t.scale,
        }));
      }}
      style={{ cursor: "pointer" }}
    >
      {nodesRef.current.map((node) => (
        <circle key={node.id} cx={node.x} cy={node.y} r={4} fill="var(--color-text-muted)" />
      ))}
      <rect
        x={-transform.x / transform.scale}
        y={-transform.y / transform.scale}
        width={bounds.width / transform.scale}
        height={bounds.height / transform.scale}
        fill="none"
        stroke="var(--color-primary-gold)"
        strokeWidth={2}
      />
    </svg>
  </div>
)}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run: `npm run dev`, open the Knowledge Map with enough notes to pan around:
- Confirm the minimap appears bottom-right showing dots for every node and a gold rectangle for the current viewport.
- Zoom/pan the main view — confirm the rectangle resizes/moves to match.
- Click elsewhere inside the minimap — confirm the main view pans to center that point.
- Enter Focus Mode (click a node) — confirm the minimap disappears.
- Exit Focus Mode — confirm the minimap reappears.

- [ ] **Step 4: Commit**

```bash
git add src/components/notes/KnowledgeMap.tsx
git commit -m "feat: add minimap to the Knowledge Map full-view mode"
```

---

## Spec Coverage Check

| Spec section | Covered by |
|---|---|
| §2 Data Model & Server Action | Task 1 |
| §3 Force Simulation | Task 2 |
| §4 Node Sizing | Task 3 (`nodeRadius`) |
| §5 Focus Mode | Task 5 |
| §6 Breadcrumb | Task 5 |
| §7 Minimap | Task 7 |
| §8 Search | Task 6 |
| §9 Tag Filter | Task 6 |
| §10 Rendering | Tasks 3, 5, 7 |
| §11 UI Integration | Task 3 (toggle) |
| §12 Error Handling | Task 3 (`status === "error"`, zero-notes state) |
| §13 Testing Strategy | Tasks 2, 4, 6 (`note-graph.test.ts`) |
