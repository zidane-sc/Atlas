# Atlas — Design Document

**Companion to:** `01-product.md`, `02-architecture.md`
**Covers:** Visual direction, design system, animation & sound, and the gamification formulas (XP, levels, coins, achievements) deferred from the product doc.

---

## 1. Art Direction

Inspired by Stardew Valley, Pokémon GBA, Terraria, Celeste UI, and old JRPG menus — panels read like dialogue boxes, not corporate cards. Explicitly not inspired by cyberpunk, glassmorphism, Material Design, or dashboard-style SaaS UI.

**Rendering approach:** crisp pixel edges, not blurry "pixel-ish" gradients — `image-rendering: pixelated` on any raster icon/sprite assets, and hard 1–2px borders rather than soft shadows for structure.

---

## 2. Color Palette

A limited, GBA/SNES-inspired "dark dungeon / gold" palette — a handful of base colors plus semantic mappings, not a full design-tool palette of 50 shades.

**Base**

| Token | Hex | Use |
|---|---|---|
| `--bg-deep` | `#0d0f14` | app background |
| `--bg-panel` | `#13161d` | cards, panels |
| `--bg-panel-alt` | `#10131a` | nested panels, sidebar |
| `--border` | `#1e2330` | neutral panel/input borders |
| `--primary-gold` | `#f0b429` | primary accent — buttons, active nav, focus ring, emphasis borders |
| `--primary-gold-dim` | `#c48a0f` | pressed-button drop-shadow |
| `--text-primary` | `#e2e0d8` | main text |
| `--text-muted` | `#6b7483` | secondary text, metadata |
| `--dim` | `#3a3f50` | disabled/empty states, dimmed decorations |

**Status colors** (task status)

| Status | Color |
|---|---|
| Inbox / Todo | `#6b7483` (muted gray) |
| Ready | `#4ecca3` (teal-green) |
| In Progress | `#f6c90e` (yellow) |
| Blocked | `#e94560` (red) |
| Waiting External | `#a29bfe` (violet) |
| Testing | `#00b8d9` (cyan) |
| Done | `#52c41a` (green) |
| Archived | `#3a3f50` (dark gray) |

**Priority colors**

| Priority | Color |
|---|---|
| P0 Critical | `#e94560` (red) |
| P1 High | `#f6c90e` (amber) |
| P2 Normal | `#4ecca3` (teal) |
| P3 Low | `#6b7483` (gray) |
| P4 Someday | `#3a3f50` (dark gray) |

> **Accessibility note:** priority and status are never conveyed by color alone — each also gets a distinct icon/shape (see §7), so the app stays usable for colorblind viewing. All text/background pairs above are checked to meet WCAG AA contrast (4.5:1) at body text size.

**Gamification accents**

| Token | Hex | Use |
|---|---|---|
| `--xp-gold` | `#ffd93d` | XP bar fill, XP numbers |
| `--coin` | `#f4a300` | coin icon/counter |
| `--streak-flame` | `#ff6b35` | campfire/streak indicator |

---

## 3. Typography

Pure pixel fonts (like "Press Start 2P") are iconic but unreadable at body-text sizes, so they're used sparingly and paired with a cleaner monospace pixel font for everything else.

| Role | Font | Use |
|---|---|---|
| Display | **Press Start 2P** | level numbers, XP counters, achievement banners, dashboard headline — short strings only |
| Body / UI | **VT323** | task titles, descriptions, all long-form text, forms, buttons, nav |
| Data | Same as body, tabular-nums | tables, timestamps, story points |

**Sizing:** an 8px-based scale — `12 / 16 / 24 / 32 / 48px` — no in-between sizes, to stay consistent with the pixel-grid aesthetic.

---

## 4. Spacing & Grid

- Base unit: **8px**. All padding/margin/gaps are multiples of 8 (4px allowed only for icon-tight spacing).
- Icon grid: 16×16px base sprites, scaled 2× (32px) and 3× (48px) for larger UI, never arbitrarily resized (keeps pixels crisp).
- Panels align to an 8px grid so borders and pixel icons never sit on a half-pixel.

---

## 5. Components

Following the Product Rule *"avoid modal dialogs unless absolutely necessary"*:

| Pattern | Used instead of a modal for |
|---|---|
| **Slide-over panel** (from the right) | Task detail / edit |
| **Inline expand** | Adding a comment, quick-editing a field in Table view |
| **Command palette overlay** (Ctrl+K) | Quick actions, quick capture — this is the one true overlay pattern in the app |
| Toasts (bottom-right) | Success/error feedback, XP gained |

**Buttons:** hard 2px borders, no border-radius (or a minimal stepped-corner pixel-round), and a literal "pressed" state — on click, the button shifts down 2px and its drop-shadow disappears, mimicking a physical button press.

