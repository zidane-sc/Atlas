"use client";

import { useEffect, useRef, useState } from "react";
import { getNoteGraphAction } from "@/lib/actions/notes";
import { stepSimulation, getNeighborhood, layoutRadial, matchesSearchQuery, type GraphNode, type GraphEdge } from "@/lib/note-graph";

type MapNode = GraphNode & { title: string; tags: string[] };

const MIN_RADIUS = 6;
const MAX_RADIUS = 22;
const RADIUS_BASE = 6;
const RADIUS_SCALE = 3;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const KINETIC_ENERGY_STOP_THRESHOLD = 0.05;
// A large, mostly-disconnected graph (many isolated single-node notes with only center-gravity
// pulling them, no springs to dampen relative motion) can stay above the kinetic-energy
// threshold indefinitely — hard-cap the O(n²)-per-tick loop regardless of energy
// (docs/05-backlog.md §8 finding #14). ~10s at 60fps is well past what any real layout needs
// to visually settle.
const MAX_SIMULATION_TICKS = 600;

function nodeRadius(linkCount: number): number {
  const r = RADIUS_BASE + RADIUS_SCALE * Math.sqrt(linkCount);
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, r));
}

export interface KnowledgeMapProps {
  selectedTags: string[];
  onOpenNote: (noteId: string) => void;
}

