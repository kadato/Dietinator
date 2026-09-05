<!-- provenance: seed b9619c3c pinned brief terminal sharp square beats roll, per app/+html.tsx contract, capture 390x844@2 at localhost:9089 -->

---

name: Dietinator
description: Field terminal for solo nutrition - sharp, square, mono, one-thumb ledger - provenance seed b9619c3c pinned brief beats roll
colors:
primary: "#0b57d0"
primary-dark: "#7aa2f7"
primary-strong: "#0044cc"
primary-strong-dark: "#7dcfff"
primary-muted: "#0f172a"
primary-muted-dark: "#bb9af7"
background: "#f1f5f9"
background-dark: "#1a1b26"
surface: "#ffffff"
surface-dark: "#24283b"
surface-alt: "#e2e8f0"
surface-alt-dark: "#292e42"
text: "#0f172a"
text-dark: "#c0caf5"
text-muted: "#475569"
text-muted-dark: "#a9b1d6"
text-on-background: "#0f172a"
text-on-background-dark: "#c0caf5"
border: "#0f172a"
border-dark: "#6b739c"
breakfast: "#0369a1"
breakfast-dark: "#8db8ff"
lunch: "#92400e"
lunch-dark: "#FFB020"
dinner: "#be123c"
dinner-dark: "#ff92a6"
snack: "#0f766e"
snack-dark: "#2EC4B6"
water: "#0e7490"
water-dark: "#38bdf8"
weight: "#6d28d9"
weight-dark: "#c4b5fd"
success: "#15803d"
success-dark: "#4ade80"
danger: "#be123c"
danger-dark: "#ff7a8e"
warning: "#92400e"
warning-dark: "#e0af68"
ink-grid: "rgba(15,23,42,0.035)"
ink-grid-dark: "rgba(192,202,245,0.035)"
typography:
display:
fontFamily: "'Departure Mono', monospace"
fontSize: "clamp(1.75rem, 5vw, 2rem)"
fontWeight: 800
lineHeight: 1
letterSpacing: "0"
headline:
fontFamily: "'Departure Mono', monospace"
fontSize: "16px"
fontWeight: 700
lineHeight: 1.2
letterSpacing: "0"
title:
fontFamily: "'Departure Mono', monospace"
fontSize: "14px"
fontWeight: 700
lineHeight: 1.3
letterSpacing: "0.04em"
body:
fontFamily: "'Departure Mono', monospace"
fontSize: "14px"
fontWeight: 400
lineHeight: 1.5
letterSpacing: "0"
label:
fontFamily: "'Departure Mono', monospace"
fontSize: "11px"
fontWeight: 700
lineHeight: 1.2
letterSpacing: "0.08em"
mono:
fontFamily: "'Departure Mono', monospace"
fontSize: "12px"
fontWeight: 700
lineHeight: 1.4
letterSpacing: "0"
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

# Design system: Dietinator

## Overview

**Creative north star: "The field terminal"**

Dietinator is now a handheld field computer for your own body. No soft paper, no pill buttons, no floating shadows. Every surface is a sheet of graph paper ruled at 24px in light and dotted void in dark, edged by a 1.5px ink rule, stacked with zero radius. The ledger is read like an instrument. Mono columns never jitter. Square keys fill the thumb arc. A single data accent appears only where the body counts. The machine is clean, fast, and deliberately low chrome so the diary stays legible at a glance between bites or with one hand on a crowded train.

This replacement world keeps product truth, content, function, and constraints, and discards the ledger-soft previous system as evidence. Operate mode governs. Task, state, and familiar affordance outrank expression. The first viewport must prove the mechanism immediately.

**Key characteristics:**

- Square strict. Every card, button, input, bar, and tab is `0` radius with a 1.5px ink rule. Tinted chips use 1px interior rules not glows.
- Mono ledger. Departure Mono everywhere. Tabular-nums forced. Headings uppercase at 0.04 to 0.08 tracking.
- Paper grid system. 24px graph on `#f1f5f9` light and 24px dotted void on `#1a1b26` dark at `0.035` alpha. No gradients, no blur.
- Slate ledger. Light paper `#f1f5f9` with wells `#e2e8f0` ink `#0f172a` primary `#0b57d0`. Vivid meals `0369a1 92400e be123c 0f766e` plus water `0e7490` weight `6d28d9` success `15803d` carry macros colorblind-safe at 4.5:1. Dark Tokyo Night `#1a1b26` stays.
- Thumb-first density. Tight 4 to 12 rhythm. Generous separation between groups. Bottom dock of 52 square keys for one-hand logging.
- Flat authority. No shadows. Elevation is border weight and invert. Pressed is `scale 0.98` not lift.

