# Mobile-Responsive Sidebar & Layout

**Date:** 2026-08-03
**Status:** Approved

## Problem

`src/app/(dashboard)/layout.tsx` renders `<Sidebar />` next to the content area with no responsive branching and no header/topbar at all. `Sidebar.tsx` is hardcoded `w-52` (208px) with no collapse, no drawer, no mobile detection. On a ~375px phone viewport the sidebar alone eats over half the width and there is no way to hide it or reach navigation without it — the layout is not usable on mobile.

A secondary issue: `CharacterContent.tsx` has a no-wrap flex row (`Character.tsx:61`) holding a fixed avatar, a flexible middle block, and a `grid-cols-6` attribute grid (line 153) with no responsive override — it overflows/squashes on narrow screens. `tasks/page.tsx`'s tab strip has no horizontal-scroll handling for its 6 tabs on narrow screens.

Everything else audited (`projects/page.tsx`, `dashboard/page.tsx`, `FilteredView.tsx`, `AchievementsContent.tsx`, `StatisticsContent.tsx`, form sheets, `CommandPalette.tsx`, `KanbanBoard.tsx`) already uses mobile-first Tailwind grids or bounded widths and needs no change.

## Goal

- Sidebar collapsible on desktop (icon-rail) and available as a slide-in drawer on mobile, triggered by a hamburger button, with a backdrop.
- No existing page/component visibly breaks (overflow, squashed grid, unreachable nav) on a mobile viewport (~375px–414px wide).

## Breakpoint & Modes

Uses Tailwind's default `lg` (1024px) as the split:

- **`< lg` (mobile/tablet):** Sidebar renders as a fixed-position drawer, off-screen by default (`translate-x-[-100%]`), sliding in over a backdrop when opened. A new `MobileTopBar` (`lg:hidden`) sits above the content, showing a hamburger button + "⚔ ATLAS" wordmark — this is the only nav entry point below `lg` since no header currently exists.
- **`>= lg` (desktop):** Sidebar is static in the flex row (current behavior), with a new toggle button to collapse it to an icon-only rail. Collapse state persists across reloads (`localStorage`).

## State: `SidebarProvider`

New React context, `src/components/providers/SidebarProvider.tsx`, wrapping the dashboard body in `layout.tsx` (client-side, alongside the existing providers):

```ts
type SidebarContextValue = {
  collapsed: boolean;       // desktop icon-rail toggle, persisted
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;      // drawer open/closed, ephemeral
  setMobileOpen: (v: boolean) => void;
};
```

- `collapsed` initializes from `localStorage["atlas.sidebar.collapsed"]` (default `false`), and every change writes back.
- `mobileOpen` initializes `false`, is not persisted, and closes automatically on pathname change (`usePathname()` effect) — so navigating via a `Link` inside the drawer closes it.
- Also closes on `Escape` keydown and on backdrop click.

## Components

### `Sidebar.tsx` (modified)

- Reads `collapsed`, `mobileOpen`, `setMobileOpen` from `useSidebar()`.
- Root `<aside>` classes become responsive:
  - Base: `fixed inset-y-0 left-0 z-40 lg:static` with a transition on `transform`.
  - `< lg`: `w-64 -translate-x-full` when `!mobileOpen`, `translate-x-0` when `mobileOpen`. Full content always renders (same as today) inside the drawer — no icon-rail mode on mobile.
  - `>= lg`: `lg:translate-x-0` (always visible), width `lg:w-14` when `collapsed`, `lg:w-52` when not.
- When `collapsed` (desktop only — mobile drawer ignores this flag and always shows full content):
  - Header collapses to just the "⚔" glyph (drop wordmark/subtitle).
  - Hide the XP strip block (streak/coins/milestone), the search button, `GroupLabel`s, and nav item labels/badges — nav icons render alone, each keeping a native `title` attribute for a hover tooltip.
  - Hide the `Companion` widget.
  - "New Quest" / "Save & Quit" buttons collapse to icon-only (drop the text span).
- A collapse toggle button (`PanelLeftIcon` or similar from `lucide-react`, already a project dependency) sits in the header row, calling `setCollapsed(!collapsed)` — hidden on mobile (`hidden lg:flex`) since mobile has no icon-rail mode.
- Add a `< lg`-only backdrop: a fixed, full-screen semi-transparent `div` rendered when `mobileOpen`, `onClick` closes the drawer, sits at `z-30` (below the `z-40` drawer).

### `MobileTopBar.tsx` (new, client, `lg:hidden`)

- Renders in `layout.tsx` above `{children}`, only visible `< lg`.
- Hamburger button (`Menu` icon from `lucide-react`) calling `setMobileOpen(true)`, plus "⚔ ATLAS" wordmark, styled consistently with the existing pixel-border aesthetic (`border-b-2 border-border`, `--color-bg-panel-alt`).

### `layout.tsx` (modified)

```tsx
<SidebarProvider>
  <div className="flex h-full flex-1 flex-col overflow-hidden lg:flex-row">
    <Sidebar />
    <div className="flex flex-1 flex-col overflow-hidden">
      <MobileTopBar />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  </div>
</SidebarProvider>
```

## Other fixes

- `src/components/gamification/CharacterContent.tsx:61` — add `flex-wrap` to the outer row so the avatar/middle/right blocks stack instead of overflowing on narrow screens.
- `src/components/gamification/CharacterContent.tsx:153` — `grid-cols-6` → `grid-cols-3 sm:grid-cols-6` for the attribute tile grid.
- `src/app/(dashboard)/tasks/page.tsx` tab strip — add `overflow-x-auto` (and `whitespace-nowrap` on tab buttons) so the 6 tabs scroll horizontally on narrow screens instead of clipping/wrapping awkwardly.

## Out of scope

- No changes to `KanbanBoard.tsx` (existing `overflow-x-auto` on fixed-width columns is an acceptable swipe-to-scroll pattern on mobile).
- No changes to `projects/page.tsx`, `dashboard/page.tsx`, `FilteredView.tsx`, `AchievementsContent.tsx`, `StatisticsContent.tsx`, form sheets, `CommandPalette.tsx` — already mobile-first/bounded.
- No new dependencies (drawer/backdrop/transitions built with existing Tailwind + `lucide-react` icons already in use).

## Testing

- Manual resize check at ~375px, ~414px, ~768px, ~1024px, ~1280px: sidebar drawer opens/closes via hamburger + backdrop + Escape + route change; desktop collapse toggles icon-rail and survives reload; `CharacterContent` attribute grid wraps at `sm`; tasks tab strip scrolls instead of clipping.
- `npm run typecheck` / `npm run build` pass.
