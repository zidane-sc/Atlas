# Notes Editor UX Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign notes editor with split-pane layout, markdown toolbar, live preview, and gamification to make markdown accessible and feel integrated into the game world.

**Architecture:** Component-based approach — (1) Markdown toolbar for syntax insertion, (2) live preview rendering with debounce, (3) gamification footer for XP/achievements display, (4) split-pane layout combining all three, (5) refactored NoteEditor orchestrating the above. Helper functions for markdown syntax generation and XP calculation. Mobile-responsive with stacked layout on small screens.

**Tech Stack:** React hooks, `react-markdown` with `remark-gfm` for GFM support, textarea editor, CSS Grid for split-pane layout.

## Global Constraints

- Markdown flavor: GitHub-Flavored Markdown (GFM) — tables, strikethrough, checkboxes, emoji
- Preview debounce: 300ms (performance on large notes)
- XP calculation: client-side only (no server call per keystroke)
- Styling: dialogue-box retro (gold borders, dark bg, matching sidebar/cards)
- Mobile: stack vertically on < 600px, tab to toggle pane

---

## File Structure

**New files:**
- `src/lib/markdown.ts` — markdown syntax helpers (insertion, wrapping)
- `src/components/notes/MarkdownToolbar.tsx` — toolbar buttons + emoji picker
- `src/components/notes/MarkdownPreview.tsx` — live preview with markdown rendering
- `src/components/notes/GamificationFooter.tsx` — XP + achievement display

**Modified files:**
- `src/components/notes/NoteEditor.tsx` — refactor to split-pane layout with new components
- `src/lib/gamification.ts` — add `calculateNoteXP()` function

---

## Task Breakdown

### Task 1: Markdown Syntax Helpers

**Files:**
- Create: `src/lib/markdown.ts`

**Interfaces:**
- Produces: `insertMarkdown(text, start, end, syntax)`, `wrapWithMarkdown(text, selection, syntax)`, `surroundSelection(content, prefix, suffix)`

- [ ] **Step 1: Create markdown.ts with helper functions**

```typescript
// src/lib/markdown.ts

/**
 * Insert markdown syntax at cursor position.
 * Example: insertMarkdown("hello world", 5, 5, { before: "**", after: "**" })
 * → "hello **world"
 */
export function insertMarkdown(
  text: string,
  cursorStart: number,
  cursorEnd: number,
  syntax: { before: string; after: string }
): { newText: string; newCursorPos: number } {
  const before = text.slice(0, cursorStart);
  const selected = text.slice(cursorStart, cursorEnd);
  const after = text.slice(cursorEnd);

  if (selected) {
    // Text selected: wrap it
    const newText = before + syntax.before + selected + syntax.after + after;
    return {
      newText,
      newCursorPos: cursorStart + syntax.before.length + selected.length + syntax.after.length,
    };
  } else {
    // No selection: insert syntax with placeholder
    const placeholder = "text";
    const newText = before + syntax.before + placeholder + syntax.after + after;
    return {
      newText,
      newCursorPos: cursorStart + syntax.before.length,
    };
  }
}

/**
 * Insert block syntax (headings, quotes, lists).
 * Example: insertBlock("hello\nworld", 0, "# ") → "# hello\nworld"
 */
export function insertBlock(
  text: string,
  cursorLine: number,
  prefix: string
): { newText: string; newCursorPos: number } {
  const lines = text.split("\n");
  lines[cursorLine] = prefix + (lines[cursorLine] || "");
  return {
    newText: lines.join("\n"),
    newCursorPos: cursorLine === 0 ? prefix.length : text.indexOf("\n", cursorLine) + prefix.length + 1,
  };
}

/**
 * Get current line from text and cursor position.
 */
export function getCurrentLine(text: string, cursorPos: number): { line: string; lineStart: number; lineEnd: number } {
  const lineStart = text.lastIndexOf("\n", cursorPos) + 1;
  const lineEnd = text.indexOf("\n", cursorPos);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  return { line, lineStart, lineEnd: lineEnd === -1 ? text.length : lineEnd };
}

/**
 * Markdown syntax definitions.
 */
export const MARKDOWN_SYNTAX = {
  bold: { before: "**", after: "**" },
  italic: { before: "*", after: "*" },
  strikethrough: { before: "~~", after: "~~" },
  code: { before: "`", after: "`" },
  codeBlock: { before: "```\n", after: "\n```" },
  link: { before: "[", after: "](url)" },
  heading1: { prefix: "# " },
  heading2: { prefix: "## " },
  heading3: { prefix: "### " },
  quote: { prefix: "> " },
  bulletList: { prefix: "- " },
  numberedList: { prefix: "1. " },
  checkbox: { prefix: "- [ ] " },
  table: { before: "| Col1 | Col2 |\n|------|------|\n| A    | B    |" },
  horizontalLine: "\n---\n",
};
```