## Colors

Vivid terminal: full palette. Neutrals carry the page, each meal and macro owns its card and bar, water and weight own hydration, streak amber owns consistency. Primary stays the action color.

### Primary

- **Ink. The only chrome fill uses #0b57d0 on light and #7aa2f7 on dark. Square primary buttons, active tab invert, and ledger rules use it. Light uses white `onPrimary` at 7.8:1. Dark uses `#1a1b26` on `#c0caf5` at 8.2:1. Slate blue, ledger ink.**
- **Ink strong. Uses #0044cc on light and #7dcfff on dark. It gives hover and pressed depth.**

### Secondary

- **Paper grid. Uses #f1f5f9 on light and #1a1b26 on dark at `0.035` alpha `--bg-grid`. Slate paper with wells `#e2e8f0` in light. It is the ground that shows the 24px graph. It is not decoration, it is the ledger ruling.**

### Tertiary

- **Terminal Data - light as grayscale luminance steps, dark retains phosphor teal #0e8c7a and amber and magenta for macro photometer clarity on the void. Both use 1px interior rules. Hue never fights the mono ledger, it measures.**

### Neutral

- **Surface. Uses #ffffff on light and #24283b on dark. Sheets, cards, and modals use it. Each sheet carries a 1.5px `#0f172a` rule on light and `#6b739c` on dark.**
- **Surface alt. Uses #e2e8f0 on light and #292e42 on dark. Wells, tracks, and chip grounds use it. Bar track background uses it.**
- **Ink. Uses #0f172a on light and #c0caf5 on dark. Body and numerals use it. 15.8:1 on #ffffff, 4.6:1 border on dark.**
- **Ink muted. Uses #475569 on light and #a9b1d6 on dark. Secondary labels and helper use it.**
- **Ink on background. Uses #0f172a on light and #c0caf5 on dark. Section titles on the grid ground use it.**
- **Line. Uses #0f172a on light and #6b739c on dark. Every card edge is 1.5px. Hairline only for inner chip rules at 1px.**
- **Alert. Danger uses #9f1239 on light and #f7768e on dark and is square. Warning uses #92400e on light and #e0af68 on dark and is square. Progress over budget flips to danger ink plus 12 percent tint. It never glows.**

### Named rules

**The Ink Rule.** If a surface needs emphasis it gets a heavier rule or an invert, never a shadow, glow, or tint scatter. Ink is the hierarchy.
**The No Pill Rule.** No pill, no capsule, no rounded tag. Every control is a square sheet with a square label.

## Typography

**Display font. Departure Mono, a single-weight pixel monospace, used everywhere. Uncovered glyphs fall back to the system monospace.**
**Body font. Departure Mono.**
**Label and mono font. Departure Mono, tabular-nums, -0.01em.**

**Shipping contract.** The face is bundled, not fetched. `DepartureMono-Regular.otf` lives in `assets/fonts/` at 82KB. Departure Mono ships one Regular outline, so web maps every requested weight (400 to 800) to that one file through `src/utils/web-fonts.ts` via the CSS Font Loading API, which keeps the browser from synthesizing faux bold over pixel glyphs. Android resolves the family from `android/app/src/main/assets/fonts`. No other face ships; glyphs Departure Mono does not cover fall through the stack to the system monospace. No remote font requests run at runtime. Preload is declared in `app/+html.tsx` as `as="font" type="font/otf" crossorigin="anonymous"` so the first paint never double-fetches.

**Pixel perfection.** For pixel-perfect results, set the font size to increments of 11px. Departure Mono is drawn on an 11px grid. Sizes that are multiples of 11 keep stems on device pixels and avoid half-pixel antialias smear. The scale below snaps every size to the grid: 11, 22, 33 and their halves at 11 and 22 steps. Body 14 is the compromise for readability, but tabular numerals and headings stay on the 11px grid wherever they carry measurement. On web the face is forced to `font-variant-numeric: tabular-nums` and `letter-spacing: 0` at the grid, with `text-rendering: optimizeLegibility` and no negative tracking.

