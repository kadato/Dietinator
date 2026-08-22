<!-- provenance: seed b9619c3c pinned brief terminal sharp square beats roll, per app/+html.tsx contract, capture 390x844@2 at localhost:9089 -->

---

name: Dietinator
description: Field terminal for solo nutrition — sharp, square, mono, one-thumb ledger — provenance seed b9619c3c pinned brief beats roll
colors:
primary: "#34548a"
primary-dark: "#7aa2f7"
primary-strong: "#0f4b6e"
primary-strong-dark: "#7dcfff"
background: "#e1e2e7"
background-dark: "#1a1b26"
surface: "#ffffff"
surface-dark: "#24283b"
surface-alt: "#d5d6db"
surface-alt-dark: "#292e42"
text: "#343b58"
text-dark: "#c0caf5"
text-muted: "#565a6e"
text-muted-dark: "#a9b1d6"
text-on-background: "#1a1b26"
text-on-background-dark: "#c0caf5"
border: "#a9b1d6"
border-dark: "#414868"
breakfast: "#214a7a"
breakfast-dark: "#8ab4f8"
lunch: "#5a3e8e"
lunch-dark: "#bb9af7"
dinner: "#8c4351"
dinner-dark: "#f7768e"
snack: "#8f5e15"
snack-dark: "#e0af68"
danger: "#8c4351"
danger-dark: "#f7768e"
warning: "#8f5e15"
warning-dark: "#e0af68"
ink-grid: "rgba(52,84,138,0.08)"
ink-grid-dark: "rgba(192,202,245,0.06)"
typography:
display:
fontFamily: "'JetBrainsMono NFM', 'JetBrains Mono', monospace"
fontSize: "clamp(1.75rem, 5vw, 2rem)"
fontWeight: 800
lineHeight: 1
letterSpacing: "-0.03em"
headline:
fontFamily: "'JetBrainsMono NFM', 'JetBrains Mono', monospace"
fontSize: "16px"
fontWeight: 700
lineHeight: 1.2
letterSpacing: "-0.02em"
title:
fontFamily: "'JetBrainsMono NFM', 'JetBrains Mono', monospace"
fontSize: "13px"
fontWeight: 700
lineHeight: 1.3
letterSpacing: "0.04em"
body:
fontFamily: "'JetBrainsMono NFM', 'JetBrains Mono', monospace"
fontSize: "13px"
fontWeight: 400
lineHeight: 1.5
letterSpacing: "-0.01em"
label:
fontFamily: "'JetBrainsMono NFM', 'JetBrains Mono', monospace"
fontSize: "10px"
fontWeight: 700
lineHeight: 1.2
letterSpacing: "0.08em"
mono:
fontFamily: "'JetBrainsMono NFM', 'JetBrains Mono', monospace"
fontSize: "12px"
fontWeight: 700
lineHeight: 1.4
letterSpacing: "-0.01em"
rounded:
none: "0px"
xs: "0px"
sm: "0px"
md: "0px"
lg: "0px"
xl: "0px"
full: "0px"
spacing:
xs: "4px"
sm: "8px"
md: "12px"
lg: "16px"
xl: "24px"
2xl: "32px"
components:
button-primary:
backgroundColor: "{colors.primary}"
textColor: "{colors.surface}"
rounded: "{rounded.none}"
padding: "12px 16px"
button-primary-hover:
backgroundColor: "{colors.primary-strong}"
textColor: "{colors.surface}"
rounded: "{rounded.none}"
button-ghost:
backgroundColor: "{colors.surface}"
textColor: "{colors.text}"
rounded: "{rounded.none}"
padding: "12px 16px"
card:
backgroundColor: "{colors.surface}"
textColor: "{colors.text}"
rounded: "{rounded.none}"
padding: "12px"
input:
backgroundColor: "{colors.surface}"
textColor: "{colors.text}"
rounded: "{rounded.none}"
padding: "10px 12px"
tab-active:
backgroundColor: "{colors.primary}"
textColor: "{colors.surface}"
rounded: "{rounded.none}"
padding: "8px 6px"
---

# Design System: Dietinator

## Overview

**Creative North Star: "The Field Terminal"**

