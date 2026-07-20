# Design System Inspired by Fund Signal Workbench

Dashboard & Productivity — Deep dark high-contrast theme for a quantitative fund signal workbench. Bloomberg Terminal meets modern dev-tool aesthetic: monospace-first typography, right angles, blue-cyan accent, signal-coded status colors.

## 1. Visual Theme & Atmosphere

Dark, high-contrast, terminal-inspired. Near-black backgrounds (`#0D0D11`) with clean white text (`#EDEDF0`). Inspired by Bloomberg Terminal's information density and TradingView's dark-mode data visualization. No decorative elements — every pixel serves the data. Right angles throughout.

- Visual style: dark, high-contrast, data-dense, terminal
- Color stance: restrained, blue-cyan accent, signal-coded status colors
- Design intent: keep outputs recognizable to this style while preserving usability and readability. The tool should disappear into the task.

## 2. Color

- **Primary:** `#2B7FFF` — blue-cyan accent for interactive elements, links, selected states
- **Secondary:** `#1A5FCC` — darker variant for hover/active states
- **Success / Buy:** `#26C99E` — cyan-green for buy signals
- **Warning / Hold:** `#BBB440` — amber for hold signals
- **Danger / Sell:** `#E8844A` — warm orange for sell signals
- **Surface:** `#16161D` — card/panel surface
- **Text:** `#EDEDF0` — primary body text
- **Neutral:** `#16161D` (derived from surface token)

Favor Primary for CTA emphasis and interactive states. Use Surface for large backgrounds and cards. Keep body copy on Text for legibility.

Signal colors (Success/Warning/Danger) must use shape + color dual encoding — not color alone. Each signal has a subtle background tint variant for table rows.

## 3. Typography

- **Scale:** `12/14/16/18/20/28/36` (tight product scale)
- **Primary:** `JetBrains Mono, SF Mono, Fira Code, Consolas, monospace` — single monospace stack for all UI text
- **Display:** same as primary (one-family system)
- **Weights:** `300/400/500/700` — no weight variability beyond these four
- Line length: prose capped at 75ch; data tables unrestricted (horizontal scroll expected)
- Headings carry data hierarchy via weight and size, not face changes

## 4. Spacing & Grid

4px base unit. Consistent vertical rhythm.

- Scale: `4/8/12/16/24/32/48`
- Align columns and modules to predictable 4px grid; avoid ad-hoc offsets
- Section padding (vertical): desktop 48px, tablet 32px, phone 24px

## 5. Layout & Composition

Full-height sidebar + main content area (terminal-inspired two-column layout). Navigation left, content right.

- Hierarchy: signal badge → fund name → data → action
- Use whitespace to separate concerns before adding borders or shadows
- Data tables with minimal chrome — no alternating row colors, thin borders
- No hero sections, no decorative illustrations, no cards as default container

## 6. Components

- **Buttons:** flat, zero border-radius, outlined variant for secondary. Primary action uses Primary color, secondary actions stay neutral (border + transparent bg).
- **Inputs:** dark surface background (`#1F1F29`), thin border on focus, clear labels, predictable error messaging.
- **Signal badges:** compact, shape + color coded. Buy = cyan-green circle, Sell = warm-orange downward triangle, Hold = amber square.
- **Data tables:** sticky headers, horizontal scroll, monospace data cells, right-aligned numeric columns. No alternating row colors.
- **Sidebar:** full-height left panel, thin right border, nav item hover state, active item highlighted with accent.

## 7. Motion & Interaction

Short, purposeful transitions. 150–200ms ease-out for state changes; 200ms ease-out for appearance animations.

- Signal badges: fade + scale in on state change
- Tab / panel switches: crossfade
- Explicit states: hover, focus-visible, active, disabled, loading
- `prefers-reduced-motion`: disables all transitions
- No bounce, no elastic, no spring animations — stable easing only
- Easing: `cubic-bezier(0.2, 0, 0, 1)`

## 8. Voice & Brand

- Tone: concise, confident, technical. Product UI for a quantitative tool.
- Personality: Minimalist · Transparent · Efficient
- Microcopy: action-oriented, no generic filler. "Add fund" not "Add new fund to your watchlist"
- Signal language uses domain terms: buy/sell/hold, not "positive/negative/neutral"
- UI labels are literal and clear: "Watchlist" not "My Portfolio Overview"

## 9. Anti-patterns

- No off-palette colors when an existing token works
- Don't flatten hierarchy by using the same size/weight for all text in a section
- No decorative effects that reduce readability or accessibility — no gradient text, no glassmorphism, no side-stripe borders
- No mixing of unrelated visual metaphors in the same interface
- No traditional broker app aesthetic (red/green candles, gold decorations, stock-forum visual language)
- No display fonts in UI labels, buttons, or data — monospace only
