# Notes Editor UX Enhancement Design

**Date:** 2026-08-01  
**Status:** Design Approved  
**Purpose:** Redesign notes editor with split-pane preview, full markdown toolbar, and gamification to make markdown accessible for non-experts and feel integrated into game world.

---

## 1. Overview

Current notes editor is basic textarea with manual markdown. New design makes markdown editing approachable through toolbar assistance, live preview, and gamification feedback. Maintains Atlas retro/pixel aesthetic (dialogue-box styling, gold borders).

**Core changes:**
- Split pane: editor left, live preview right
- Toolbar: 15+ markdown buttons (bold, lists, emoji, checkboxes, etc.)
- Gamification: XP calculation + achievement tracking displayed real-time
- Styling: dialogue-box retro design (consistent with sidebar, cards)

---

## 2. Layout & Components

### Header Section
```
┌─────────────────────────────────────────────────────────┐
│ Title Input | Saved 3:42 PM  |  237 words  |  Close (✕) │
│ (gold 2px border, dark bg)                               │
└─────────────────────────────────────────────────────────┘
```

- Title input: full width, large font, auto-expand
- Status: "Saving...", "Saved HH:MM", or "Unsaved (will auto-save)"
- Word count: updated real-time
- Close button: hover effect, gold border

### Main Content: Split Pane

```
┌──────────────────────┬──────────────────────┐
│   EDITOR (LEFT)      │   PREVIEW (RIGHT)    │
│                      │                      │
│ [Toolbar]            │ [Rendered Markdown]  │
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │
│                      │                      │
│ [Textarea]           │ [Content Display]    │
│ (monospace)          │ (serif, readable)    │
│                      │                      │
│                      │                      │
└──────────────────────┴──────────────────────┘
```

**Editor (Left 50%):**
- Toolbar: 1 row of buttons (wraps on mobile)
- Textarea: monospace, dark bg, full height, scroll independently
- Cursor visible, line numbers optional

**Preview (Right 50%):**
- Live markdown rendering (debounced 300ms)
- Styled text: serif font, gold headings, proper spacing
- Horizontal divider: 1px gold line