export function KnowledgeMap({ selectedTags, onOpenNote }: KnowledgeMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<MapNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const nodeElRefs = useRef<Map<string, SVGGElement>>(new Map());
  const edgeElRefs = useRef<Map<number, SVGLineElement>>(new Map());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const touchRef = useRef<
    | { mode: "pan"; startX: number; startY: number; originX: number; originY: number }
    | { mode: "pinch"; startDist: number; startScale: number }
    | null
  >(null);

  const [bounds, setBounds] = useState({ width: 800, height: 600 });
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [focusedNoteId, setFocusedNoteId] = useState<string | null>(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState<{ id: string; title: string }[]>([]);
  const focusTransitionRef = useRef<number | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  // JSX only needs to mount the node/edge elements once (this app decided against saved-layout
  // persistence — the map recomputes each time it's opened). Reading nodesRef.current directly
  // in the render body would violate React's rules (refs shouldn't drive render); these two
  // state snapshots exist purely so the initial mount has something safe to map over, while the
  // physics/focus loops keep mutating nodesRef/edgesRef imperatively without triggering re-renders.
  const [renderNodes, setRenderNodes] = useState<MapNode[]>([]);
  const [renderEdges, setRenderEdges] = useState<GraphEdge[]>([]);

  const isDimmed = (node: MapNode): boolean => {
    const passesTagFilter = selectedTags.length === 0 || selectedTags.some((t) => node.tags.includes(t));
    const passesSearch = matchesSearchQuery(node.title, searchQuery);
    return !(passesTagFilter && passesSearch);
  };

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
        tags: n.tags,
        linkCount: n.linkCount,
        x: bounds.width / 2 + (Math.random() - 0.5) * 200,
        y: bounds.height / 2 + (Math.random() - 0.5) * 200,
        vx: 0,
        vy: 0,
      }));
      edgesRef.current = result.data.edges;
      setRenderNodes(nodesRef.current);
      setRenderEdges(edgesRef.current);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
    // Runs once on mount — bounds is only used to seed initial random positions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "ready" || focusedNoteId) return;

    let tickCount = 0;
    const tick = () => {
      tickCount++;
      const updated = stepSimulation(nodesRef.current, edgesRef.current, bounds);
      nodesRef.current = updated.map((n, i) => ({
        ...n,
        title: nodesRef.current[i].title,
        tags: nodesRef.current[i].tags,
      }));

      let kineticEnergy = 0;
      for (const n of nodesRef.current) kineticEnergy += n.vx * n.vx + n.vy * n.vy;

      for (const n of nodesRef.current) {
        const el = nodeElRefs.current.get(n.id);
        if (el) {
          el.setAttribute("transform", `translate(${n.x}, ${n.y})`);
          el.style.opacity = isDimmed(n) ? "0.15" : "1";
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

      if (kineticEnergy > KINETIC_ENERGY_STOP_THRESHOLD && tickCount < MAX_SIMULATION_TICKS) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [status, bounds, focusedNoteId]);

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

  const touchDistance = (a: React.Touch, b: React.Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touchRef.current = { mode: "pan", startX: t.clientX, startY: t.clientY, originX: transform.x, originY: transform.y };
    } else if (e.touches.length === 2) {
      touchRef.current = { mode: "pinch", startDist: touchDistance(e.touches[0], e.touches[1]), startScale: transform.scale };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const state = touchRef.current;
    if (!state) return;
    if (state.mode === "pan" && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - state.startX;
      const dy = t.clientY - state.startY;
      setTransform((prev) => ({ ...prev, x: state.originX + dx, y: state.originY + dy }));
    } else if (state.mode === "pinch" && e.touches.length === 2) {
      const dist = touchDistance(e.touches[0], e.touches[1]);
      const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.startScale * (dist / state.startDist)));
      setTransform((prev) => ({ ...prev, scale }));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      touchRef.current = null;
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      touchRef.current = { mode: "pan", startX: t.clientX, startY: t.clientY, originX: transform.x, originY: transform.y };
    }
  };

  const enterFocus = (node: MapNode) => {
    if (focusedNoteId === node.id) return;
    setBreadcrumbPath((prev) => {
      const existingIndex = prev.findIndex((p) => p.id === node.id);
      if (existingIndex !== -1) {
        return prev.slice(0, existingIndex + 1);
      }
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

  useEffect(() => {
    if (status !== "ready") return;

    const startPositions = new Map(nodesRef.current.map((n) => [n.id, { x: n.x, y: n.y }]));
    const neighborhood = focusedNoteId ? getNeighborhood(focusedNoteId, edgesRef.current, 2) : null;
    const targetPositions = focusedNoteId && neighborhood ? layoutRadial(focusedNoteId, neighborhood, edgesRef.current, bounds) : null;

    const duration = 300;
    const startTime = performance.now();

    const animate = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - (1 - t) * (1 - t);

      for (const n of nodesRef.current) {
        const start = startPositions.get(n.id)!;
        const target = targetPositions?.get(n.id) ?? start;
        n.x = start.x + (target.x - start.x) * eased;
        n.y = start.y + (target.y - start.y) * eased;

        const el = nodeElRefs.current.get(n.id);
        if (el) {
          el.setAttribute("transform", `translate(${n.x}, ${n.y})`);
          const inFocusSet = !focusedNoteId || (neighborhood?.has(n.id) ?? false);
          el.style.opacity = inFocusSet && !isDimmed(n) ? "1" : "0.05";
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

  useEffect(() => {
    if (!focusedNoteId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") exitFocus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedNoteId]);

  // The organic tick loop stops once the layout settles (no more animation frames), and the
  // focus-mode transition only runs for ~300ms — neither picks up a search/tag change made
  // afterward. Apply dimming directly here so it updates immediately regardless of loop state.
  useEffect(() => {
    if (status !== "ready") return;
    const neighborhood = focusedNoteId ? getNeighborhood(focusedNoteId, edgesRef.current, 2) : null;
    for (const n of nodesRef.current) {
      const el = nodeElRefs.current.get(n.id);
      if (!el) continue;
      const inFocusSet = !focusedNoteId || (neighborhood?.has(n.id) ?? false);
      el.style.opacity = inFocusSet && !isDimmed(n) ? "1" : focusedNoteId ? "0.05" : "0.15";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags, searchQuery, focusedNoteId, status]);

  if (status === "loading") {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading knowledge map…</div>;
  }
  if (status === "error") {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Could not load the knowledge map.</div>;
  }
  if (renderNodes.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No notes yet.</div>;
  }

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ backgroundColor: "var(--color-bg-deep)" }}>
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
      <svg
        width="100%"
        height="100%"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={(e) => {
          if (e.target === e.currentTarget && focusedNoteId) exitFocus();
        }}
        style={{ cursor: "grab", touchAction: "none" }}
      >
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {renderEdges.map((edge, i) => (
            <line
              key={i}
              ref={(el) => {
                if (el) edgeElRefs.current.set(i, el);
              }}
              stroke="var(--color-foreground)"
              strokeWidth={1.5}
              opacity={0.5}
            />
          ))}
          {renderNodes.map((node) => {
            const isFocused = node.id === focusedNoteId;
            return (
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
                <title>{node.title} — double-click to open</title>
                <circle
                  r={nodeRadius(node.linkCount)}
                  fill="var(--color-bg-panel)"
                  stroke={
                    isFocused
                      ? "white"
                      : node.pinned
                        ? "var(--color-primary-gold)"
                        : "var(--color-border)"
                  }
                  strokeWidth={isFocused ? 3 : 2}
                />
                <text y={nodeRadius(node.linkCount) + 14} textAnchor="middle" fontSize={11} fill="var(--color-text-muted)">
                  {node.title.length > 20 ? node.title.slice(0, 20) + "…" : node.title}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
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
              setTransform((t) => ({
                ...t,
                x: bounds.width / 2 - clickX * t.scale,
                y: bounds.height / 2 - clickY * t.scale,
              }));
            }}
            style={{ cursor: "pointer" }}
          >
            {renderNodes.map((node) => (
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
    </div>
  );
}
