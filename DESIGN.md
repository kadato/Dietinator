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

# Dietinator design system

## Overview

**Goal: the field terminal.**

Dietinator works like a handheld field computer for your own body. It uses no soft paper, no pill buttons, and no floating shadows. Every surface is a sheet of graph paper. Light mode rules the sheet at 24px. Dark mode dots the void at 24px. A 1.5px ink rule edges each sheet. Radius stays at zero. The ledger reads like an instrument. Mono columns never jitter. Square keys fill the thumb arc. A single data accent appears only where the body count changes. The UI stays clean and fast with low header weight, so the diary stays legible between bites and with one hand on a crowded train.

This system keeps product truth, content, function, and constraints. It drops the prior soft ledger. Task, state, and familiar controls outrank expression. The first viewport proves the mechanism immediately.

**Key characteristics:**

- Square strict. Every card, button, input, bar, and tab uses `0` radius with a 1.5px ink rule. Tinted chips use 1px interior rules, not glows.
- Mono ledger. Departure Mono runs everywhere. Tabular numbers stay forced. Headings use uppercase at 0.04 to 0.08 tracking.
- Paper grid system. Light mode draws a 24px graph on `#f1f5f9`. Dark mode draws a 24px dotted void on `#1a1b26` at `0.035` alpha. The system uses no gradients and no blur.
- Slate ledger. Light paper is `#f1f5f9` with wells `#e2e8f0`, ink `#0f172a`, and primary `#0b57d0`. Vivid meals use `0369a1 92400e be123c 0f766e` with water `0e7490`, weight `6d28d9`, and success `15803d`. Macro colors hold 4.5 to 1. Dark Tokyo Night `#1a1b26` stays.
- Thumb-first density. Tight 4 to 12 rhythm. Generous separation sits between groups. The bottom dock holds 52 square keys for one-hand logging.
- Flat authority. The system uses no shadows. Border weight and invert carry elevation. Pressed state uses `scale 0.98`, not lift.

## Colors

Full palette. Neutrals carry the page. Each meal and macro owns a card and bar. Water and weight own hydration. Streak amber owns consistency. Primary stays the action color.

### Primary

- **Ink.** The main fill uses #0b57d0 on light and #7aa2f7 on dark. Square primary buttons, active tab invert, and ledger rules use the fill. Light mode uses white `onPrimary` at 7.8 to 1. Dark mode uses `#1a1b26` on `#c0caf5` at 8.2 to 1.
- **Ink strong.** The fill uses #0044cc on light and #7dcfff on dark. The strong fill carries hover and pressed depth.

### Secondary

- **Paper grid.** The ground uses #f1f5f9 on light and #1a1b26 on dark at `0.035` alpha `--bg-grid`. Light mode adds wells `#e2e8f0`. The ground shows the 24px graph. The graph is the ledger ruling, not decoration.

### Tertiary

- **Terminal data.** Light mode uses grayscale luminance steps. Dark mode keeps phosphor teal #0e8c7a with amber and magenta for macro clarity on the void. Both modes use 1px interior rules. Hue measures, it never fights the mono ledger.

### Neutral

- **Surface.** The fill uses #ffffff on light and #24283b on dark. Sheets, cards, and modals use the fill. Each sheet carries a 1.5px `#0f172a` rule on light and `#6b739c` on dark.
- **Surface alt.** The fill uses #e2e8f0 on light and #292e42 on dark. Wells, tracks, and chip grounds use the fill. Bar track background uses the same fill.
- **Ink.** Text uses #0f172a on light and #c0caf5 on dark. Body and numerals use the ink. Contrast is 15.8 to 1 on #ffffff and 4.6 to 1 for border on dark.
- **Ink muted.** Text uses #475569 on light and #a9b1d6 on dark. Secondary labels and helper use the muted ink.
- **Ink on background.** Text uses #0f172a on light and #c0caf5 on dark. Section titles on the grid ground use the ink.
- **Line.** Lines use #0f172a on light and #6b739c on dark. Every card edge is 1.5px. Hairline stays only for inner chip rules at 1px.
- **Alert.** Danger uses #9f1239 on light and #f7768e on dark and stays square. Warning uses #92400e on light and #e0af68 on dark and stays square. Progress over budget flips to danger ink with 12 percent tint. Alerts never glow.