Dietinator is now a handheld field computer for your own body. No soft paper, no pill buttons, no floating shadows. Every surface is a sheet of graph paper ruled at 24px in light and dotted void in dark, edged by a 1.5px ink rule, stacked with zero radius. The ledger is read like an instrument: mono columns that never jitter, square keys that fill the thumb arc, and a single data accent that only appears where the body counts. The machine is clean, fast, and deliberately low chrome so the diary remains legible at a glance between bites or with one hand on a crowded train.

This replacement world keeps product truth, content, function, and constraints, and discards the ledger-soft previous system as evidence. Operate mode governs: task, state, and familiar affordance outrank expression. The first viewport must prove the mechanism immediately.

**Key Characteristics:**

- Square strict: every card, button, input, bar, and tab is `0` radius with a 1.5px ink rule, tinted chips use 1px interior rules not glows
- Mono ledger: JetBrains Mono everywhere, tabular-nums forced, headings uppercase at 0.04 to 0.08 tracking
- Paper grid system: 24px graph on `#e1e2e7` light and 24px dotted void on `#1a1b26` dark, no gradients, no blur
- Thumb-first density: tight 4 to 12 rhythm, generous separation between groups, bottom dock of 52 square keys for one-hand logging
- Flat authority: no shadows, elevation is border weight and invert, pressed is `scale 0.98` not lift

## Colors

Restrained strategy. Neutrals carry the page, one ink carries chrome, semantic keeps danger and warning only.

### Primary

