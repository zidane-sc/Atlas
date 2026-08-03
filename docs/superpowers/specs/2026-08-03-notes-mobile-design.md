# Notes editor mobile improvements — design

## Problem

`NoteEditor` (`src/components/notes/NoteEditor.tsx`) splits editor and preview
side by side via `flex-col md:flex-row`. Below `md`, both panes stack
vertically, each constrained to `min-h-[200px]`, forcing constant scrolling
and leaving little usable space for either pane. Toolbar buttons and the
table-size popup were sized/positioned for desktop and don't hold up on
narrow viewports.

Scope: `NoteEditor` and its direct subcomponents — `MarkdownToolbar`,
`MarkdownPreview` (usage only, no internal changes), `GamificationFooter`.
`NoteList`, `KnowledgeMap`, and `notes/page.tsx` are out of scope.

## 1. Tabbed editor/preview on mobile

Below `md`, replace the stacked split with a two-button tab bar — `📝 Editor`
/ `👁️ Preview` — styled like the existing List/Map toggle in
`src/app/(dashboard)/notes/page.tsx`. Only the active pane renders, so it
gets the full available height instead of a fixed `min-h-[200px]`.

At `md` and above, behavior is unchanged: both panes render side by side,
tab bar is hidden.

State: `mobileTab: "editor" | "preview"`, default `"editor"`. Local to
`NoteEditor`, not persisted across notes/sessions.

`MarkdownToolbar` renders only when the active mobile tab is `"editor"`
(mobile only); at `md+` it always renders above the editor pane as today.

## 2. Toolbar and footer touch targets

- `MarkdownToolbar` buttons: increase to `px-2.5 py-1.5` below `md`, keep
  `px-2 py-1` at `md+`. Sizing only, no behavior change.
- Table-size popup in `MarkdownToolbar`: currently `absolute top-full left-0`
  with `min-width: 240px`, which can overflow the right edge on narrow
  screens. Cap with a max-width relative to viewport
  (`max-w-[calc(100vw-2rem)]`) and flip anchoring so it stays on-screen on
  mobile.
- Task-picker and note-link-picker dropdowns: no change — already
  full-width of their parent container, which fits mobile.
- Tags/Links footer grid (`grid-cols-1 sm:grid-cols-2`): no change, already
  responsive.
- `GamificationFooter`: add `flex-wrap` (and center alignment as a wrap
  fallback) to the outer flex row so the three sections (spacer / XP /
  streak+word-count) don't clip on very narrow screens.

## Testing

Manual verification in browser at mobile viewport width (~375px) and at
`md+` width:
- Tab switch shows only one pane at a time on mobile, both panes side by
  side at `md+`.
- Toolbar only shows under Editor tab on mobile; always shows at `md+`.
- Toolbar buttons meet a comfortable tap size on mobile.
- Table popup stays fully on-screen when opened near the left edge on a
  narrow viewport.
- Gamification footer doesn't clip/overflow at 375px width.
