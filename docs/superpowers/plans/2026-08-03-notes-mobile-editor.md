# Notes Editor Mobile Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the notes editor (`NoteEditor` and its subcomponents) usable on mobile — replace the squeezed stacked editor/preview split with a tab switch, and fix touch-target/overflow issues in the toolbar and gamification footer.

**Architecture:** Pure CSS/JSX changes to three existing client components — no new files, no new dependencies, no server/data-layer changes. `NoteEditor` gains one piece of local UI state (`mobileTab`) that controls which pane's container div is `hidden` vs `flex`/`block` via Tailwind responsive classes; at `md` and above both panes stay visible via the existing `md:flex` / `md:block` overrides, so desktop behavior is byte-for-byte unchanged.

**Tech Stack:** Next.js (client components), React `useState`, Tailwind CSS utility classes. No test framework changes — this repo's Vitest setup runs in `environment: "node"` with no `@testing-library/react`/jsdom, so these presentational changes are verified manually in a browser (per project convention for UI/frontend work), not via new automated tests.

## Global Constraints

- Repo: `/home/imyourdream/Work/self-project/atlas`. Base directory for all paths below.
- No new npm dependencies.
- Do not change desktop (`md:` and up) visual behavior — every change must be additive/mobile-scoped (`max-md` via default + `md:` overrides).
- Follow existing Tailwind + inline-`style` CSS-variable pattern already used in these files (e.g. `style={{ borderColor: "var(--color-primary-gold)" }}`) — don't introduce a different styling approach.
- Match the existing List/Map tab-toggle visual style from `src/app/(dashboard)/notes/page.tsx:133-151` for the new Editor/Preview tab bar.
- After each task: run `npm run lint` and manually verify in the browser via `npm run dev` at a ~375px mobile viewport width and at a `md+` (≥768px) width.

---

### Task 1: Mobile tab switch for editor/preview split

**Files:**
- Modify: `src/components/notes/NoteEditor.tsx:293-360` (return block: header + split pane)

**Interfaces:**
- Consumes: existing `handleInsertMarkdown`, `content`, `setContent`, `debouncedSave`, `handleAutoSave`, `textareaRef` — all already defined earlier in this file, unchanged.
- Produces: new local state `mobileTab: "editor" | "preview"` (`useState<"editor" | "preview">("editor")`), scoped entirely to `NoteEditor` — no other task or file reads it.

- [ ] **Step 1: Add `mobileTab` state**

In `src/components/notes/NoteEditor.tsx`, find the existing state declarations (around line 44-52, right after `const [isLoading, ...]`). Add:

```tsx
  const [mobileTab, setMobileTab] = useState<"editor" | "preview">("editor");
```

- [ ] **Step 2: Insert the mobile tab bar**

In the same file, find the `{/* Split Pane */}` comment (line 328). Immediately **before** it (i.e., right after the closing `</div>` of the header block, before the split-pane div), insert:

```tsx
      {/* Mobile Editor/Preview Tabs */}
      <div className="flex md:hidden border-b-2" style={{ borderColor: "var(--color-primary-gold)" }}>
        <button
          type="button"
          onClick={() => setMobileTab("editor")}
          className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-display transition-colors ${
            mobileTab === "editor" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
          }`}
        >
          📝 Editor
        </button>
        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-display transition-colors ${
            mobileTab === "preview" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-accent"
          }`}
        >
          👁️ Preview
        </button>
      </div>

```

- [ ] **Step 3: Toggle the editor pane's visibility by `mobileTab`**

Find the editor pane container (line 331):

```tsx
        <div className="flex flex-col flex-1 min-h-0 border-b-2 md:border-b-0 md:border-r-2" style={{ borderColor: "var(--color-primary-gold)" }}>
```

Replace with:

```tsx
        <div className={`${mobileTab === "editor" ? "flex" : "hidden"} md:flex flex-col flex-1 min-h-0 border-b-2 md:border-b-0 md:border-r-2`} style={{ borderColor: "var(--color-primary-gold)" }}>
```

This hides the entire editor pane — including `MarkdownToolbar` and the `textarea`, since both live inside this div — when `mobileTab !== "editor"` on mobile, and always shows it at `md:` and up (satisfying "toolbar only visible under Editor tab on mobile, always visible at `md+`" without any separate toolbar-specific change).

- [ ] **Step 4: Toggle the preview pane's visibility by `mobileTab`**

Find the preview pane container (line 352):

```tsx
        <div className="flex-1 min-h-0 md:border-l-2 overflow-hidden" style={{ borderColor: "var(--color-primary-gold)" }}>
```

Replace with:

```tsx
        <div className={`${mobileTab === "preview" ? "block" : "hidden"} md:block flex-1 min-h-0 md:border-l-2 overflow-hidden`} style={{ borderColor: "var(--color-primary-gold)" }}>
```

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open a note in the editor (`/notes` → create or open a note).

At a ~375px-wide viewport:
- Only the Editor pane is visible by default; the tab bar shows "Editor" highlighted.
- Typing in the textarea works as before (autosave, toolbar inserts).
- Clicking "Preview" hides the editor (and its toolbar) and shows the rendered markdown preview, filling the available height (no more tiny 200px box).
- Clicking "Editor" switches back.