### Named rules

**The ink rule.** If a surface needs emphasis, give the surface a heavier rule or an invert, never a shadow, glow, or tint scatter. Ink carries the hierarchy.
**The no pill rule.** Use no pill, no capsule, and no rounded tag. Every control is a square sheet with a square label.

## Typography

**Display font.** Departure Mono, a single-weight pixel monospace, runs everywhere. Uncovered glyphs fall back to the system monospace.
**Body font.** Departure Mono.
**Label and mono font.** Departure Mono, tabular numbers, -0.01em.

**Shipping contract.** The face is bundled, not fetched. `DepartureMono-Regular.otf` lives in `assets/fonts` at 82KB. Departure Mono ships one Regular outline, so web maps every requested weight from 400 to 800 to that one file through `src/utils/web-fonts.ts` with the CSS Font Loading API. The mapping keeps the browser from synthesizing faux bold over pixel glyphs. Android resolves the family from `android/app/src/main/assets/fonts`. No other face ships. Glyphs Departure Mono does not cover fall through the stack to the system monospace. No remote font requests run at runtime. Preload is declared in `app/+html.tsx` as `as="font"` with `type="font/otf"` and `crossorigin="anonymous"`, so the first paint never double-fetches.

**Pixel perfection.** For pixel-perfect results, set the font size to increments of 11px. Departure Mono is drawn on an 11px grid. Sizes that are multiples of 11 keep stems on device pixels and avoid half-pixel antialias smear. The scale below snaps every size to the grid with 11, 22, 33 and halves at 11 and 22 steps. Body 14 trades grid purity for readability, but tabular numerals and headings stay on the 11px grid wherever they carry measurement. On web the face forces `font-variant-numeric: tabular-nums` and `letter-spacing: 0` at the grid, with `text-rendering: optimizeLegibility` and no negative tracking.

**Character.** Terminal tool, not decorative mono costume. Every numeral is tabular, so columns hold when `1840` becomes `2012`. Headings are uppercase, tight, and crowded. Body is small and breathable at 14 and 1.5. The mono texture carries the ledger without needing color.

**Chat body exception.** Assistant messages render `Markdown` at `bodySize lg` with 16 and 24 through the shared `src/components/ai-chat.tsx` bubbles. Thin pixel strokes read faint at 14, so chat is the one surface allowed bigger body copy. The tab and the modal share the bubbles and the composer from that module. A second copy is how the modal drifted gray, so put new chat UI there.

### Hierarchy

- **Display.** Display uses 800, clamp 28 to 32, 1.0, 0. Use display for app name on login and empty terminal prompts only. Display stays uppercase.
- **Headline.** Headline uses 700, 16, 1.2, 0. Use headline for section headers `MEALS` and `TODAY` with `MON` in uppercase tracking 0.04.
- **Title.** Title uses 700, 14, 1.3, 0.04. Use title for meal labels `BRKF LUNCH DINR SNCK`, card titles, and dock keys.
- **Body.** Body uses 400, 14, 1.5, 0. Use body for forms, row names, and helper copy. Measure 65 to 75ch because containers cap at 720.
- **Label.** Label uses 700, 11, 0.08, uppercase. Use label for chips, badges, chart ticks, and tab labels at 10 to 11, always uppercase with wide tracking.
- **Mono.** Mono uses 700, 12, 1.4, 0. Use mono for every changing number. Ring 28, row kcal 16, bar 14, stepper 19.

### Named rules