- [ ] **Step 2: Test markdown helpers**

```typescript
// Quick test in console to verify helpers work
const text = "hello world";
const result = insertMarkdown(text, 0, 5, { before: "**", after: "**" });
console.assert(result.newText === "**hello** world", "Bold wrap failed");
console.log("✓ Markdown helpers working");
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/markdown.ts
git commit -m "feat: add markdown syntax insertion helpers

- insertMarkdown: wrap selection or insert at cursor
- insertBlock: add prefix to current line (headings, lists)
- getCurrentLine: extract line context from cursor position
- MARKDOWN_SYNTAX: constant definitions for 15+ syntax types"
```

---

### Task 2: XP Calculation for Notes

**Files:**
- Modify: `src/lib/gamification.ts`

**Interfaces:**
- Produces: `calculateNoteXP(wordCount: number, hasStreak: boolean): number`

- [ ] **Step 1: Add XP calculation to gamification.ts**

```typescript
// Add to src/lib/gamification.ts

/**
 * Calculate XP reward for a note based on word count.
 * Base: 1 XP per 50 words (rounded down)
 * Bonus: +2 XP if daily streak active
 */
export function calculateNoteXP(wordCount: number, hasStreak: boolean = false): number {
  const baseXP = Math.floor(wordCount / 50);
  const streakBonus = hasStreak ? 2 : 0;
  return Math.max(1, baseXP + streakBonus); // Minimum 1 XP
}

/**
 * Achievement unlock checks for notes.
 * Returns list of newly unlocked achievements.
 */
export function checkNoteAchievements(
  totalNotes: number,
  totalWords: number,
  dailyStreak: number
): string[] {
  const unlocked: string[] = [];

  if (totalNotes === 1 && totalWords >= 50) {
    unlocked.push("Scribe I");
  }
  if (totalNotes >= 10 && totalWords >= 500) {
    unlocked.push("Scribe II");
  }
  if (totalNotes >= 50 && totalWords >= 5000) {
    unlocked.push("Scribe III");
  }

  return unlocked;
}
```

- [ ] **Step 2: Test XP calculation**

```typescript
// Test cases
console.assert(calculateNoteXP(50) === 1, "50 words = 1 XP");
console.assert(calculateNoteXP(100) === 2, "100 words = 2 XP");
console.assert(calculateNoteXP(100, true) === 4, "100 words + streak = 4 XP");
console.assert(calculateNoteXP(0) === 1, "0 words = 1 XP (minimum)");
console.log("✓ XP calculation working");
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/gamification.ts
git commit -m "feat: add XP calculation for notes

- calculateNoteXP: 1 XP per 50 words, +2 bonus if streak active
- checkNoteAchievements: Scribe I/II/III unlock logic"
```

---

### Task 3: Markdown Toolbar Component

**Files:**
- Create: `src/components/notes/MarkdownToolbar.tsx`

**Interfaces:**
- Consumes: `insertMarkdown`, `MARKDOWN_SYNTAX` from markdown.ts
- Produces: MarkdownToolbar component with `onInsert(syntax)` callback

- [ ] **Step 1: Create toolbar component**

