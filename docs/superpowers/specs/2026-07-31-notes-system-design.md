# Notes System Design

**Date:** 2026-07-31  
**Status:** Design Approved  
**Purpose:** Global notes system with task linking, markdown support, and tag-based organization

---

## 1. Overview

Notes is a standalone research/scratchpad system that captures findings, thoughts, and context independently, with optional bidirectional links to tasks. Solves the product requirement: "Investigation/research work and its findings get lost once the task is closed" (product.md §4).

**Dual use:**
- Research capture linked to multiple related tasks
- Standalone thinking space / scratchpad
- Markdown-rich with attachments
- Tag-based organization

---

## 2. Data Model

### `notes` Table

```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  userId UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,           -- Markdown
  tags JSONB DEFAULT '[]'::jsonb,  -- Array of tag strings: ["research", "blocked"]
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notes_userId ON notes(userId);
CREATE INDEX idx_notes_createdAt ON notes(createdAt DESC);
```

### `note_attachments` Table

```sql
CREATE TABLE note_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noteId UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,       -- File storage URL
  fileName VARCHAR(255) NOT NULL,
  fileType VARCHAR(50),            -- "image", "pdf", "code", etc.
  createdAt TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_note_attachments_noteId ON note_attachments(noteId);
```

### `note_task_links` Table (Many-to-Many)

```sql
CREATE TABLE note_task_links (
  noteId UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  taskId UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  createdAt TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (noteId, taskId)
);

CREATE INDEX idx_note_task_links_taskId ON note_task_links(taskId);
```

**Rationale:** Many-to-many allows one note to link to multiple tasks (e.g., research note used by 3 related tasks) and one task to have multiple notes. Bidirectional query support built in.

---

## 3. API / Server Actions

### Create Note

```typescript
createNoteAction(input: {
  title: string;          // Required, 1-255 chars
  content: string;        // Markdown, required
  tags?: string[];        // Optional tag array
  taskIds?: string[];     // Optional task IDs to link on creation
}): Promise<ActionResult<Note>>
```

**Behavior:**
- Validate title/content non-empty
- Insert note row
- If taskIds provided, insert into `note_task_links`
- Return full note object

---

### Update Note

```typescript
updateNoteAction(input: {
  noteId: string;
  title?: string;
  content?: string;
  tags?: string[];
  taskIds?: string[];     // Replace all links with these
}): Promise<ActionResult<Note>>
```

**Behavior:**
- Verify user owns note
- Update fields (skip if undefined)
- If taskIds provided, delete all existing links and insert new ones
- Return updated note

---

### Delete Note

```typescript
deleteNoteAction(noteId: string): Promise<ActionResult<void>>
```

**Behavior:**
- Verify user owns note
- Delete note (cascade: attachments, links)

---

### Get Note with Links & Attachments

```typescript
getNoteAction(noteId: string): Promise<ActionResult<{
  note: Note;
  attachments: Attachment[];
  linkedTasks: Task[];
}>>
```

**Behavior:**
- Fetch note + attachments + linked task objects
- Return combined response

---

### List Notes (with Search & Filter)

```typescript
listNotesAction(input: {
  search?: string;        // Full-text search in title + content
  tags?: string[];        // Filter by tags (AND logic: must have all)
  skip?: number;          // Pagination
  take?: number;
}): Promise<ActionResult<{
  notes: NotePreview[];
  total: number;
}>>
```

**Response shape (NotePreview):**
```typescript
{
  id: string;
  title: string;
  preview: string;        // First 50 chars of content
  tags: string[];
  createdAt: string;      // ISO string
  linkedTaskCount: number;
}
```

**Behavior:**
- Full-text search (PostgreSQL `ilike` on title + content)
- Filter by tags (all tags in input must be present)
- Pagination support
- Return previews only (not full markdown) for list performance

---

### Get Linked Notes for Task

```typescript
getTaskNotesAction(taskId: string): Promise<ActionResult<{
  notes: NotePreview[];
}>>
```

**Behavior:**
- Query `note_task_links` for taskId
- Join with notes, return previews

---

### Upload Attachment

```typescript
uploadNoteAttachmentAction(input: {
  noteId: string;
  file: File;             // FormData blob
}): Promise<ActionResult<Attachment>>
```

**Behavior:**
- Verify user owns note
- Upload to file storage (e.g., AWS S3, Vercel Blob, or local `/public/uploads`)
- Create `note_attachments` row
- Return attachment object with URL