- **Ink** (#34548a light / #7aa2f7 dark): The only chrome fill. Square primary buttons, active tab invert, and ledger rules. Light uses white `onPrimary` at 15.9:1, dark uses `#1a1b26` on off-white at 16.2:1.
- **Ink Strong** (#1a1a1a / #ffffff): Hover and pressed depth. No mid tint, only ink or paper.

### Secondary

- **Paper Grid** (#e1e2e7 / #1a1b26): Ground that shows the 24px graph. Not decorative, it is the ledger ruling.

### Tertiary

- **Terminal Data** — light as grayscale luminance steps, dark retains phosphor teal #0e8c7a and amber/magenta for macro photometer clarity on the void. Both use 1px interior rules, hue never fights the mono ledger, it measures.

### Neutral

- **Surface** (#ffffff / #141616): Sheets, cards, and modals. Each sheet carries a 1.5px `#34548a` rule in light and `#414868` in dark.
- **Surface Alt** (#eceae4 / #1e2122): Wells, tracks, and chip grounds. Bar track background.
- **Ink** (#34548a / #c0caf5): Body and numerals.
- **Ink Muted** (#565a6e / #a9b1d6): Secondary labels and helper.
- **Ink on Background** (#34548a / #e1e2e7): Section titles on the grid ground.
- **Line** (#34548a / #414868): Every hairline and card edge is 1.5px in light and 1px in dark, never hairline 1px in light because it disappears on the paper grid.
- **Alert** Danger (#dc2626 / #f7768e) square, Warning (#b45309 / #e0af68) square. Progress over budget flips to danger ink plus 12 percent tint, never glow.

### Named Rules

**The Ink Rule.** If a surface needs emphasis it gets a heavier rule or an invert, never a shadow, glow, or tint scatter. Ink is the hierarchy.
**The No Pill Rule.** No pill, no capsule, no rounded tag. Every control is a square sheet with a square label.

## Typography

**Display Font:** JetBrainsMono NFM (Nerd Font Mono build, no ligatures; JetBrains Mono fallback)
**Body Font:** JetBrainsMono NFM
**Label/Mono Font:** JetBrainsMono NFM, tabular-nums, -0.01em

**Shipping contract.** The face is bundled, not fetched: TTFs live in `assets/fonts/` (weights 400 to 800), web registers them through `src/utils/web-fonts.ts` via the CSS Font Loading API, and Android resolves the family from `android/app/src/main/assets/fonts`. The NFM build ships without ligatures by Nerd Fonts policy, which the ledger requires so glyph pairs never fuse. No remote font requests at runtime.

**Character:** Terminal instrument, not decorative mono costume. Every numeral is tabular so columns hold when `1840` becomes `2012`. Headings are uppercase, tight, and crowded, body is small and breathable at 13/1.5. The mono texture carries the ledger without needing color.

### Hierarchy

- **Display** (800, clamp 28 to 32, 1.0, -0.03): App name on login and empty terminal prompts only. Uppercase.
- **Headline** (700, 16, 1.2, -0.02): Section headers `MEALS`, `TODAY · MON` in uppercase tracking 0.04.
- **Title** (700, 13, 1.3, 0.04): Meal labels `BRKF LUNCH DINR SNCK`, card titles, dock keys.
- **Body** (400, 13, 1.5, -0.01): Forms, row names, helper copy. Measure 65 to 75ch because containers cap at 720.
- **Label** (700, 10, 0.08, uppercase): Chips, badges, chart ticks, tab labels at 9 to 10, always uppercase with wide tracking.
- **Mono** (700, 12, 1.4, -0.01): Every changing number: ring 28, row kcal 16, bar 13, stepper 19.

### Named Rules

**The Tabular Numbers Rule.** Any numeral that updates is mono tabular. Body text never carries the remaining budget. The ring 28, row 16, bar 13 all mono.

## Layout

Graph-paper grid, thumb-first. `breakpointMedium` 600, `breakpointWide` 900, `maxWidthContent` 720, `maxWidthWide` 1100, `maxWidthNarrow` 420, `sideTabWidth` 120 drawn at 104, `tabBarHeight` 64 plus safe area. Spacing scale tight: `xs 4 sm 8 md 12 lg 16 xl 24 2xl 32`. Tight inside groups, generous between groups, more space above a heading than below it.

Page centers via `PageContainer` at `maxWidthContent` with `p-4` base and `px-6` on wide; on narrow the scroll reserves `pb-40` to clear the dock plus tab bar. At 900 the Today splits into two flex columns 0.95 and 1.05 with gap 16, meals wrap at basis 48 percent min 280, same topology as before but sheets are square and ruled.

One-hand dock: on phones a fixed row above the tab bar at `insets.bottom + 64 + 10`, left-right 12, flex row gap 8, four squares flex 1 min 56 tall for Breakfast, Lunch, Dinner, Snack each 52 square, plus a 56 square primary water quick add at the end. Hit targets 48 minimum, thumb arc centered, labels `BRKF` etc at 9 mono wide.

**The Grid Breathing Rule.** Nothing edge-pins. Even the void respects the 24px ruling. Wide is two columns, not a wider single column.

## Elevation & Depth

Flat, never lifted. Depth is rule weight and invert, not shadow.

Sheets at rest are paper or surface with a 1.5px ink rule, no blur. Pressed sheets invert or fill with `surfaceAlt`. The only elevation is the pressed scale `0.92` to `0.98`.

### Shadow Vocabulary

- **No shadows.** Every `shadow-soft-*` is overridden to `none` and replaced with a border. If a component needs emphasis it uses a heavier 1.5px rule or an invert.
- **Fab / dock** former lift `0 8 24 rgba(0,0,0,0.22) elevation 8` removed, replaced with square 1.5px rule.
- **Popover** `0 6 20 rgba(0,0,0,0.2)` removed, replaced with square 1.5px rule and no blur.

### Named Rules

**The Flat-By-Default Rule.** No sheet floats. Borders mark sheets, invert marks selection, scale marks press. A shadow is a regression.

## Shapes

Sharp and square. All radii are `0`. Cards, buttons, inputs, tabs, pills, bars, avatars, and icon wells are rectangles with 1 to 1.5px rules. Where a radius would soften, the system uses a rule or an invert instead. Pills are squares with 1px interior rules at 12 to 22 percent tint, not capsules. Bars are rectangles with 1px track border and square fill. Avatar wells are 38 squares with 1px rule, not 12 radius. The outer ledger's `3xl 24` and `2xl 16` are now `0`.

## Components

### Buttons

- **Shape:** Square `0` with `1.5px` rule. Padding `12 16` at md, `10 12` at sm. No radius.
- **Primary:** Ink fill `#34548a` on light with white mono label, invert `#7aa2f7` on dark with `#1a1b26` label. Hover to `#1a1a1a` / `#ffffff`, active `scale 0.98`.
- **Ghost:** Surface fill with `1.5px` ink rule, ink label.
- **Icon:** Ionicons at 18 to 22, stroke square, not round.

### Chips

- **Style:** Square sheets, `1px` rule at `color 45` percent, ground at `color 22` percent, square, `6 10` padding at xs to `11 5.5` at md, mono 12 to 14 tabular.
- **State:** Static. Selected chips invert: ink fill with paper label.

### Cards / Containers

- **Corner Style:** `0` everywhere.
- **Background:** `surface` sheet with `1.5px` ink rule. No shadow.
- **Internal Padding:** `12` tight, `16` comfortable. Ledger header band at `surfaceAlt` with 1.5px below rule.

### Inputs / Fields

- **Style:** Surface sheet with `1.5px` ink rule, `0` radius, `10 12` padding, mono 13.
- **Focus:** `1.5px` solid ink square outline at `1px` offset, no glow, no inset ring.
- **Disabled:** `0.5` opacity, not muted color.

### Navigation

Left rail at 104 on wide with `1.5px` right rule, items 80 wide `0` radius with `1.5px` rule when focused, background invert to ink with paper label, inactive `textMuted` on transparent. Bottom bar at `64+insets` with `1.5px` top rule, items flex 1 `0` radius, active invert, labels 9 mono uppercase wide tracking. Brand mark 44 square with `1.5px` rule and `12` percent tint.

### Calorie Gauge

Square perimeter gauge, not a circle. 132 default, 136 mobile, 150 wide. Track `surfaceAlt`, macro segments run clockwise from the top-left corner at 10 stroke with sharp mitred corners and 1.5 gap, center 28 mono extra bold tabular, label 12 mono muted uppercase. The gauge and its container are the same square.

### Loading Spinner

Square well with a full `surfaceAlt` track; one single edge carries the ink and sweeps around the perimeter. No multi-side arc, no circle.

### Tab Dock (phones)

48 tall plus safe area, `1.5px` top rule, icon 18 in a 24 well, gap 2. Labels only at 480 and wider (8px uppercase 0.08 tracking); below that icons alone — no loose text on small screens. Active invert: primary fill with paper icon.

### Meal Section Header

Square sheet with `1.5px` rule, avatar 38 square with `1px` rule, label 13 mono uppercase `0.04` tracking, kcal 15 mono, goal line 10 mono, pills square, add button 36 square with `1px` rule and primary invert.

### Bottom One-Hand Dock

Four flex squares at 56 tall, `1.5px` ink rule, surface fill, icon 18 mono black, label 9 mono `BRKF LUNCH DINR SNCK` uppercase 0.06 tracking, plus primary water square 56 with ink invert. Gap 8, thumb arc centered, pointerEvents box-none.

### Segmented Control

Square well with `1px` ink rule and `surfaceAlt` ground, options flex 1 square, active ink fill with paper label.

### Number Stepper

Square minus and plus at 36 or 48 with `1.5px` ink rule, surface fill, central input square 68 to 120 with `1.5px` rule, 19 mono bold centered, long-press repeat 90ms.

## Do's and Don'ts

### Do:

- **Do** keep every sheet square with a 1.5px ink rule — the grid and the rule are the depth.
- **Do** give controls that sit side by side the same box height (stepper keys = input, quick-add wells = quick-add buttons, footer pairs); mixed heights inside one row read as breakage.
- **Do** keep numbers mono tabular at `28 16 13` so the ledger never reflows.
- **Do** use the thumb dock for one-hand: four meal squares plus water quick add, 48 minimum, labels uppercase wide.
- **Do** center the ledger in `720` with `12 16` rhythm and 24px graph respect.
- **Do** invert for selection: ink fill with paper label is the only selected state.

### Don't:

- **Don't** round anything — no `3xl`, no `full`, no `12` radius.
- **Don't** shadow anything — no `soft-2`, no `0 8 24`, no blur.
- **Don't** tint chrome with teal scatter — ink is the chrome, color only for data where needed.
- **Don't** hide focus — `1.5px` square outline at `1px` offset is not optional.
- **Don't** rely on color for meal identity — labels `BRKF` etc carry the ledger, not hue.
- **Don't** trap content behind the dock — scroll reserves `pb-40` on phones.