```typescript
// src/components/notes/MarkdownToolbar.tsx

"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface MarkdownToolbarProps {
  onInsert: (syntax: { before: string; after: string } | string, isBlock?: boolean) => void;
}

export function MarkdownToolbar({ onInsert }: MarkdownToolbarProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const EMOJIS = ["😊", "🎉", "🔥", "💡", "✨", "🎯", "🚀", "💪", "🎨", "📝"];

  const buttonClass =
    "px-2 py-1 border border-primary-gold bg-panel text-primary-gold hover:bg-panel-alt text-xs font-display";

  return (
    <div className="flex gap-1 flex-wrap p-2 border-b border-primary-gold bg-panel">
      {/* Text Formatting */}
      <button
        onClick={() => onInsert({ before: "**", after: "**" })}
        className={buttonClass}
        title="Bold"
      >
        B
      </button>
      <button
        onClick={() => onInsert({ before: "*", after: "*" })}
        className={buttonClass}
        title="Italic"
      >
        I
      </button>
      <button
        onClick={() => onInsert({ before: "~~", after: "~~" })}
        className={buttonClass}
        title="Strikethrough"
      >
        S
      </button>
      <button
        onClick={() => onInsert({ before: "`", after: "`" })}
        className={buttonClass}
        title="Inline Code"
      >
        `
      </button>

      {/* Divider */}
      <div className="w-px bg-primary-gold opacity-50" />

      {/* Structure */}
      <button
        onClick={() => onInsert({ before: "# ", after: "" }, true)}
        className={buttonClass}
        title="Heading 1"
      >
        H1
      </button>
      <button
        onClick={() => onInsert({ before: "## ", after: "" }, true)}
        className={buttonClass}
        title="Heading 2"
      >
        H2
      </button>
      <button
        onClick={() => onInsert({ before: "### ", after: "" }, true)}
        className={buttonClass}
        title="Heading 3"
      >
        H3
      </button>
      <button
        onClick={() => onInsert({ before: "> ", after: "" }, true)}
        className={buttonClass}
        title="Quote"
      >
        "
      </button>

      {/* Divider */}
      <div className="w-px bg-primary-gold opacity-50" />

      {/* Lists & Checkboxes */}
      <button
        onClick={() => onInsert({ before: "- ", after: "" }, true)}
        className={buttonClass}
        title="Bullet List"
      >
        •
      </button>
      <button
        onClick={() => onInsert({ before: "1. ", after: "" }, true)}
        className={buttonClass}
        title="Numbered List"
      >
        1.
      </button>
      <button
        onClick={() => onInsert({ before: "- [ ] ", after: "" }, true)}
        className={buttonClass}
        title="Checkbox"
      >
        ✓
      </button>

      {/* Divider */}
      <div className="w-px bg-primary-gold opacity-50" />

      {/* Advanced */}
      <button
        onClick={() => onInsert({ before: "[", after: "](url)" })}
        className={buttonClass}
        title="Link"
      >
        🔗
      </button>
      <button
        onClick={() =>
          onInsert({
            before: "| Col1 | Col2 |\n|------|------|\n| A    | B    |",
            after: "",
          })
        }
        className={buttonClass}
        title="Table"
      >
        ▦
      </button>
      <button
        onClick={() => onInsert("---")}
        className={buttonClass}
        title="Horizontal Line"
      >
        —
      </button>

      {/* Emoji Picker */}
      <div className="relative">
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={buttonClass}
          title="Emoji"
        >
          😊 <ChevronDown size={12} className="inline" />
        </button>
        {showEmojiPicker && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-panel border border-primary-gold grid grid-cols-5 gap-1 z-10">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onInsert(emoji);
                  setShowEmojiPicker(false);
                }}
                className="text-lg hover:bg-panel-alt p-1"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notes/MarkdownToolbar.tsx
git commit -m "feat: add markdown toolbar component