**Divider:** 1px gold (#F0B429), draggable for resize (stretch editor/preview)

### Toolbar Layout

```
Row 1: [B] [I] [S] [Code]  |  [H1] [H2] [H3]  |  [Quote]  |  [•] [1.] [✓]
Row 2: [Link] [Table] [—]  |  [Emoji] [Undo] [Redo]
```

**Button Groups (with icons):**
- **Text Formatting** (4 buttons): Bold (B), Italic (I), Strikethrough (S), Inline Code (`)
- **Structure** (6 buttons): H1, H2, H3, Quote (>), Bullet List (•), Numbered List (1.), Checkbox (✓)
- **Advanced** (5 buttons): Link (🔗), Table (▦), Horizontal Line (—), Emoji Picker (😊)
- **Edit** (2 buttons): Undo (↶), Redo (↷)

**Behavior:**
- Click button → inserts markdown syntax at cursor position
- Multi-line selection → wraps selection with syntax (e.g., `**` before/after for bold)
- Emoji picker: modal/dropdown showing 30-50 common emojis (search optional)

### Footer Section

```
┌─────────────────────────────────────────────────────────┐
│ Tags: [tag1] [tag2]  |  +7 XP  ⭐ Scribe I  |  🔥 3-day │
│ [Add tag...]         |  237 words              streak    │
└─────────────────────────────────────────────────────────┘
```

**Left:** Tags input (existing functionality, inline add/remove)  
**Center:** XP display (real-time calculation, "+X XP" banner when content changes)  
**Right:** Achievement tracker + streak indicator

---

## 3. Gamification

### XP Calculation
```
Base XP = floor(word_count / 50)
- 1-50 words = 1 XP
- 51-100 words = 2 XP
- 101-150 words = 3 XP
(etc.)

Bonus: +2 XP if daily streak active
```

Real-time display: recalculate as user types, show "+X XP" feedback in footer.

### Achievements
- **Scribe I:** Create first note (50+ words) → unlock "Scribe" skill in character sheet
- **Scribe II:** Create 10 notes (500+ total words) → XP multiplier +1.1x for notes
- **Scribe III:** Create 50 notes → unlock "Scholar" companion mood
- **Daily Streak:** +1 per day a note is created (same as tasks)

Display in footer: "Scribe I (50 words)", "Scribe II (3/10 unlocked)", "Streak 3 days 🔥"

---

## 4. Styling (Dialogue-Box Retro)

**Colors:**
- Background: `var(--color-bg-panel)` (dark gray)
- Border: `var(--color-primary-gold)` (#F0B429), 2px
- Text: `var(--color-foreground)` (light)
- Hover: gold lighter, background darker

**Fonts:**
- Title: `font-display`, 18px
- Editor: `font-mono`, 14px, monospace
- Preview: serif (system serif fallback), 15px, line-height 1.6
- Toolbar buttons: `font-display`, 12px, px-2 py-1

**Button Styling:**
```css
button {
  border: 1px solid var(--color-primary-gold);
  background: var(--color-bg-panel);
  color: var(--color-primary-gold);
  padding: 4px 8px;
}

button:hover {
  background: var(--color-bg-panel-alt);
  border-color: var(--color-primary-gold);
}

button:active {
  background: var(--color-primary-gold);
  color: var(--color-bg-panel);
}
```

**Sections:** each wrapped in dialogue-box frame (2px gold border, padding, spacing)

---

## 5. Interactions & Edge Cases

**Toolbar Insertion Logic:**
- No selection: insert syntax at cursor (e.g., `**text**` for bold)
- Single line selected: wrap selection (e.g., `**selected text**`)
- Multi-line selected: wrap with syntax on each line (for lists) or entire block (for quotes)

**Preview Rendering:**
- Debounce markdown → HTML: 300ms (performance on large notes)
- Syntax errors: graceful degradation (show raw markdown if parsing fails)
- Links in preview: clickable but don't navigate (open in new tab or show URL tooltip)

**Auto-save:**
- On blur: 500ms debounce
- On tab close: save immediately
- Unsaved indicator: show "Unsaved" in header if changes pending

**Responsive:**
- Desktop: split pane (50/50)
- Tablet (< 900px): toolbar wraps, pane height reduces
- Mobile (< 600px): stack vertically (editor full, preview below), tap to toggle pane

---

## 6. Data & Server Integration

No backend changes. Existing server actions (`createNoteAction`, `updateNoteAction`) handle persistence.

XP calculation: **client-side only** (immediate feedback, no server call per keystroke)
Achievements: server-side check on save (query note count, word count from DB)

---

## 7. File Structure (UI Implementation)

**New/Modified files:**
- `src/components/notes/NoteEditor.tsx` — split pane, toolbar integration
- `src/components/notes/MarkdownToolbar.tsx` — toolbar buttons + emoji picker
- `src/components/notes/MarkdownPreview.tsx` — live preview rendering
- `src/components/notes/GamificationFooter.tsx` — XP + achievement display
- `src/lib/markdown.ts` — markdown syntax insertion helpers
- `src/lib/gamification.ts` — XP calculation for notes (add function)

---

## 8. Testing Strategy

**Unit tests:**
- Toolbar button insertion (bold, lists, emoji)
- XP calculation (various word counts)
- Achievement unlock logic

**Integration tests:**
- Editor → preview sync (render on change)
- Auto-save debounce
- Tag add/remove still works

**UI tests:**
- Split pane resizes correctly
- Mobile: stacked layout on small screens
- Toolbar wraps on narrow widths

---

## 9. Constraints & Decisions

**Markdown flavor:** GitHub-Flavored Markdown (GFM) — supports tables, strikethrough, checkboxes, emoji

**Preview library:** `react-markdown` with `remark-gfm` plugin (lightweight, no server-side rendering)

**Auto-save:** 500ms debounce to reduce server calls during typing

**No WYSIWYG:** Stay with markdown + toolbar. Full WYSIWYG would duplicate work (toolbar + visual editing) and bloat bundle.

**Retro aesthetic:** Consistent with Atlas dialogue-box design, not mimicking external code editors.
