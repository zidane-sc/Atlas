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
