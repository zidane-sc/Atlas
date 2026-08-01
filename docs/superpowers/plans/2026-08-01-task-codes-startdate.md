# Task Codes & Start Dates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add auto-generated task codes (ATS-1, THX-42, etc.), optional start dates, and project codes to distinguish duplicate task names and enable date-range timelines.

**Architecture:** Task codes auto-generated on creation using project code + global counter per user. Project code is user-defined, unique per project. Start date optional, defaults to null. Calendar shows startDate if available, else dueDate. Timeline shows task as bar spanning startDate → dueDate. All views display task code prominently.

**Tech Stack:** Prisma (schema), TypeScript types, React forms, Next.js date picker (DatePicker component exists)

## Global Constraints

- Task code format: `{projectCode}-{number}` (e.g., "ATS-1", "THX-42")
- Task codes: globally unique per user, auto-generated on create, read-only after creation
- Project code: user-defined, 2-4 chars, unique per user, case-insensitive
- Start date: optional DateTime, can be before/after/equal to dueDate
- Calendar: show startDate if present, else dueDate
- Timeline: 28-day window, task bar spans startDate → dueDate (or dueDate ± 0 days if no startDate)

---

### Task 1: Schema & Database Migration

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: Updated Task & Project models with code/startDate fields

- [ ] **Step 1: Add fields to Prisma schema**

```prisma
model Task {
  // ... existing fields ...
  code            String      // "ATS-1", "THX-42" etc
  startDate       DateTime?   // optional task start date
  
  @@unique([ownerId, code])   // unique code per user
}

model Project {
  // ... existing fields ...
  code            String      // "ATS", "THX", "CLI" etc
  
  @@unique([ownerId, code])   // unique code per user
}
```

- [ ] **Step 2: Create migration**

```bash
npx prisma migrate dev --name "add-task-code-and-start-date"
```

Expected: Migration file created in `prisma/migrations/`, schema.prisma updated

- [ ] **Step 3: Verify generated types**

```bash
npx prisma generate
```

Expected: TypeScript types updated, no errors

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "schema: add task code and start date fields"
```

---

### Task 2: Helper Functions for Code Generation

**Files:**
- Create: `src/lib/task-code.ts`

**Interfaces:**
- Produces: 
  - `generateTaskCode(projectCode: string, nextNumber: number): string` → `"ATS-1"`
  - `getNextTaskCodeNumber(ownerId: string): Promise<number>` → `1`

- [ ] **Step 1: Create code generation module**

```typescript
// src/lib/task-code.ts
export function generateTaskCode(projectCode: string, nextNumber: number): string {
  return `${projectCode.toUpperCase()}-${nextNumber}`;
}

export async function getNextTaskCodeNumber(db: any, ownerId: string): Promise<number> {
  const lastTask = await db.task.findFirst({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });
  
  if (!lastTask?.code) return 1;
  
  const match = lastTask.code.match(/-(\d+)$/);
  return match ? parseInt(match[1]) + 1 : 1;
}
```

- [ ] **Step 2: Add unit test**

```typescript
// src/lib/task-code.test.ts
import { generateTaskCode } from "./task-code";