**Character. Terminal instrument, not decorative mono costume. Every numeral is tabular so columns hold when `1840` becomes `2012`. Headings are uppercase, tight, and crowded. Body is small and breathable at 14 and 1.5. The mono texture carries the ledger without needing color.**

**Chat body exception.** Assistant messages render `Markdown` at `bodySize lg` (16 and 24) through the shared `src/components/ai-chat.tsx` bubbles. Thin pixel strokes read faint at 14, so chat is the one surface allowed bigger body copy. The tab and the modal share the bubbles and the composer from that module. A second copy is how the modal drifted gray, so new chat UI goes there.

### Hierarchy

- **Display. Uses 800, clamp 28 to 32, 1.0, 0. App name on login and empty terminal prompts only. Uppercase.**
- **Headline. Uses 700, 16, 1.2, 0. Section headers `MEALS` and `TODAY · MON` in uppercase tracking 0.04.**
- **Title. Uses 700, 14, 1.3, 0.04. Meal labels `BRKF LUNCH DINR SNCK`, card titles, and dock keys.**
- **Body. Uses 400, 14, 1.5, 0. Forms, row names, and helper copy. Measure 65 to 75ch because containers cap at 720.**
- **Label. Uses 700, 11, 0.08, uppercase. Chips, badges, chart ticks, and tab labels at 10 to 11, always uppercase with wide tracking.**
- **Mono. Uses 700, 12, 1.4, 0. Every changing number. Ring 28, row kcal 16, bar 14, stepper 19.**

### Named rules

**The Tabular Numbers Rule.** Any numeral that updates is mono tabular. Body text never carries the remaining budget. The ring 22 or 28 mapped to 22 on grid, row 16, bar 14 all mono with `font-variant-numeric: tabular-nums`.
**The 11px Grid Rule.** For pixel-perfect results, set the font size to increments of 11px. Never use 13, 15, or 17 for tabular data. Use 11, 22, 33 and step weight to show hierarchy. The grid is the reason Departure Mono stays crisp at 11 and layers 700 weight for emphasis instead of half-pixel size.

## Layout

Graph-paper grid, thumb-first. `breakpointMedium` is 600. `breakpointWide` is 900. `breakpointLarge` is 1280. `maxWidthContent` is 720. `maxWidthWide` is 1100. `maxWidthXl` is 1280. `maxWidthNarrow` is 420. `sideTabWidth` is 120, drawn at 104. `tabBarHeight` is 56 plus safe area on phones, 48 compact. Spacing scale is tight. `xs` is 4, `sm` is 8, `md` is 12, `lg` is 16, `xl` is 24, `2xl` is 32. Space is tight inside groups and generous between groups. More space sits above a heading than below it.

`PageContainer` centers the page at `maxWidthContent` on phones and `maxWidthWide` at 900, growing to `maxWidthXl` 1280 at 1280 so the diary does not sit as a narrow column in a sea of grid. It uses `p-4` at base, `px-6` on wide, `px-8` on large. On narrow, the scroll reserves `pb-40` to clear the dock and the tab bar. At 900 the Today view splits into two flex columns at 0.95 and 1.05 with a 16 gap, growing to 24 gap at 1280 with a subtle 1px vertical rule between columns and a sticky left summary so the budget stays visible while scrolling meals. Meals wrap at 48 percent basis and 280 minimum, gap 2 on wide and gap 3 on large. The topology stays the same as before, but sheets are square and ruled.

**Modern big screen.** Tailwind screens map to the same breakpoints: `sm 600`, `md 900`, `lg 1280`, `xl 1536`. At 900 the stats view uses a 2-column grid, consistency spans full width, weight/calories/macros/water tile 2 by 2, gap 4 growing to 6 at large. Settings hub on large shows a 2 or 3 column tile grid with active state, and the drilldown on wide shows a horizontal tab row for quick switching without losing context. Login on large shows a 96 icon, field-terminal copy, and three 11px chips at `OFFLINE GRID MONO` before the 440 form.

One-hand dock. On phones a fixed row sits above the tab bar at `insets.bottom + 64 + 10`. It uses left and right 12, flex row gap 8, four squares flex 1 min 56 tall for Breakfast, Lunch, Dinner, and Snack each 52 square, plus a 56 square primary water quick add at the end. Hit targets are 48 minimum. Thumb arc is centered. Labels `BRKF` and similar are 10 mono wide.