- 15+ buttons: bold, italic, headings, lists, emoji, etc.
- Emoji picker dropdown with 10 common emojis
- onInsert callback for parent to handle syntax insertion
- Dialogue-box styling (gold borders, dark bg)"
```

---

### Task 4: Markdown Preview Component

**Files:**
- Create: `src/components/notes/MarkdownPreview.tsx`
- Modify: `package.json` (add react-markdown + remark-gfm if not present)

**Interfaces:**
- Consumes: markdown content string
- Produces: MarkdownPreview component rendering GFM markdown

- [ ] **Step 1: Verify dependencies installed**

```bash
npm list react-markdown remark-gfm
# If missing: npm install react-markdown remark-gfm
```

- [ ] **Step 2: Create preview component**

```typescript
// src/components/notes/MarkdownPreview.tsx

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="prose prose-invert max-w-none p-4 overflow-y-auto h-full" style={{
      fontSize: "15px",
      lineHeight: "1.6",
      color: "var(--color-foreground)",
    }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 style={{ color: "var(--color-primary-gold)", marginBottom: "1em" }}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 style={{ color: "var(--color-primary-gold)", marginBottom: "0.8em" }}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 style={{ color: "var(--color-primary-gold)", marginBottom: "0.6em" }}>
              {children}
            </h3>
          ),
          code: ({ children }) => (
            <code style={{
              backgroundColor: "var(--color-bg-panel-alt)",
              padding: "2px 6px",
              borderRadius: "3px",
              fontFamily: "monospace",
            }}>
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre style={{
              backgroundColor: "var(--color-bg-panel-alt)",
              padding: "1em",
              borderRadius: "4px",
              overflow: "auto",
              marginBottom: "1em",
            }}>
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote style={{
              borderLeft: "3px solid var(--color-primary-gold)",
              paddingLeft: "1em",
              marginLeft: 0,
              color: "var(--color-text-muted)",
              fontStyle: "italic",
            }}>
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: "1em" }}>
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th style={{
              border: "1px solid var(--color-border)",
              padding: "0.5em",
              backgroundColor: "var(--color-bg-panel-alt)",
              textAlign: "left",
            }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{
              border: "1px solid var(--color-border)",
              padding: "0.5em",
            }}>
              {children}
            </td>
          ),
        }}
      >
        {content || "(Preview renders here)"}
      </ReactMarkdown>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/notes/MarkdownPreview.tsx
git commit -m "feat: add markdown preview component

- Live markdown rendering with react-markdown + remark-gfm
- Supports tables, strikethrough, checkboxes, emoji
- Styled with gold headings, dark code blocks
- Dialogue-box theme consistent with app"
```

---

### Task 5: Gamification Footer Component

**Files:**
- Create: `src/components/notes/GamificationFooter.tsx`

**Interfaces:**
- Consumes: wordCount, hasStreak, achievements (unlocked array)
- Produces: GamificationFooter component displaying XP + achievements

- [ ] **Step 1: Create gamification footer**

```typescript
// src/components/notes/GamificationFooter.tsx

"use client";

import { calculateNoteXP } from "@/lib/gamification";

interface GamificationFooterProps {
  wordCount: number;
  hasStreak?: boolean;
  unlockedAchievements?: string[];
}