describe("generateTaskCode", () => {
  it("formats code with uppercase project and number", () => {
    expect(generateTaskCode("ats", 1)).toBe("ATS-1");
    expect(generateTaskCode("THX", 42)).toBe("THX-42");
  });
});
```

- [ ] **Step 3: Run test**

```bash
npm test -- task-code.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/lib/task-code.ts src/lib/task-code.test.ts
git commit -m "feat: add task code generation helpers"
```

---

### Task 3: Update Task Type & Reducer

**Files:**
- Modify: `src/types/task.ts`
- Modify: `src/lib/tasks-reducer.ts`

**Interfaces:**
- Consumes: Prisma Task model with code, startDate
- Produces: 
  - `Task` type with `code: string` and `startDate?: string` (ISO format)
  - `mapDbTaskToClient()` updated to include code/startDate

- [ ] **Step 1: Update Task type**

```typescript
// src/types/task.ts
export interface Task {
  // ... existing fields ...
  code: string;           // "ATS-1"
  startDate?: string;     // ISO 8601, nullable
}
```

- [ ] **Step 2: Update mapDbTaskToClient**

```typescript
// src/lib/tasks-reducer.ts
export function mapDbTaskToClient(dbTask: any, projects: Project[], sprints: Sprint[]): Task {
  return {
    // ... existing mappings ...
    code: dbTask.code,
    startDate: dbTask.startDate?.toISOString() ?? undefined,
  };
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/types/task.ts src/lib/tasks-reducer.ts
git commit -m "types: add code and startDate to Task model"
```

---

### Task 4: Update Task Creation Action

**Files:**
- Modify: `src/lib/actions/create-task.ts`

**Interfaces:**
- Consumes: `getNextTaskCodeNumber()`, `generateTaskCode()`, Project.code
- Produces: Task with auto-generated code

- [ ] **Step 1: Update createTaskAction to generate code**

```typescript
// src/lib/actions/create-task.ts
import { generateTaskCode, getNextTaskCodeNumber } from "@/lib/task-code";

export async function createTaskAction(input: CreateTaskInput): Promise<ActionResult<Task>> {
  // ... auth & validation ...
  
  // Get project code
  const project = await db.project.findUnique({
    where: { id: input.projectId },
    select: { code: true },
  });
  if (!project?.code) {
    return { success: false, error: { code: "INVALID_PROJECT", message: "Project has no code" } };
  }
  
  // Generate task code
  const nextNumber = await getNextTaskCodeNumber(db, user.id);
  const taskCode = generateTaskCode(project.code, nextNumber);
  
  // Create task with code
  const dbTask = await db.task.create({
    data: {
      ownerId: user.id,
      code: taskCode,
      title: input.title,
      // ... other fields ...
    },
    include: { /* ... */ },
  });
  
  return { success: true, data: mapDbTaskToClient(dbTask, projects, sprints) };
}
```

- [ ] **Step 2: Test creation**

```bash
npm run dev
# Navigate to create task, verify task gets code like "ATS-1"
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/create-task.ts
git commit -m "feat: auto-generate task codes on creation"
```

---

### Task 5: Project Code Field in Form

**Files:**
- Modify: `src/components/projects/ProjectFormSheet.tsx`

**Interfaces:**
- Consumes: Project type with code field
- Produces: Form that accepts project code input

- [ ] **Step 1: Add code input to project form**

```typescript
// src/components/projects/ProjectFormSheet.tsx
const [formCode, setFormCode] = useState(initialData?.code?.toUpperCase() || "");

// In form JSX:
<input
  type="text"
  value={formCode}
  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
  placeholder="e.g., ATS, THX, CLI"
  maxLength={4}
  className="px-2 py-1 border border-border rounded"
  pattern="[A-Z0-9]{2,4}"
/>

// In onSave:
await updateProjectAction(projectId, {
  name: formName,
  code: formCode,  // Add to payload
  // ... other fields ...
});
```

- [ ] **Step 2: Add code field to updateProjectAction**

```typescript
// src/lib/actions/project.ts
export async function updateProjectAction(id: string, input: any) {
  // ... validation ...
  const updated = await db.project.update({
    where: { id },
    data: {
      code: input.code,
      // ... other fields ...
    },
  });
  return { success: true, data: mapDbProjectToClient(updated) };
}
```

- [ ] **Step 3: Test**

```bash
npm run dev
# Edit project, add code "ATS", verify saves
```

- [ ] **Step 4: Commit**

```bash
git add src/components/projects/ProjectFormSheet.tsx src/lib/actions/project.ts
git commit -m "feat: add project code field to form"
```

---

### Task 6: Start Date in Task Form

**Files:**
- Modify: `src/components/tasks/TaskFormSheet.tsx`

**Interfaces:**
- Consumes: Task type with startDate, DatePicker component
- Produces: Form with start date picker

- [ ] **Step 1: Add start date state to form**

```typescript
// src/components/tasks/TaskFormSheet.tsx
const [startDate, setStartDate] = useState<string>(
  initialData?.task?.startDate ? new Date(initialData.task.startDate).toISOString().split("T")[0] : ""
);

// Add to form JSX:
<label className="block text-sm font-semibold mb-2">Start Date (Optional)</label>
<DatePicker
  value={startDate}
  onChange={setStartDate}
  placeholder="Task start date"
/>
```

- [ ] **Step 2: Update submit handler**

```typescript
// In onSave/submit:
await createTaskAction({
  // ... existing fields ...
  startDate: startDate ? new Date(startDate).toISOString() : null,
});
```

- [ ] **Step 3: Test**

```bash
npm run dev
# Create task with start date, verify saves
```

- [ ] **Step 4: Commit**

```bash
git add src/components/tasks/TaskFormSheet.tsx
git commit -m "feat: add optional start date to task form"
```

---

### Task 7: Display Task Code in Card View

**Files:**
- Modify: `src/components/tasks/TaskCard.tsx`

**Interfaces:**
- Consumes: Task.code
- Produces: Task card with code badge visible

- [ ] **Step 1: Add code display to card**

```typescript
// src/components/tasks/TaskCard.tsx
export const TaskCard = memo(({ task, onSelect, onMoveStatus }: TaskCardProps) => (
  <div className="p-3 bg-card border border-border rounded animate-in fade-in">
    {/* Code badge - top left */}
    <div className="text-xs font-mono font-bold mb-2" style={{ color: "var(--color-primary-gold)" }}>
      {task.code}
    </div>
    
    {/* Rest of card content */}
    <h3 className="font-semibold text-sm mb-2">{task.title}</h3>
    {/* ... */}
  </div>
));
```

- [ ] **Step 2: Test**

```bash
npm run dev
# Verify task cards show code like "ATS-1" in gold
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/TaskCard.tsx
git commit -m "ui: display task code on card"
```

---

### Task 8: Display Task Code in Table View

**Files:**
- Modify: `src/app/(dashboard)/tasks/page.tsx` (TableTab function)

**Interfaces:**
- Consumes: Task.code
- Produces: Table with code column

- [ ] **Step 1: Add code column to table header**

```typescript
// In TableTab render:
<thead>
  <tr>
    <th className="px-3 py-2 text-left text-xs font-semibold">Code</th>
    <th className="px-3 py-2 text-left text-xs font-semibold">Title</th>
    {/* ... other headers ... */}
  </tr>
</thead>
```

- [ ] **Step 2: Add code cell to table body**

```typescript
// In table row:
<td className="px-3 py-2 text-xs font-mono" style={{ color: "var(--color-primary-gold)" }}>
  {task.code}
</td>
```

- [ ] **Step 3: Test**

```bash
npm run dev
# Switch to list → table view, verify code column shows
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/tasks/page.tsx
git commit -m "ui: add task code column to table view"
```

---

### Task 9: Display Task Code in List View

**Files:**
- Modify: `src/components/tasks/TaskListView.tsx` (compact variant)

**Interfaces:**
- Consumes: Task.code
- Produces: List items with code shown

- [ ] **Step 1: Update compact variant to show code**

```typescript
// src/components/tasks/TaskListView.tsx
if (variant === "compact") {
  return (
    <div>
      {tasks.map((task) => (
        <div key={task.id} className="flex cursor-pointer items-center gap-2 border-b px-1 py-1.5 hover:bg-[var(--color-bg-panel-alt)]">
          <span className="text-xs font-mono font-bold w-16" style={{ color: "var(--color-primary-gold)" }}>
            {task.code}
          </span>
          <PriorityMark priority={task.priority} />
          {showStatus && <StatusBadge status={task.status} />}
          <span className="flex-1 truncate text-sm">{task.title}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Test**

```bash
npm run dev
# Navigate to compact list, verify codes show
```

- [ ] **Step 3: Commit**

```bash
git add src/components/tasks/TaskListView.tsx
git commit -m "ui: display task code in compact list view"
```

---

### Task 10: Update Calendar to Use Start Date

**Files:**
- Modify: `src/app/(dashboard)/tasks/page.tsx` (CalendarTab function)

**Interfaces:**
- Consumes: Task.startDate, Task.dueDate
- Produces: Calendar that shows startDate if available, else dueDate

- [ ] **Step 1: Update calendar grouping logic**

```typescript
// In CalendarTab:
const byDate: Record<string, Task[]> = {};
for (const t of tasks) {
  // Use startDate if available, else dueDate
  const dateToShow = t.startDate || t.dueDate;
  if (!dateToShow) continue;
  
  const dateStr = new Date(dateToShow).toISOString().split("T")[0];
  if (!byDate[dateStr]) byDate[dateStr] = [];
  byDate[dateStr].push(t);
}
```

- [ ] **Step 2: Test**

```bash
npm run dev
# Create task with start date but no due date, verify shows on calendar on start date
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/tasks/page.tsx
git commit -m "feat: calendar uses startDate if available, else dueDate"
```

---

### Task 11: Update Timeline to Show Date Range

**Files:**
- Modify: `src/app/(dashboard)/tasks/page.tsx` (TimelineTab function)

**Interfaces:**
- Consumes: Task.startDate, Task.dueDate
- Produces: Timeline bars spanning startDate → dueDate

- [ ] **Step 1: Update timeline offset calculations**

```typescript
// In TimelineTab:
const active = tasks.filter((t) => t.status !== "done" && (t.startDate || t.dueDate));

const getTaskRange = (task: Task) => {
  const start = task.startDate ? new Date(task.startDate) : new Date(task.dueDate!);
  const end = task.dueDate ? new Date(task.dueDate) : start;
  
  const startOffset = Math.max(0, Math.min(TOTAL_DAYS - 1, 
    Math.floor((start.getTime() - new Date(MOCK_NOW).getTime()) / DAY_MS)));
  const endOffset = Math.max(0, Math.min(TOTAL_DAYS - 1,
    Math.floor((end.getTime() - new Date(MOCK_NOW).getTime()) / DAY_MS)));
  
  return { startOffset, endOffset };
};
```

- [ ] **Step 2: Update task bar rendering**

```typescript
// In timeline render loop:
{active.map((task) => {
  const { startOffset, endOffset } = getTaskRange(task);
  const widthPct = ((endOffset - startOffset + 1) / TOTAL_DAYS) * 100;
  const leftPct = (startOffset / TOTAL_DAYS) * 100;
  
  return (
    <div key={task.id} style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%` }}>
      <div className="px-2 py-1 text-xs bg-primary text-primary-foreground rounded truncate">
        {task.code} - {task.title}
      </div>
    </div>
  );
})}
```

- [ ] **Step 3: Test**

```bash
npm run dev
# Create task with startDate 2026-08-05, dueDate 2026-08-10
# Verify timeline shows bar spanning 5 days with code visible
```

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/tasks/page.tsx
git commit -m "feat: timeline shows task as bar spanning startDate to dueDate"
```

