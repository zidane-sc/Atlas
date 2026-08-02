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