**The Gutter Consistency Rule.** Settings defines the gutter with `12px` `spacing.md` on `PageContainer` `default` `720`. Every main surface now mirrors that `12px` inset. `add-food`, `log-meal`, `manual-entry`, `meal-builder`, `scan`, and `stats` all use `p-3` and `12px`, never `narrow` `420` waste on `500px` tablets. Today is the one exception that spends the entire space. `PageContainer` `default` `720` plus `p-2` `8px` on small phones so meal cards stretch `366` to `374` and read larger. Wide keeps `px-6`. No page may reintroduce a centered `420` column on medium.

**The Grid Breathing Rule.** Nothing edge-pins. Even the void respects the 24px ruling. Wide is two columns, not a wider single column.

## Elevation and depth

Flat, never lifted. Depth is rule weight and invert, not shadow.

Sheets at rest are paper or surface with a 1.5px ink rule, no blur. Pressed sheets invert or fill with `surfaceAlt`. The only elevation is the pressed scale `0.92` to `0.98`.

### Shadow vocabulary

- **No shadows. Every `shadow-soft-*` is overridden to `none` and replaced with a border. If a component needs emphasis it uses a heavier 1.5px rule or an invert.**
- **Fab and dock. Former lift `0 8 24 rgba(0,0,0,0.22) elevation 8` removed, replaced with square 1.5px rule.**
- **Popover. `0 6 20 rgba(0,0,0,0.2)` removed, replaced with square 1.5px rule and no blur.**

### Named rules

**The Flat-By-Default Rule.** No sheet floats. Borders mark sheets, invert marks selection, scale marks press. A shadow is a regression.

## Shapes

Sharp and square. All radii are `0`. Cards, buttons, inputs, tabs, pills, bars, avatars, and icon wells are rectangles with 1 to 1.5px rules. Where a radius would soften, the system uses a rule or an invert instead. Pills are squares with 1px interior rules at 12 to 22 percent tint, not capsules. Bars are rectangles with 1px track border and square fill. Avatar wells are 38 squares with 1px rule, not 12 radius. The outer ledger `3xl 24` and `2xl 16` are now `0`.

## Components

### Buttons

- **Shape. Square `0` with `1.5px` rule. Padding `12 16` at md, `10 12` at sm. No radius.**
- **Primary. Ink fill `#9a3412` on light with white mono label, invert `#7aa2f7` on dark with `#1a1b26` label. Hover to `#7c2d12` on light and `#ffffff` on dark. Active `scale 0.98`. Deep harvest orange, darker and more orange.**
- **Ghost. Surface fill with `1.5px` ink rule, ink label.**
- **Icon. Ionicons at 18 to 22, stroke square, not round.**

### Chips

- **Style. Square sheets, `1px` rule at `color 45` percent, ground at `color 22` percent, square, `6 10` padding at xs to `11 5.5` at md, mono 12 to 14 tabular.**
- **State. Static. Selected chips invert. Ink fill with paper label.**

### Cards and containers

- **Corner style. `0` everywhere.**
- **Background. `surface` sheet with `1.5px` ink rule. No shadow.**
- **Internal padding. `12` tight, `16` comfortable. Ledger header band at `surfaceAlt` with 1.5px below rule.**

### Inputs and fields

- **Style. Surface sheet with `1.5px` ink rule, `0` radius, `10 12` padding, mono 14.**
- **Focus. `1.5px` solid ink square outline at `1px` offset, no glow, no inset ring.**
- **Disabled. `0.5` opacity, not muted color.**

### Navigation

Left rail at 104 on wide with `1.5px` right rule, items 80 wide `0` radius with `1.5px` rule when focused, background invert to ink with paper label, inactive `textMuted` on transparent. Bottom bar at `64+insets` with `1.5px` top rule, items flex 1 `0` radius, active invert, labels 9 mono uppercase wide tracking. Brand mark 44 square with `1.5px` rule and `12` percent tint.

### Calorie gauge

Square perimeter gauge, not a circle. 132 default, 136 mobile, 150 wide. Track `surfaceAlt`, macro segments run clockwise from the top-left corner at 10 stroke with sharp mitred corners and 1.5 gap, center 28 mono extra bold tabular, label 12 mono muted uppercase. The gauge and its container are the same square.

### Loading spinner