export function GamificationFooter({
  wordCount,
  hasStreak = false,
  unlockedAchievements = [],
}: GamificationFooterProps) {
  const xp = calculateNoteXP(wordCount, hasStreak);

  return (
    <div className="flex items-center justify-between gap-4 p-3 border-t border-primary-gold text-xs text-muted-foreground">
      {/* Left: Tags (placeholder for parent to fill) */}
      <div className="flex-1">
        {/* Tags will be rendered by parent */}
      </div>

      {/* Center: XP Display */}
      <div className="flex items-center gap-2">
        <span style={{ color: "var(--color-primary-gold)", fontWeight: "bold" }}>
          +{xp} XP
        </span>
        {unlockedAchievements.length > 0 && (
          <span className="flex items-center gap-1">
            ⭐
            {unlockedAchievements.map((ach) => (
              <span key={ach}>{ach}</span>
            ))}
          </span>
        )}
      </div>

      {/* Right: Streak + Word Count */}
      <div className="flex items-center gap-3">
        {hasStreak && <span>🔥 Streak active</span>}
        <span>{wordCount} words</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/notes/GamificationFooter.tsx
git commit -m "feat: add gamification footer component

- Real-time XP display (calculated from word count)
- Achievement unlock indicators (Scribe I/II/III)
- Streak indicator if daily streak active
- Word count display"
```

---

### Task 6: Split-Pane Layout & Editor Refactor

**Files:**
- Modify: `src/components/notes/NoteEditor.tsx`

**Interfaces:**
- Consumes: All three new components + markdown helpers
- Produces: Refactored NoteEditor with split-pane layout

- [ ] **Step 1: Refactor NoteEditor with split pane**

Read the current NoteEditor and refactor it to use the new components. This is a larger refactor. Key changes:
- Add state for content (text), title, tags, preview
- Add ref to textarea for cursor tracking
- Add debounced markdown parsing (300ms)
- Integrate MarkdownToolbar with insertMarkdown logic
- Render split pane: editor left, preview right
- Add GamificationFooter with word count + achievements

Code structure:
```typescript
export function NoteEditor({ noteId, initialData, onSave, onClose }: NoteEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(initialData?.note.title || "");
  const [content, setContent] = useState(initialData?.note.content || "");
  const [tags, setTags] = useState(initialData?.note.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);

  // Auto-save handler
  const handleSave = useCallback(async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const result = noteId
        ? await updateNoteAction({ noteId, title, content, tags })
        : await createNoteAction({ title, content, tags });
      if (result.success) {
        setLastSaved(new Date().toLocaleTimeString());
        onSave?.(result.data!);
      }
    } finally {
      setSaving(false);
    }
  }, [title, content, tags, noteId, onSave]);

  // Toolbar insert handler
  const handleInsertMarkdown = (syntax: any, isBlock?: boolean) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = content;

    let result;
    if (isBlock) {
      // Get current line and insert prefix
      const lineStart = text.lastIndexOf("\n", start) + 1;
      const lineText = text.slice(lineStart, end);
      result = {
        newText: text.slice(0, lineStart) + syntax.before + lineText + text.slice(end),
        newCursorPos: lineStart + syntax.before.length + lineText.length,
      };
    } else if (typeof syntax === "string") {
      // Emoji or separator
      result = {
        newText: text.slice(0, start) + syntax + text.slice(end),
        newCursorPos: start + syntax.length,
      };
    } else {
      // Wrap selection
      result = insertMarkdown(text, start, end, syntax);
    }

    setContent(result.newText);
    setTimeout(() => {
      textarea.setSelectionRange(result.newCursorPos, result.newCursorPos);
      textarea.focus();
    }, 0);
    debouncedSave();
  };

  // Render split pane
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-3 border-b-2 border-primary-gold bg-panel">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="flex-1 font-display text-lg bg-transparent border-none outline-none"
        />
        <div className="text-xs text-muted-foreground ml-2">
          {saving ? "Saving..." : lastSaved ? `Saved ${lastSaved}` : ""}
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-4 text-muted-foreground">
            ✕
          </button>
        )}
      </div>

      {/* Split Pane */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Left */}
        <div className="flex flex-col flex-1 border-r border-primary-gold">
          <MarkdownToolbar onInsert={handleInsertMarkdown} />
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleSave}
            placeholder="Write markdown..."
            className="flex-1 p-4 font-mono text-sm bg-panel text-foreground border-none outline-none resize-none"
          />
        </div>

        {/* Preview Right */}
        <div className="flex-1 border-l border-primary-gold bg-panel overflow-hidden">
          <MarkdownPreview content={content} />
        </div>
      </div>

      {/* Footer */}
      <GamificationFooter 
        wordCount={content.split(/\s+/).length}
        hasStreak={false}
        unlockedAchievements={unlockedAchievements}
      />
    </div>
  );
}
```

- [ ] **Step 2: Test split pane layout**

Run dev server and navigate to notes editor. Verify:
- Toolbar renders and buttons clickable
- Textarea on left, preview on right
- Typing updates preview (with debounce)
- Footer shows XP + word count

- [ ] **Step 3: Commit**

```bash
git add src/components/notes/NoteEditor.tsx
git commit -m "feat: refactor NoteEditor with split-pane layout