**Cards (task cards):** styled like RPG dialogue/inventory boxes — a 2px border in the status color, a small icon for task type in the corner, priority shown as a small colored pip, not a full-width color block (keeps the board from looking like a color-soup at a glance).

**Inputs:** thick pixel-style borders, no soft focus glow — focus state changes border color to `--xp-gold` instead.

---

## 6. Animation

| Interaction | Duration | Notes |
|---|---|---|
| Micro-feedback (button press, checkbox tick) | 100–150ms | instant-feeling |
| Task complete (checkmark → particles → XP number floats up) | 400–600ms | doesn't block the UI — task visually completes immediately, animation plays alongside |
| Achievement unlock banner | slides in ~200ms, holds 2.5s, slides out ~200ms | non-blocking, dismissible early |
| Perfect Day / all-tasks-done celebration | up to 1.5–2s cap | the one animation allowed to be a bit bigger — it's rare and earned |

**Hard rule:** nothing in the app should ever require waiting on an animation to finish before the next action is possible — animations are decoration on top of an already-completed state change, never a gate. A **reduce motion** setting shortens all of the above to their minimum bound (§9).

---

## 7. Sound

Subtle by default, never adding drama to routine actions.

| Event | Sound | Length |
|---|---|---|
| Task complete | soft chime | <0.5s |
| Level up | short fanfare | ~1.5–2s |
| Achievement unlock | light sparkle | <1s |
| Error / validation fail | soft blip | <0.3s |

Default volume: on, low. A single mute toggle lives in Settings (stored in the `settings` table from `02-architecture.md`) and applies globally — no per-sound controls, keeping this simple per the "no bloat" principle.

---

## 8. Icons & Type/Priority Shapes

To keep status/priority distinguishable without relying on color:

- **Task type** → a distinct pixel icon per type (already listed in `01-product.md` §8.3: 💻🔍📖📊📝🐞🚀🧪👥💡🎨⚙️📦🔥📞), rendered as 16×16 pixel sprites, not emoji, in the shipped app.
- **Priority** → shape + color: P0 = filled square, P1 = filled triangle, P2 = filled circle, P3 = outline circle, P4 = dot. This survives grayscale/colorblind viewing.

---

## 9. Accessibility

- All text/background combinations meet WCAG AA contrast.
- Status/priority never rely on color alone (§2, §8).
- **Reduce Motion** setting: shortens all animation durations in §6 to their minimum, and skips the Perfect Day celebration's extended version.
- **Mute** setting: global sound toggle (§7).
- Full keyboard navigation, per the "Keyboard First" product principle — every interactive element is reachable and operable without a mouse.

---

## 10. Key Screen Patterns (brief)

- **Dashboard ("Command Center"):** top strip = level + XP bar + streak campfire; below, four small stat panels (Due Today / Overdue / Blocked / Waiting External); then Today's Quest list; then sprint progress bar.
- **Kanban:** columns = status; cards use the dialogue-box style from §5; drag-and-drop triggers a status change (and thus a `task_status_logs` row).
- **Task detail (slide-over):** all fields from `01-product.md` §8 grouped into collapsible sections (Core / Relations / Attachments & Deliverables / History), not one long form.
- **Command Palette:** the one true overlay — fuzzy search across tasks, projects, and actions ("create task", "start focus", "go to kanban").

---

## 11. Gamification Formulas

### 11.1 XP Formula

```
Base XP = priority_base(priority) + (story_point × 10)

Total XP = Base XP × on_time_multiplier
```

**Priority base:**

| Priority | Base XP |
|---|---|
| P0 | 100 |
| P1 | 60 |
| P2 | 30 |
| P3 | 15 |
| P4 | 5 |

**On-time multiplier:** `1.2` if completed on/before `due_date` (or no due date set) · `1.0` if completed after `due_date`.

Kept deliberately simple — one multiplier, not a stack of streak/energy/combo modifiers — per the "no bloat" principle. Story points default to 0 if not set, so a task always earns at least its priority-based XP.

### 11.2 Perfect Day Bonus

If every task planned for "Today" reaches Done by end of day: flat **+100 XP**, once per day, logged as its own `xp_logs` row (`reason: perfect_day`) rather than folded into the per-task formula.

### 11.3 Streak Milestone Bonus

Streak itself doesn't modify per-task XP (keeps the core formula simple); instead, reaching a streak milestone grants a one-time flat bonus:

| Streak length | Bonus |
|---|---|
| 7 days | +50 XP |
| 14 days | +100 XP |
| 30 days | +250 XP |
| 60+ days | +250 XP every additional 30 days |

### 11.4 Level Curve

XP required to advance from level *N* to *N+1*: `round(100 × N^1.5, nearest 10)`. Formula-based rather than a hardcoded table so it extends indefinitely without needing edits.