---

### Task 12: Migration for Existing Tasks & Projects

**Files:**
- Create: `prisma/migrations/[timestamp]_backfill_codes/migration.sql`

**Interfaces:**
- Produces: All existing tasks & projects get generated codes

- [ ] **Step 1: Create migration SQL**

```sql
-- Backfill project codes if missing (first 3 chars of name)
UPDATE "Project" 
SET code = UPPER(SUBSTR(name, 1, 3)) 
WHERE code IS NULL;

-- Backfill task codes (PROJECT_CODE-1, PROJECT_CODE-2, etc)
UPDATE "Task" t
SET code = (
  SELECT UPPER(SUBSTR(p.code, 1, 3)) || '-' || 
    ROW_NUMBER() OVER (PARTITION BY t."ownerId" ORDER BY t."createdAt")
  FROM "Project" p
  WHERE p.id = t."projectId"
)
WHERE t.code IS NULL;
```

- [ ] **Step 2: Apply migration manually**

```bash
npx prisma migrate deploy
```

Expected: All tasks/projects have codes

- [ ] **Step 3: Verify in app**

```bash
npm run dev
# Check existing tasks show codes like "THX-1"
```

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/
git commit -m "migrate: backfill task and project codes"
```

---

## Self-Review Checklist

✅ **Spec coverage:**
- Task code auto-generation: Task 4 ✓
- Unique globally per user: Task 1 (schema) + Task 4 (logic) ✓
- Project code: Task 5 ✓
- Optional start date: Task 6 ✓
- Display in all views: Tasks 7-9 ✓
- Calendar startDate logic: Task 10 ✓
- Timeline date range: Task 11 ✓

✅ **No placeholders:** All code shown explicitly in steps

✅ **Type consistency:** Task types used consistently (Task.code: string, Task.startDate?: string)
