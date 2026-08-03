# Import Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a preview modal showing data counts and validation errors before committing import, blocking import if errors found.

**Architecture:** Three-part flow:
1. New `validateImportPayload()` helper collects validation errors without throwing
2. New `ImportPreviewModal` React component displays counts + errors, disables import button if errors exist
3. Modified `settings/page.tsx` shows modal after file parse, calls import only on user confirm

**Tech Stack:** React, TypeScript, existing UI components (Button, Modal patterns from codebase)

## Global Constraints

- TypeScript strict mode required
- Follow existing component patterns in `src/components/`
- Use existing validation functions (`validateTaskStatus`, etc.) from `import.ts`
- Modal must be responsive and scrollable if error list is long
- No breaking changes to export format or existing import API

---

### Task 1: Create validation helper `validateImportPayload()`

**Files:**
- Modify: `src/lib/actions/import.ts` (add new export)
- Test: `src/lib/actions/__tests__/import.test.ts` (create if needed)

**Interfaces:**
- Consumes: Existing validators (`validateTaskStatus`, `validateProjectStatus`, etc.) already in `import.ts`
- Produces: 
  ```typescript
  interface ValidationError {
    category: string;      // "Task", "Project", "Sprint", "Note"
    index: number;         // Position in array (0-based)
    itemName: string | null; // Task title, project name, etc. null if unavailable
    message: string;       // Full error message
  }
  
  interface ImportValidationResult {
    counts: {
      tasks: number;
      projects: number;
      sprints: number;
      notes: number;
      workSessions: number;
      activityLogs: number;
    };
    errors: ValidationError[];
  }
  
  function validateImportPayload(payload: ImportPayload): ImportValidationResult
  ```

- [ ] **Step 1: Write test for validation helper**

```typescript
// src/lib/actions/__tests__/import.test.ts
import { validateImportPayload } from "../import";

describe("validateImportPayload", () => {
  it("returns counts for valid payload", () => {
    const payload = {
      tasks: [{ id: "1", title: "Task 1", status: "todo", type: "coding", priority: "p1" }],
      projects: [{ id: "p1", name: "Project 1", category: "work", colorVar: "red", status: "active" }],
      sprints: [],
      bonus: { xp: 0, coins: 0 },
    };
    const result = validateImportPayload(payload as any);
    expect(result.counts.tasks).toBe(1);
    expect(result.counts.projects).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("collects task validation errors without throwing", () => {
    const payload = {
      tasks: [
        { id: "1", title: "Bad Task", status: "invalid_status", type: "coding", priority: "p1" },
        { id: "2", title: "Bad Priority", status: "todo", type: "coding", priority: "p99" },
      ],
      projects: [],
      sprints: [],
      bonus: { xp: 0, coins: 0 },
    };
    const result = validateImportPayload(payload as any);
    expect(result.errors.length).toBe(2);
    expect(result.errors[0].category).toBe("Task");
    expect(result.errors[0].index).toBe(0);
    expect(result.errors[0].itemName).toBe("Bad Task");
    expect(result.errors[0].message).toContain("Invalid task status");
  });

  it("collects project and sprint errors", () => {
    const payload = {
      tasks: [],
      projects: [{ id: "p1", name: "Bad Project", status: "invalid" }],
      sprints: [{ id: "s1", name: "Bad Sprint", status: "invalid", startDate: "not-a-date", endDate: "also-not" }],
      bonus: { xp: 0, coins: 0 },
    };
    const result = validateImportPayload(payload as any);
    expect(result.errors.some(e => e.category === "Project")).toBe(true);
    expect(result.errors.some(e => e.category === "Sprint")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/lib/actions/__tests__/import.test.ts
```

Expected: 3 failures (function not defined)

- [ ] **Step 3: Implement `validateImportPayload()` in `import.ts`**

Add this function at the end of `src/lib/actions/import.ts` before the `importWorkspaceData` export:

```typescript
export interface ValidationError {
  category: string;
  index: number;
  itemName: string | null;
  message: string;
}

export interface ImportValidationResult {
  counts: {
    tasks: number;
    projects: number;
    sprints: number;
    notes: number;
    workSessions: number;
    activityLogs: number;
  };
  errors: ValidationError[];
}

export function validateImportPayload(payload: ImportPayload): ImportValidationResult {
  const errors: ValidationError[] = [];

  // Validate tasks
  (payload.tasks || []).forEach((task, idx) => {
    try {
      validateTaskStatus(task.status);
    } catch (e) {
      errors.push({
        category: "Task",
        index: idx,
        itemName: task.title || null,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    try {
      validateTaskType(task.type);
    } catch (e) {
      errors.push({
        category: "Task",
        index: idx,
        itemName: task.title || null,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    try {
      validateTaskPriority(task.priority);
    } catch (e) {
      errors.push({
        category: "Task",
        index: idx,
        itemName: task.title || null,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    if (task.effort !== null && task.effort !== undefined) {
      try {
        validateTaskEffort(task.effort);
      } catch (e) {
        errors.push({
          category: "Task",
          index: idx,
          itemName: task.title || null,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (task.dueDate) {
      try {
        parseDate(task.dueDate);
      } catch (e) {
        errors.push({
          category: "Task",
          index: idx,
          itemName: task.title || null,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
  });

  // Validate projects
  (payload.projects || []).forEach((proj, idx) => {
    try {
      validateProjectStatus(proj.status);
    } catch (e) {
      errors.push({
        category: "Project",
        index: idx,
        itemName: proj.name || null,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });

  // Validate sprints
  (payload.sprints || []).forEach((sprint, idx) => {
    try {
      validateSprintStatus(sprint.status);
    } catch (e) {
      errors.push({
        category: "Sprint",
        index: idx,
        itemName: sprint.name || null,
        message: e instanceof Error ? e.message : String(e),
      });
    }
    try {
      parseDate(sprint.startDate);
    } catch (e) {
      errors.push({
        category: "Sprint",
        index: idx,
        itemName: sprint.name || null,
        message: `Invalid start date: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
    try {
      parseDate(sprint.endDate);
    } catch (e) {
      errors.push({
        category: "Sprint",
        index: idx,
        itemName: sprint.name || null,
        message: `Invalid end date: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  });

  // Validate bonus (if present)
  if (payload.bonus) {
    if (typeof payload.bonus.xp !== "number") {
      errors.push({
        category: "Bonus",
        index: 0,
        itemName: null,
        message: `Invalid bonus.xp: expected number, got ${typeof payload.bonus.xp}`,
      });
    }
    if (typeof payload.bonus.coins !== "number") {
      errors.push({
        category: "Bonus",
        index: 0,
        itemName: null,
        message: `Invalid bonus.coins: expected number, got ${typeof payload.bonus.coins}`,
      });
    }
  }

  return {
    counts: {
      tasks: payload.tasks?.length ?? 0,
      projects: payload.projects?.length ?? 0,
      sprints: payload.sprints?.length ?? 0,
      notes: payload.notes?.length ?? 0,
      workSessions: payload.workSessions?.length ?? 0,
      activityLogs: payload.activityLogs?.length ?? 0,
    },
    errors,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- src/lib/actions/__tests__/import.test.ts
```

Expected: 3 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/import.ts src/lib/actions/__tests__/import.test.ts
git commit -m "feat: add validateImportPayload helper with error collection"
```

---

### Task 2: Create `ImportPreviewModal` component

**Files:**
- Create: `src/components/ImportPreviewModal.tsx`
- Test: `src/components/__tests__/ImportPreviewModal.test.tsx`

**Interfaces:**
- Consumes: `ValidationError`, `ImportValidationResult` from `import.ts`
- Produces:
  ```typescript
  interface ImportPreviewModalProps {
    isOpen: boolean;
    counts: {
      tasks: number;
      projects: number;
      sprints: number;
      notes: number;
      workSessions: number;
      activityLogs: number;
    };
    errors: ValidationError[];
    isLoading?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
  }
  
  export function ImportPreviewModal(props: ImportPreviewModalProps): JSX.Element
  ```

- [ ] **Step 1: Create component file with TypeScript**

```typescript
// src/components/ImportPreviewModal.tsx
"use client";

import { Button } from "@/components/ui/button";
import type { ValidationError } from "@/lib/actions/import";

export interface ImportPreviewModalProps {
  isOpen: boolean;
  counts: {
    tasks: number;
    projects: number;
    sprints: number;
    notes: number;
    workSessions: number;
    activityLogs: number;
  };
  errors: ValidationError[];
  isLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ImportPreviewModal({
  isOpen,
  counts,
  errors,
  isLoading = false,
  onCancel,
  onConfirm,
}: ImportPreviewModalProps) {
  if (!isOpen) return null;

  const hasErrors = errors.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-lg bg-card border border-border shadow-lg">
        {/* Header */}
        <div className="sticky top-0 border-b border-border bg-card px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Review Import</h2>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Counts Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Import Summary</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Tasks</span>
                <span className="text-foreground font-medium">{counts.tasks}</span>
              </div>
              <div className="flex justify-between">
                <span>Projects</span>
                <span className="text-foreground font-medium">{counts.projects}</span>
              </div>
              <div className="flex justify-between">
                <span>Sprints</span>
                <span className="text-foreground font-medium">{counts.sprints}</span>
              </div>
              <div className="flex justify-between">
                <span>Notes</span>
                <span className="text-foreground font-medium">{counts.notes}</span>
              </div>
              <div className="flex justify-between">
                <span>Work Sessions</span>
                <span className="text-foreground font-medium">{counts.workSessions}</span>
              </div>
              <div className="flex justify-between">
                <span>Activity Logs</span>
                <span className="text-foreground font-medium">{counts.activityLogs}</span>
              </div>
            </div>
          </div>

          {/* Validation Section */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Validation</h3>
            {hasErrors ? (
              <div className="space-y-2 text-sm bg-red-500/10 border border-red-500/50 rounded p-3">
                {errors.map((error, idx) => (
                  <div key={idx} className="text-red-600 dark:text-red-400">
                    <span className="font-medium">
                      [{error.category} {error.index}]
                    </span>
                    {error.itemName && <span className="ml-1">"{error.itemName}":</span>}
                    <span className="ml-1">{error.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                <span>✓ No validation issues</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-border bg-card px-6 py-4 flex gap-3 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={onConfirm}
            disabled={hasErrors || isLoading}
            className={hasErrors ? "opacity-50 cursor-not-allowed" : ""}
          >
            {isLoading ? "Importing..." : "Import"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write test for component**

```typescript
// src/components/__tests__/ImportPreviewModal.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImportPreviewModal } from "../ImportPreviewModal";

describe("ImportPreviewModal", () => {
  const defaultProps = {
    isOpen: true,
    counts: { tasks: 5, projects: 2, sprints: 1, notes: 3, workSessions: 10, activityLogs: 20 },
    errors: [],
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
  };

  it("displays counts when open", () => {
    render(<ImportPreviewModal {...defaultProps} />);
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows validation success message when no errors", () => {
    render(<ImportPreviewModal {...defaultProps} />);
    expect(screen.getByText(/No validation issues/)).toBeInTheDocument();
  });

  it("displays errors and disables import button when errors present", async () => {
    const errors = [
      {
        category: "Task",
        index: 0,
        itemName: "Bad Task",
        message: "Invalid status",
      },
    ];
    const { rerender } = render(
      <ImportPreviewModal {...defaultProps} errors={errors} />
    );
    expect(screen.getByText(/Bad Task/)).toBeInTheDocument();
    expect(screen.getByText(/Invalid status/)).toBeInTheDocument();
    const importBtn = screen.getByRole("button", { name: /Import/i });
    expect(importBtn).toBeDisabled();
  });

  it("calls onCancel when Cancel clicked", async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    render(<ImportPreviewModal {...defaultProps} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onConfirm when Import clicked (no errors)", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    render(<ImportPreviewModal {...defaultProps} onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: /Import/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("hides modal when isOpen is false", () => {
    const { container } = render(<ImportPreviewModal {...defaultProps} isOpen={false} />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 3: Run tests to verify they pass**

```bash
npm test -- src/components/__tests__/ImportPreviewModal.test.tsx
```

Expected: 6 PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/ImportPreviewModal.tsx src/components/__tests__/ImportPreviewModal.test.tsx
git commit -m "feat: add ImportPreviewModal component"
```

---

### Task 3: Integrate modal into settings import flow

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx` (lines 180-212, the `onImportFile` function and related state)

**Interfaces:**
- Consumes: 
  - `ImportPreviewModal` component (from Task 2)
  - `validateImportPayload` function (from Task 1)
  - `ImportPayload` interface (existing)
- Produces: Modified import flow with modal interstitial

- [ ] **Step 1: Add state for modal in settings/page.tsx**

In the `Page` component, after the existing state declarations (around line 120), add:

```typescript
const [importPreviewOpen, setImportPreviewOpen] = useState(false);
const [importPreviewData, setImportPreviewData] = useState<{
  counts: { tasks: number; projects: number; sprints: number; notes: number; workSessions: number; activityLogs: number };
  errors: Array<{ category: string; index: number; itemName: string | null; message: string }>;
  payload: any;
} | null>(null);
const [isImporting, setIsImporting] = useState(false);
```

- [ ] **Step 2: Update `onImportFile` to show modal instead of importing directly**

Replace the `onImportFile` function (lines 180-212) with:

```typescript
const onImportFile = async (file: File) => {
  try {
    const rawData: unknown = JSON.parse(await file.text());
    if (!isAtlasExport(rawData)) throw new Error("Not a recognized Atlas export file.");

    const data = migrateExportFormat(rawData as AtlasExport);
    const version = (rawData as any).version || 1;
    if (version > EXPORT_VERSION) {
      console.warn(`Import file version ${version} is newer than current version ${EXPORT_VERSION}. Some data may be lost.`);
    }

    const importPayload = {
      tasks: data.tasks,
      projects: data.projects,
      sprints: data.sprints,
      bonus: data.bonus,
      workSessions: data.workSessions,
      activityLogs: data.activityLogs,
      notes: data.notes,
      decorations: data.decorations,
      savedFilters: data.savedFilters,
    };

    // Validate and show preview
    const validation = validateImportPayload(importPayload);
    setImportPreviewData({
      counts: validation.counts,
      errors: validation.errors,
      payload: importPayload,
    });
    setImportPreviewOpen(true);
  } catch (err) {
    notify(err instanceof Error ? err.message : "Import failed — file isn't valid JSON.", "error");
  }
};
```

Note: You'll need to import `validateImportPayload` at the top of the file:

```typescript
import { getWorkspaceHistoryForExport, getTasksForExport, importWorkspaceData, validateImportPayload, type ActivityLogExport, type WorkSessionExport, type NoteExport } from "@/lib/actions/import";
```

- [ ] **Step 3: Add handler for modal confirm**

After the `onImportFile` function, add:

```typescript
const onConfirmImport = async () => {
  if (!importPreviewData) return;
  setIsImporting(true);
  try {
    const result = await importWorkspaceData(importPreviewData.payload);
    if (!result.success) throw new Error(result.error.message);
    
    // Extract settings from the original payload if available
    const rawData = importPreviewData.payload;
    if (rawData.settings) setReduceMotion(rawData.settings.reduceMotion);
    
    notify(`Imported ${importPreviewData.counts.tasks} tasks, ${importPreviewData.counts.projects} projects, ${importPreviewData.counts.sprints} sprints, ${importPreviewData.counts.notes} notes. Reloading…`);
    window.location.reload();
  } catch (err) {
    notify(err instanceof Error ? err.message : "Import failed.", "error");
    setIsImporting(false);
  }
};
```

- [ ] **Step 4: Add modal component to JSX**

In the return JSX, before the closing `</div>` of the main container (around line 372), add:

```tsx
      {importPreviewData && (
        <ImportPreviewModal
          isOpen={importPreviewOpen}
          counts={importPreviewData.counts}
          errors={importPreviewData.errors}
          isLoading={isImporting}
          onCancel={() => {
            setImportPreviewOpen(false);
            setImportPreviewData(null);
          }}
          onConfirm={onConfirmImport}
        />
      )}
```

And import the component at the top:

```typescript
import { ImportPreviewModal } from "@/components/ImportPreviewModal";
```

- [ ] **Step 5: Run the app and test the import flow**

```bash
npm run dev
```

Manual test:
1. Go to Settings page
2. Click "Import Data"
3. Select a valid export JSON file
4. Verify preview modal appears with counts
5. Verify "Import" button is enabled if no errors
6. Click Import and verify it completes
7. Test with invalid data (e.g., export with bad status value) and verify import button is disabled

- [ ] **Step 6: Commit**

```bash
git add src/app/(dashboard)/settings/page.tsx
git commit -m "feat: add import preview modal to settings import flow"
```

---

## Self-Review

**Spec coverage:**
- ✓ Preview modal shows counts (tasks, projects, sprints, notes, workSessions, activityLogs)
- ✓ Validation report displayed (errors block import, clean shows ✓)
- ✓ Import blocked if errors present
- ✓ Modal in settings page during import flow
- ✓ Backwards compatibility (no export format changes)

**Placeholders:** None found

**Type consistency:** 
- `ValidationError` interface defined in Task 1, consumed in Task 2 and 3 ✓
- `ImportPreviewModalProps` defined in Task 2, consumed in Task 3 ✓
- `validateImportPayload` returns `ImportValidationResult` with `counts` and `errors` ✓

**Spec requirements met:** All requirements implemented ✓