**The tabular numbers rule.** Any numeral that updates is mono tabular. Body text never carries the remaining budget. The ring 22 or 28 mapped to 22 on grid, row 16, and bar 14 all use mono with `font-variant-numeric: tabular-nums`.
**The 11px grid rule.** For pixel-perfect results, set the font size to increments of 11px. Never use 13, 15, or 17 for tabular data. Use 11, 22, 33 and step weight to show hierarchy. The grid keeps Departure Mono crisp at 11 and layers 700 weight for emphasis instead of half-pixel size.

## Layout

Graph-paper grid, thumb-first. `breakpointMedium` is 600. `breakpointWide` is 900. `breakpointLarge` is 1280. `maxWidthContent` is 720. `maxWidthWide` is 1100. `maxWidthXl` is 1280. `maxWidthNarrow` is 420. `sideTabWidth` is 120, drawn at 104. `tabBarHeight` is 56 plus safe area on phones, 48 compact. Spacing scale is tight. `xs` is 4, `sm` is 8, `md` is 12, `lg` is 16, `xl` is 24, and `2xl` is 32. Space is tight inside groups and generous between groups. More space sits above a heading than below the heading.

`PageContainer` centers the page at `maxWidthContent` on phones and `maxWidthWide` at 900. It grows to `maxWidthXl` 1280 at 1280, so the diary never sits as a narrow column in a sea of grid. The container uses `p-4` at base, `px-6` on wide, and `px-8` on large. On narrow, the scroll reserves `pb-40` to clear the dock and the tab bar. At 900 the Today view splits into two flex columns at 0.95 and 1.05 with a 16 gap. The gap grows to 24 at 1280 with a subtle 1px vertical rule between columns and a sticky left summary, so the budget stays visible while you scroll meals. Meals wrap at 48 percent basis and 280 minimum, with gap 2 on wide and gap 3 on large. Topology stays the same as before, but sheets are square and ruled.

**Modern big screen.** Tailwind screens map to the same breakpoints with `sm` 600, `md` 900, `lg` 1280, and `xl` 1536. At 900 the stats view uses a 2-column grid. Consistency spans full width. Weight, calories, macros, and water tile 2 by 2, with gap 4 growing to 6 at large. Settings hub on large shows a 2 or 3 column tile grid with active state. The drilldown on wide shows a horizontal tab row for quick switching without losing context. Login on large shows a 96 icon, field-terminal copy, and three 11px chips with `OFFLINE GRID MONO` before the 440 form.

One-hand dock. On phones a fixed row sits above the tab bar at `insets.bottom` plus 64 plus 10. The row uses left and right 12, flex row gap 8, and four squares flex 1 min 56 tall for Breakfast, Lunch, Dinner, and Snack with each 52 square. It adds a 56 square primary water quick add at the end. Hit targets are 48 minimum. Thumb arc stays centered. Labels `BRKF` and similar use 10 mono wide.

**The gutter consistency rule.** Settings defines the gutter with `12px` `spacing.md` on `PageContainer` `default` `720`. Every main surface mirrors that `12px` inset. `add-food`, `log-meal`, `manual-entry`, `meal-builder`, `scan`, and `stats` all use `p-3` and `12px`, never `narrow` `420` waste on `500px` tablets. Today is the one exception that spends the entire space. `PageContainer` `default` `720` with `p-2` `8px` on small phones lets meal cards stretch `366` to `374` and read larger. Wide keeps `px-6`. No page may reintroduce a centered `420` column on medium.

**The grid breathing rule.** Nothing edge-pins. Even the void respects the 24px ruling. Wide is two columns, not a wider single column.

## Elevation and depth

Flat, never lifted. Rule weight and invert carry depth, not shadow.

Sheets at rest are paper or surface with a 1.5px ink rule and no blur. Pressed sheets invert or fill with `surfaceAlt`. The only elevation is the pressed scale from `0.92` to `0.98`.

### Shadow vocabulary

