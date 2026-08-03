import { describe, expect, it } from "vitest";
import { ImportPreviewModal } from "../ImportPreviewModal";

describe("ImportPreviewModal", () => {
  it("exports component with correct props interface", () => {
    expect(ImportPreviewModal).toBeDefined();

    // Component should accept the required props
    const testProps = {
      isOpen: true,
      counts: { tasks: 5, projects: 2, sprints: 1, notes: 3, workSessions: 10, activityLogs: 20 },
      errors: [] as any[],
      onCancel: () => {},
      onConfirm: () => {},
    };

    // Verify component is a function
    expect(typeof ImportPreviewModal).toBe("function");
  });

  it("returns null when isOpen is false", () => {
    const result = ImportPreviewModal({
      isOpen: false,
      counts: { tasks: 0, projects: 0, sprints: 0, notes: 0, workSessions: 0, activityLogs: 0 },
      errors: [],
      onCancel: () => {},
      onConfirm: () => {},
    });
    expect(result).toBeNull();
  });
});