---

## 4. UI Components

### Notes Page (`/notes`)

**Layout:**
- Header: "📝 NOTES" with "New Note" button
- Search bar: full-text search placeholder "Search notes..."
- Tag filter: multi-select dropdown, "Filter by tags"
- List: table-like rows (title, preview, tags, created date)
- Pagination controls (if 50+ notes)

**Row interactions:**
- Click row → opens Note Detail (side panel or modal)
- Delete icon → confirm delete

**New Note Button:**
- Opens Note Editor in modal or dedicated route (`/notes/new`)

---

### Note Detail / Editor

**Layout:**
- Header: title input field (auto-save)
- Main: markdown editor (left), live preview toggle (right)
- Sidebar (right):
  - Tags input (add/remove)
  - "Link to Tasks" picker (search + multi-select)
  - Attachments section (drag-drop upload + list)
  - Timestamps (Created: X, Updated: Y)
  - Save indicator (auto-save on blur, no manual save button)
  - Delete button

**Markdown Editor:**
- CodeMirror or similar (supports markdown syntax highlighting)
- "Preview" toggle shows rendered markdown
- Auto-save content on blur (debounced, 500ms)

**Task Picker:**
- Dropdown/modal: search for task by title
- Checkbox list: select multiple tasks
- Button: "Link to Selected"
- Shows currently linked task titles below

**Attachment Upload:**
- Drag-drop zone or file input
- Shows file name, size, upload progress
- List of attachments: name + download link + delete button

---

### Task Detail Panel Enhancement

**New Section: "Linked Notes" (collapsible)**

```
▶ Linked Notes (2)
  • Research findings on async patterns
  • Blocked waiting on design feedback
```

**Behavior:**
- Collapsible section (default closed or open based on context)
- Click note title → opens note in modal
- "Add/Link Note" button → opens task-linking picker
- Shows note title + first 30 chars of content

---

## 5. Search & Organization

**Full-Text Search:**
- Searches title + content (case-insensitive)
- Powered by PostgreSQL `ilike` or full-text index if needed later
- Result previews show matched context

**Tag Filtering:**
- Multi-select: user can pick multiple tags
- AND logic: note must have ALL selected tags
- Tag suggestions from notes already created

**Sort:**
- Default: created date (newest first)
- Toggle: oldest first, alphabetical by title

---

## 6. File Attachments Strategy

**Storage Options (pick one for v2):**

A) **Vercel Blob** — easiest, built-in to Next.js deployment  
B) **AWS S3** — scalable, but requires config  
C) **Local `/public/uploads`** — dev-friendly, suitable for personal app  

**Recommended:** Vercel Blob for simplicity, or local uploads for personal use.

**Limits:** 10MB per file, 50MB total per note (configurable).

---

## 7. Keyboard & Shortcuts

- `Cmd+N` / `Ctrl+N` → New note (from any page)
- `Cmd+Shift+N` → Open notes list
- `Esc` → Close note editor
- Tab/Shift+Tab → Navigate editor fields

---

## 8. Constraints & Decisions

**No real-time collab:** Notes are personal. Single-user only.

**No nested folders:** Tags are flat. Keeps UI simple.

**Markdown only:** No WYSIWYG. Simpler to store/sync/version.

**Auto-save:** No "save" button. Content persists on blur (debounced). Reduces friction.

**Bidirectional links:** One note can link to many tasks. Supports research sharing across related work.

---

## 9. Relationship to Obsidian

User maintains Obsidian as primary knowledge base (AI memory linking, long-form docs). Atlas Notes is orthogonal:
- Atlas Notes: task-linked research & project context
- Obsidian: personal knowledge base & AI memory

Notes can reference/link to Obsidian vault (user's responsibility), but no sync required.

---

## 10. Implementation Phases

**Phase 1 (v2.0):** Notes CRUD + search/tags + task linking  
**Phase 2 (future):** Markdown editor enhancements, syntax highlighting, code blocks  
**Phase 3 (future):** Export notes as markdown files, bulk operations

---

## 11. Testing Strategy

- Unit tests: Note CRUD actions (valid/invalid input)
- Integration tests: task linking (bidirectional queries)
- Search tests: full-text + tag filtering combinations
- UI tests: editor auto-save, attachment upload, tag picker
