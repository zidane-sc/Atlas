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
