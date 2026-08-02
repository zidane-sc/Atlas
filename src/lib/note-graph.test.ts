import { describe, expect, it } from "vitest";
import { stepSimulation, getNeighborhood, layoutRadial, matchesSearchQuery, type GraphNode, type GraphEdge } from "./note-graph";

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