- **No shadows.** Every `shadow-soft` token is overridden to `none` and replaced with a border. If a component needs emphasis, the component uses a heavier 1.5px rule or an invert.
- **Fab and dock.** Former lift `0 8 24 rgba` with `elevation 8` is removed and replaced with square 1.5px rule.
- **Popover.** Former `0 6 20 rgba` is removed and replaced with square 1.5px rule and no blur.

### Named rules

**The flat-by-default rule.** No sheet floats. Borders mark sheets, invert marks selection, and scale marks press. A shadow is a regression.

## Shapes

Sharp and square. All radii are `0`. Cards, buttons, inputs, tabs, pills, bars, avatars, and icon wells are rectangles with 1 to 1.5px rules. Where a radius would soften, the system uses a rule or an invert instead. Pills are squares with 1px interior rules at 12 to 22 percent tint, not capsules. Bars are rectangles with 1px track border and square fill. Avatar wells are 38 squares with 1px rule, not 12 radius. The outer ledger `3xl 24` and `2xl 16` are now `0`.

## Components

### Buttons

- **Shape.** Shape is square `0` with `1.5px` rule. Padding is `12 16` at md and `10 12` at sm. Radius stays `0`.
- **Primary.** Ink fill is `#9a3412` on light with white mono label, and invert `#7aa2f7` on dark with `#1a1b26` label. Hover goes to `#7c2d12` on light and `#ffffff` on dark. Active uses `scale 0.98`.
- **Ghost.** Ghost uses surface fill with `1.5px` ink rule and ink label.
- **Icon.** Icons use Ionicons at 18 to 22 with square stroke, not round.

### Chips

- **Style.** Style is square sheets with `1px` rule at `color 45` percent and ground at `color 22` percent. Padding is `6 10` at xs to `11 5.5` at md with mono 12 to 14 tabular.
- **State.** State is static. Selected chips invert. Selected chips use ink fill with paper label.

### Cards and containers

- **Corner style.** Corners are `0` everywhere.
- **Background.** Background is `surface` sheet with `1.5px` ink rule and no shadow.
- **Internal padding.** Padding is `12` tight and `16` comfortable. Ledger header band uses `surfaceAlt` with 1.5px below rule.

### Inputs and fields

- **Style.** Style is surface sheet with `1.5px` ink rule, `0` radius, `10 12` padding, and mono 14.
- **Focus.** Focus is `1.5px` solid ink square outline at `1px` offset with no glow and no inset ring.
- **Disabled.** Disabled uses `0.5` opacity, not muted color.

### Navigation

Left rail is 104 on wide with `1.5px` right rule. Items are 80 wide with `0` radius and `1.5px` rule when focused. Focused items invert background to ink with paper label. Inactive items use `textMuted` on transparent. Bottom bar is `64` with insets and `1.5px` top rule. Items flex 1 with `0` radius and active invert. Labels use 9 mono uppercase wide tracking. Brand mark is 44 square with `1.5px` rule and `12` percent tint.

### Calorie gauge

Square perimeter gauge, not a circle. Size is 132 default, 136 mobile, 150 wide. Track uses `surfaceAlt`. Macro segments run clockwise from the top-left corner at 10 stroke with sharp mitred corners and 1.5 gap. Center uses 28 mono extra bold tabular. Label uses 12 mono muted uppercase. The gauge and the container share the same square.

### Loading spinner

Square well with a full `surfaceAlt` track. One single edge carries the ink and sweeps around the perimeter. The spinner uses no multi-side arc and no circle.

### Tab dock for phones

Height is 48 plus safe area with `1.5px` top rule. Icons are 18 in a 24 well with gap 2. Labels appear only at 480 and wider at 8px uppercase 0.08 tracking. Below 480, icons stand alone. No loose text sits on small screens. Active invert uses primary fill with paper icon.

### Meal section header