At a ≥768px-wide viewport:
- Tab bar is not visible (`md:hidden`).
- Editor and preview render side by side exactly as before this change.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: no new errors in `src/components/notes/NoteEditor.tsx`.

- [ ] **Step 7: Commit**

```bash
git add src/components/notes/NoteEditor.tsx
git commit -m "feat: add mobile tab switch for notes editor/preview split"
```

---

### Task 2: Toolbar button tap-size on mobile

**Files:**
- Modify: `src/components/notes/MarkdownToolbar.tsx:50-51`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing consumed elsewhere — purely a class-name change to the shared `buttonClass` string already used by every toolbar button in this file.

- [ ] **Step 1: Widen tap targets below `md`**

In `src/components/notes/MarkdownToolbar.tsx`, find:

```tsx
  const buttonClass =
    "px-2 py-1 border-2 border-gray-400 bg-panel text-foreground hover:bg-panel-alt active:border-primary-gold active:text-primary-gold text-xs font-display transition-colors";
```

Replace with:

```tsx
  const buttonClass =
    "px-2.5 py-1.5 md:px-2 md:py-1 border-2 border-gray-400 bg-panel text-foreground hover:bg-panel-alt active:border-primary-gold active:text-primary-gold text-xs font-display transition-colors";
```

- [ ] **Step 2: Manual verification**

With `npm run dev` running, open a note editor at a ~375px viewport. Confirm toolbar buttons (B, I, S, `` ` ``, H1, H2, H3, etc.) are visibly larger/easier to tap than before, and shrink back to the original compact size at ≥768px.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/notes/MarkdownToolbar.tsx
git commit -m "fix: bigger toolbar tap targets on mobile in notes editor"
```

---

### Task 3: Clamp the table-size popup to the viewport on mobile

**Files:**
- Modify: `src/components/notes/MarkdownToolbar.tsx:191`

**Interfaces:**
- Consumes: existing `showTablePicker` state, unchanged.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Reposition/clamp the popup**

In `src/components/notes/MarkdownToolbar.tsx`, find the table-size popup container:

```tsx
            <div className="absolute top-full left-0 mt-2 p-3 border-2 border-gray-500 rounded-lg z-50 shadow-lg" style={{ minWidth: "240px", backgroundColor: "var(--color-bg-panel-alt)" }}>
```

Replace with:

```tsx
            <div className="absolute top-full left-1/2 -translate-x-1/2 md:left-0 md:translate-x-0 mt-2 p-3 border-2 border-gray-500 rounded-lg z-50 shadow-lg max-w-[calc(100vw-2rem)]" style={{ minWidth: "240px", backgroundColor: "var(--color-bg-panel-alt)" }}>
```

Below `md`, this centers the popup horizontally under its trigger button rather than anchoring hard-left (which could push it off-screen when the table button wraps to a non-left position in the toolbar's `flex-wrap` row), and caps its width to the viewport minus a 2rem margin. At `md:` and up, behavior is unchanged (`left-0`, no translate).

- [ ] **Step 2: Manual verification**

At a ~375px viewport, open a note editor, tap the table button (▦) in the toolbar. Confirm the size-picker popup stays fully on-screen (no horizontal scrollbar, no clipped edge) regardless of where the button landed in the wrapped toolbar row. At ≥768px, confirm the popup still opens anchored to the button's left edge as before.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/notes/MarkdownToolbar.tsx
git commit -m "fix: keep table-size popup on-screen on mobile in notes toolbar"
```

---

### Task 4: Prevent gamification footer clipping on narrow screens

**Files:**
- Modify: `src/components/notes/GamificationFooter.tsx:19-21`

**Interfaces:**
- Consumes: existing `xp`, `unlockedAchievements`, `hasStreak`, `wordCount` — unchanged.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Allow wrapping and hide the empty spacer on mobile**

In `src/components/notes/GamificationFooter.tsx`, find:

```tsx
    <div className="flex items-center justify-between gap-4 p-3 border-t border-gray-600 text-xs text-muted-foreground bg-panel">
      {/* Left: Tags placeholder */}
      <div className="flex-1" />
```

Replace with:

```tsx
    <div className="flex items-center justify-center sm:justify-between flex-wrap gap-2 sm:gap-4 p-3 border-t border-gray-600 text-xs text-muted-foreground bg-panel">
      {/* Left: Tags placeholder */}
      <div className="hidden sm:block flex-1" />
```

The spacer only exists to balance `justify-between` at wider widths (pushing XP to true center against an empty left column); on mobile it's hidden so `justify-center` centers the two real content groups (XP, and streak+word-count) with `flex-wrap` as a fallback for very narrow widths instead of clipping.

- [ ] **Step 2: Manual verification**

At a ~375px viewport, open a note editor and confirm the "+XP" and "N words" footer content is fully visible, centered, and wraps to a second line rather than clipping if it doesn't fit on one. At ≥640px (`sm:`), confirm the original spacer/center/right three-column layout is unchanged.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/notes/GamificationFooter.tsx
git commit -m "fix: prevent gamification footer clipping on narrow screens"
```