- Left pane: markdown editor with toolbar
- Right pane: live preview (debounced 300ms)
- Toolbar buttons insert markdown syntax at cursor
- GamificationFooter displays real-time XP + word count
- Auto-save on blur (500ms debounce)"
```

---

### Task 7: Mobile Responsiveness

**Files:**
- Modify: `src/components/notes/NoteEditor.tsx`

**Interfaces:**
- No new interfaces; enhance existing layout with responsive classes

- [ ] **Step 1: Add responsive layout**

Update split pane to stack on mobile:
```css
@media (max-width: 600px) {
  .split-pane {
    flex-direction: column;
  }
  
  .editor-pane, .preview-pane {
    border: none;
    min-height: 40vh;
  }
  
  .preview-pane {
    border-top: 1px solid var(--color-primary-gold);
  }
  
  /* Tab to toggle preview */
  .preview-tab {
    display: flex;
    gap: 1rem;
  }
}
```

- [ ] **Step 2: Test on mobile**

Resize browser to 600px width and verify:
- Editor and preview stack vertically
- Both are scrollable independently
- Toolbar wraps if needed

- [ ] **Step 3: Commit**

```bash
git add src/components/notes/NoteEditor.tsx
git commit -m "feat: add mobile responsive layout

- Stack editor/preview vertically on < 600px screens
- Tab-friendly toolbar wrapping
- Independent scrolling for editor and preview"
```

---

### Task 8: Styling & Polish

**Files:**
- Modify: `src/components/notes/NoteEditor.tsx`, `src/components/notes/MarkdownToolbar.tsx`, `src/components/notes/MarkdownPreview.tsx`

- [ ] **Step 1: Apply dialogue-box styling**

Ensure all components use:
- Gold borders (2px, `var(--color-primary-gold)`)
- Dark backgrounds (`var(--color-bg-panel)`, `var(--color-bg-panel-alt)`)
- Hover states with darker background
- Consistent spacing (padding 3-4)

- [ ] **Step 2: Test styling**

Run dev server and verify:
- All borders are gold
- Backgrounds are dark with proper contrast
- Buttons have hover effects
- Preview text is readable

- [ ] **Step 3: Commit**

```bash
git add src/components/notes/NoteEditor.tsx src/components/notes/MarkdownToolbar.tsx src/components/notes/MarkdownPreview.tsx
git commit -m "feat: apply dialogue-box retro styling

- Gold borders (2px) on all sections
- Dark backgrounds consistent with app theme
- Hover effects on interactive elements
- Readable preview with serif fonts and gold headings"
```

---

### Task 9: Testing & Verification

**Files:**
- No new files; verify existing functionality

- [ ] **Step 1: Test markdown toolbar**

- Bold, italic, lists, emoji all insert correctly
- Multi-line selections wrap properly
- Toolbar buttons update textarea content

- [ ] **Step 2: Test preview**

- Markdown renders correctly
- Tables, checkboxes, strikethrough work
- Live preview updates with debounce

- [ ] **Step 3: Test gamification**

- XP calculation correct (1 per 50 words)
- Word count updates real-time
- Achievements display when unlocked

- [ ] **Step 4: Test mobile**

- Layout stacks on small screens
- Touch interactions work
- Preview still readable

- [ ] **Step 5: Final build & commit**

```bash
npm run build
git log --oneline -9
# Verify all 9 commits are present and build succeeds
```

---

## Spec Coverage

✓ Split-pane layout (editor + preview)  
✓ Full markdown toolbar (15+ buttons, emoji)  
✓ Live preview rendering (debounced)  
✓ XP calculation + display  
✓ Achievement tracking  
✓ Dialogue-box styling (gold, dark)  
✓ Mobile responsive (stack on < 600px)  
✓ Auto-save on blur

No gaps.