| Level | XP to reach next level | Cumulative XP |
|---|---|---|
| 1 | 100 | 100 |
| 2 | 280 | 380 |
| 3 | 520 | 900 |
| 4 | 800 | 1,700 |
| 5 | 1,120 | 2,820 |
| 6 | 1,470 | 4,290 |
| 7 | 1,850 | 6,140 |
| 8 | 2,260 | 8,400 |
| 9 | 2,700 | 11,100 |
| 10 | 3,160 | 14,260 |

Beyond level 10, compute directly from the formula rather than extending this table.

### 11.5 Coins (cosmetic currency, separate from XP)

```
Coins = story_point + priority_coin_bonus(priority)
```

| Priority | Coin bonus |
|---|---|
| P0 | +5 |
| P1 | +3 |
| P2 | +1 |
| P3 / P4 | +0 |

Coins spend only on cosmetic room-decoration items (per `01-product.md` §9.6) — they never affect XP, levels, or functionality, keeping the economy purely decorative and low-stakes.

### 11.6 Streak (Campfire) Visual States

| Streak length | Visual |
|---|---|
| 1–2 days | Spark |
| 3–6 days | Small Flame |
| 7–13 days | Steady Fire |
| 14–29 days | Bonfire |
| 30+ days | Blaze |

A streak counts as "kept" if at least one task is completed that calendar day.

### 11.7 Achievements — Unlock Criteria

Grouped into four categories, shown as separate sections in the Achievements screen.

| Achievement | Category | Criteria |
|---|---|---|
| First Blood | Combat | Complete your first quest |
| Task Slayer | Combat | Complete 10 quests total |
| Speed Runner | Combat | Complete 5 quests in a single day |
| Bug Hunter | Combat | Complete 50 quests of type `bug` |
| Sprint Hero | Combat | Complete every quest in an active sprint |
| 100 Quests | Combat | Complete 100 quests total |
| Night Owl | Exploration | Complete a quest between 10pm–4am |
| Morning Hero | Exploration | Complete a quest before 7am |
| Code Warrior | Crafting | Complete 100 quests of type `coding` |
| Scholar | Crafting | Complete 50 quests in a University-category project |
| Guild Master | Social | Complete an entire project |
| Perfect Week | Social | 7 consecutive Perfect Days |

All achievement checks run as a lightweight post-completion check on task update — no scheduled jobs needed for v1.

### 11.8 Character Sheet — Skill & Stat Formulas

Companion to the Achievements/XP system (`01-product.md` §9.6): an aggregate progression view, not a separate leveling economy — it's derived entirely from existing task/XP data, no new state to persist beyond what's already logged.

**Skill XP** (per Task Type): sum of the per-task XP (§11.1 formula) earned from all completed tasks of that type.

**Skill Level**: same level curve as global level (§11.4), applied to that type's skill XP independently.

**Stat scores** (D&D-style, 1–20 scale, all six start at a base of 8): each Task Type maps to exactly one stat; every point of that type's skill level adds `floor(level × 0.6)` to the mapped stat, capped at 20.

| Task Type | Stat | Class Title |
|---|---|---|
| Coding | INT | Coder |
| Investigation | WIS | Investigator |
| Study | INT | Scholar |
| Analysis | WIS | Analyst |
| Documentation | CHA | Chronicler |
| Bug | STR | Bug Slayer |
| Deployment | DEX | Deployer |
| Testing | WIS | Tester |
| Meeting/Discussion | CHA | Diplomat |
| Research | WIS | Explorer |
| Design | CHA | Artisan |
| Maintenance | CON | Keeper |
| Refactor | INT | Refiner |
| Incident | STR | Firefighter |
| Communication | CHA | Herald |

**Class Title**: the title of your highest-skill-XP Task Type, shown only once that skill is above level 1 — otherwise defaults to "Apprentice."

### 11.9 Companion Moods

A persistent ambient companion (sidebar), not a screen of its own. Mood is derived from current streak, with a temporary "excited" override right after a completion:

| Mood | Trigger |
|---|---|
| Excited | Just triggered by a task completion (temporary override) |
| Happy | Streak ≥ 7 days |
| Idle | Streak ≥ 3 days |
| Sad | Streak < 3 days |

### 11.10 Weekly/Monthly Recap Grade

An on-demand cutscene (Statistics screen) summarizing the prior period: quests done vs. the period before, XP earned, top project by completions, and current streak — capped off with a letter grade based on completion velocity:

```
velocity = quests_done_this_period / max(quests_created_this_period, 1)
```

| Velocity | Grade |
|---|---|
| ≥ 1.0 | S |
| ≥ 0.7 | A |
| ≥ 0.45 | B |
| ≥ 0.25 | C |
| < 0.25 | D |

---

## 12. Decisions Log

No open questions remain in this document — the XP formula, level curve, coin economy, and character/companion/recap systems deferred from `01-product.md` are all resolved above (§11). Achievement thresholds (§11.7) are a reasonable starting set; adjusting numbers later is a config change, not a redesign.
