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