Square sheet with `1.5px` rule. Avatar is 38 square with `1px` rule. Label uses 13 mono uppercase `0.04` tracking. Kcal uses 15 mono. Goal line uses 10 mono. Pills stay square. Add button is 36 square with `1px` rule and primary invert.

Expanded rows for `DiaryEntryRow` use `38` icon, `13` name, `14` kcal, and `32` actions and keep the clip fix. `macroRow` uses `flexWrap wrap` with `columnGap 4` and `rowGap 4`. `info` uses `overflow hidden`. `kcalBlock` uses `flexShrink 0`. `pillContainer` uses `wrap` with `rowGap 4`. `pillXs` uses `6 by 2` and `11 by 14`. Bigger metrics wrap to a second line instead of clipping into `kcal` or `actions`.

### Modal dismissal

Every modal dismisses on backdrop tap and `Escape`. `ModalContainer` wide renders an absolute `Pressable` backdrop behind the centered dialog and calls `useSafeBack` with `useEscapeToClose`. `MealSlotModal` with the `+` FAB sheet and `CreateOptionsModal` with the three-dot sheet both use a dim `rgba` `View` centered with an absolute backdrop `Pressable` and `useEscapeToClose`. The sheet `Cancel` is a boxed button with `1.5px` `border`, `surfaceAlt`, `px-6 py-2.5`, and mono uppercase.

### Modal header

Every functional dialog takes `ModalHeader` in `src/components/ModalHeader.tsx`. The header shows a 5px accent bar on the top edge, then a tinted band with a solid accent icon well, an accent title, and a muted subtitle. Water uses water cyan. Weight uses weight violet. Create and pickers use primary or the target meal color. Text inside dialogs never uses gluestack gray scales. Titles use ink. Secondary copy uses `textMuted`. Both use explicit styles, so contrast holds on native and web.

### Log meal FAB cluster

Search sits next to scan on the right. `FabCluster` puts search and scan on the right and back on the left. Never use center gap across the screen. Quick-add and meal log refresh only the logged section. The list shows no `FlatList` flash. Collapsed preview caps at `3` with `+N more`.

### Bottom one-hand dock

Four flex squares at 56 tall use `1.5px` ink rule and surface fill. Icons are 18 mono black. Labels use 9 mono `BRKF LUNCH DINR SNCK` uppercase 0.06 tracking. The row adds a primary water square 56 with ink invert. Gap is 8 with thumb arc centered and pointerEvents box-none.

### Segmented control

Square well with `1px` ink rule and `surfaceAlt` ground. Options flex 1 square. Active option uses ink fill with paper label.

### Number stepper

Square minus and plus at 36 or 48 use `1.5px` ink rule and surface fill. Central input is square 68 to 120 with `1.5px` rule and 19 mono bold centered. Long-press repeats at 90ms.

## Do and do not

### Do

- Keep every sheet square with a 1.5px ink rule. The grid and the rule carry the depth.
- Give controls that sit side by side the same box height. Stepper keys equal input. Quick-add wells equal quick-add buttons. Footer pairs stay equal. Mixed heights inside one row read as breakage.
- Keep numbers mono tabular at `28 16 13`, so the ledger never reflows.
- Use the thumb dock for one-hand logging. Use four meal squares with water quick add, 48 minimum, and labels uppercase wide.
- Center the ledger in `720` with `12 16` rhythm and respect the 24px graph.
- Invert for selection. Ink fill with paper label is the only selected state.

### Do not

- Round anything. Use no `3xl`, no `full`, and no `12` radius.
- Shadow anything. Use no `soft-2`, no `0 8 24`, and no blur.
- Tint header weight with teal scatter. Ink is the header weight. Color stays only for data where needed.
- Hide focus. The `1.5px` square outline at `1px` offset is not optional.
- Rely on color for meal identity. Labels `BRKF` and similar carry the ledger, not hue.
- Trap content behind the dock. Scroll reserves `pb-40` on phones.