Square well with a full `surfaceAlt` track. One single edge carries the ink and sweeps around the perimeter. No multi-side arc, no circle.

### Tab dock for phones

48 tall plus safe area, `1.5px` top rule, icon 18 in a 24 well, gap 2. Labels only at 480 and wider at 8px uppercase 0.08 tracking. Below that, icons alone. No loose text on small screens. Active invert uses primary fill with paper icon.

### Meal section header

Square sheet with `1.5px` rule, avatar 38 square with `1px` rule, label 13 mono uppercase `0.04` tracking, kcal 15 mono, goal line 10 mono, pills square, add button 36 square with `1px` rule and primary invert.

Expanded rows for `DiaryEntryRow` with `38` icon `13` name `14` kcal `32` actions keep the clip fix. `macroRow` uses `flexWrap wrap` `columnGap 4` `rowGap 4`, `info` uses `overflow hidden`, `kcalBlock` uses `flexShrink 0`, `pillContainer` uses `wrap` `rowGap 4`, `pillXs` uses `6 by 2` and `11 by 14`. Bigger metrics wrap to a second line instead of clipping into `kcal` or `actions`.

### Modal dismissal

Every modal dismisses on backdrop tap and `Escape`. `ModalContainer` wide renders an absolute `Pressable` backdrop behind the centered dialog and calls `useSafeBack` via `useEscapeToClose`. `MealSlotModal` the `+` FAB sheet and `CreateOptionsModal` the three-dot sheet both use a dim `rgba(0,0,0,0.45)` `View` centered with an absolute backdrop `Pressable` and `useEscapeToClose`. The sheet `Cancel` is a boxed button `1.5px` `border` `surfaceAlt` `px-6 py-2.5` mono uppercase.

### Modal header

Every functional dialog takes `ModalHeader` (`src/components/ModalHeader.tsx`): a 5px accent bar on the top edge, then a tinted band with a solid accent icon well, an accent title, and a muted subtitle. Water uses water cyan, weight uses weight violet, create and pickers use primary or the target meal color. Text inside dialogs never uses gluestack gray scales. Titles are ink, secondary copy is `textMuted`, both set as explicit styles so contrast holds on native and web.

### Log meal FAB cluster

Search sits next to scan on the right. `FabCluster` `right={<View row gap10><Fab search surface/><Fab scan primary/></View>}` `left` holds back. Never `center` gap across the screen. Quick-add and meal log refresh only the logged section. No `FlatList` flash. Collapsed preview caps at `3` with `+N more`.

### Bottom one-hand dock

Four flex squares at 56 tall, `1.5px` ink rule, surface fill, icon 18 mono black, label 9 mono `BRKF LUNCH DINR SNCK` uppercase 0.06 tracking, plus primary water square 56 with ink invert. Gap 8, thumb arc centered, pointerEvents box-none.

### Segmented control

Square well with `1px` ink rule and `surfaceAlt` ground, options flex 1 square, active ink fill with paper label.

### Number stepper

Square minus and plus at 36 or 48 with `1.5px` ink rule, surface fill, central input square 68 to 120 with `1.5px` rule, 19 mono bold centered, long-press repeat 90ms.

## Do and don't

### Do

- **Do. Keep every sheet square with a 1.5px ink rule. The grid and the rule are the depth.**
- **Do. Give controls that sit side by side the same box height. Stepper keys equal input, quick-add wells equal quick-add buttons, footer pairs equal. Mixed heights inside one row read as breakage.**
- **Do. Keep numbers mono tabular at `28 16 13` so the ledger never reflows.**
- **Do. Use the thumb dock for one-hand. Four meal squares plus water quick add, 48 minimum, labels uppercase wide.**
- **Do. Center the ledger in `720` with `12 16` rhythm and 24px graph respect.**
- **Do. Invert for selection. Ink fill with paper label is the only selected state.**

### Don't

- **Don't. Round anything. No `3xl`, no `full`, no `12` radius.**
- **Don't. Shadow anything. No `soft-2`, no `0 8 24`, no blur.**
- **Don't. Tint chrome with teal scatter. Ink is the chrome, color only for data where needed.**
- **Don't. Hide focus. `1.5px` square outline at `1px` offset is not optional.**
- **Don't. Rely on color for meal identity. Labels `BRKF` etc carry the ledger, not hue.**
- **Don't. Trap content behind the dock. Scroll reserves `pb-40` on phones.**
