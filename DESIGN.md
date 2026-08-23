<!-- provenance: seed b9619c3c pinned brief terminal sharp square beats roll, per app/+html.tsx contract, capture 390x844@2 at localhost:9089 -->

---

name: Dietinator
description: Field terminal for solo nutrition - sharp, square, mono, one-thumb ledger - provenance seed b9619c3c pinned brief beats roll
colors:
primary: "#9a3412"
primary-dark: "#7aa2f7"
primary-strong: "#7c2d12"
primary-strong-dark: "#7dcfff"
background: "#ffedd5"
background-dark: "#1a1b26"
surface: "#ffffff"
surface-dark: "#24283b"
surface-alt: "#fed7aa"
surface-alt-dark: "#292e42"
text: "#431407"
text-dark: "#c0caf5"
text-muted: "#7c2d12"
text-muted-dark: "#a9b1d6"
text-on-background: "#431407"
text-on-background-dark: "#c0caf5"
border: "#c2410c"
border-dark: "#6b739c"
breakfast: "#0072B2"
breakfast-dark: "#6aa8ff"
lunch: "#E69F00"
lunch-dark: "#FFB020"
dinner: "#D55E00"
dinner-dark: "#ff7a92"
snack: "#009E73"
snack-dark: "#2EC4B6"
danger: "#9f1239"
danger-dark: "#ff7a8e"
warning: "#92400e"
warning-dark: "#e0af68"
ink-grid: "rgba(154,52,18,0.08)"
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

# Design system: Dietinator

## Overview

**Creative north star: "The field terminal"**

Dietinator is now a handheld field computer for your own body. No soft paper, no pill buttons, no floating shadows. Every surface is a sheet of graph paper ruled at 24px in light and dotted void in dark, edged by a 1.5px ink rule, stacked with zero radius. The ledger is read like an instrument. Mono columns never jitter. Square keys fill the thumb arc. A single data accent appears only where the body counts. The machine is clean, fast, and deliberately low chrome so the diary stays legible at a glance between bites or with one hand on a crowded train.

This replacement world keeps product truth, content, function, and constraints, and discards the ledger-soft previous system as evidence. Operate mode governs. Task, state, and familiar affordance outrank expression. The first viewport must prove the mechanism immediately.

**Key characteristics:**

- Square strict. Every card, button, input, bar, and tab is `0` radius with a 1.5px ink rule. Tinted chips use 1px interior rules not glows.
- Mono ledger. JetBrains Mono everywhere. Tabular-nums forced. Headings uppercase at 0.04 to 0.08 tracking.
- Paper grid system. 24px graph on `#ffedd5` light and 24px dotted void on `#1a1b26` dark. No gradients, no blur.
- Harvest deep. Light is now deep amber paper #ffedd5, wells #fed7aa, ink #9a3412 burnt orange. Wong meals #0072B2 #E69F00 #D55E00 #009E73 carry macros colorblind-safe and very vibrant. Dark stays Tokyo Night.
- Thumb-first density. Tight 4 to 12 rhythm. Generous separation between groups. Bottom dock of 52 square keys for one-hand logging.
- Flat authority. No shadows. Elevation is border weight and invert. Pressed is `scale 0.98` not lift.

## Colors

Restrained strategy. Neutrals carry the page, one ink carries chrome, semantic keeps danger and warning only.

### Primary

- **Ink. The only chrome fill uses #9a3412 on light and #7aa2f7 on dark. Square primary buttons, active tab invert, and ledger rules use it. Light uses white `onPrimary` at 7.31:1. Dark uses `#1a1b26` on off-white at 16.2:1. Deep burnt orange, darker and more orange than before.**
- **Ink strong. Uses #7c2d12 on light and #ffffff on dark. It gives hover and pressed depth. No mid tint, only ink or paper.**

### Secondary

- **Paper grid. Uses #ffedd5 on light and #1a1b26 on dark. Deep amber paper #ffedd5 with wells #fed7aa replaces pale cream, grid at rgba(154,52,18,0.08) more orange and darker. It is the ground that shows the 24px graph. It is not decoration, it is the ledger ruling.**

### Tertiary

- **Terminal Data - light as grayscale luminance steps, dark retains phosphor teal #0e8c7a and amber and magenta for macro photometer clarity on the void. Both use 1px interior rules. Hue never fights the mono ledger, it measures.**

### Neutral

- **Surface. Uses #ffffff on light and #141616 on dark. Sheets, cards, and modals use it. Each sheet carries a 1.5px `#9a3412` rule on light and `#414868` on dark.**
- **Surface alt. Uses #fed7aa on light and #1e2122 on dark. Deeper amber well #fed7aa replaces peach. Wells, tracks, and chip grounds use it. Bar track background uses it.**
- **Ink. Uses #431407 on light and #c0caf5 on dark. Body and numerals use it. Burnt umber 13.6:1 on #ffedd5, darker paper still holds.**
- **Ink muted. Uses #7c2d12 on light and #a9b1d6 on dark. Darker terracotta, deeper and more orange. Secondary labels and helper use it.**
- **Ink on background. Uses #431407 on light and #c0caf5 on dark. Section titles on the grid ground use it. Holds 13:1 on deeper amber.**
- **Line. Uses #c2410c on light and #414868 on dark. Deeper burnt orange, more saturated than #ea580c. Every hairline and card edge is 1.5px on light and 1px on dark. Never hairline 1px on light because it disappears on the paper grid.**
- **Alert. Danger uses #9f1239 on light and #f7768e on dark and is square. Warning uses #92400e on light and #e0af68 on dark and is square. Progress over budget flips to danger ink plus 12 percent tint. It never glows.**

### Named rules

**The Ink Rule.** If a surface needs emphasis it gets a heavier rule or an invert, never a shadow, glow, or tint scatter. Ink is the hierarchy.
**The No Pill Rule.** No pill, no capsule, no rounded tag. Every control is a square sheet with a square label.

## Typography

**Display font. JetBrainsMono NFM, Nerd Font Mono build, no ligatures. JetBrains Mono is the fallback.**
**Body font. JetBrainsMono NFM.**
**Label and mono font. JetBrainsMono NFM, tabular-nums, -0.01em.**

**Shipping contract.** The face is bundled, not fetched. TTFs live in `assets/fonts/` with weights 400 to 800. Web registers them through `src/utils/web-fonts.ts` via the CSS Font Loading API. Android resolves the family from `android/app/src/main/assets/fonts`. The NFM build ships without ligatures by Nerd Fonts policy. The ledger needs this so glyph pairs never fuse. No remote font requests run at runtime.

**Character. Terminal instrument, not decorative mono costume. Every numeral is tabular so columns hold when `1840` becomes `2012`. Headings are uppercase, tight, and crowded. Body is small and breathable at 13 and 1.5. The mono texture carries the ledger without needing color.**

### Hierarchy

- **Display. Uses 800, clamp 28 to 32, 1.0, -0.03. App name on login and empty terminal prompts only. Uppercase.**
- **Headline. Uses 700, 16, 1.2, -0.02. Section headers `MEALS` and `TODAY · MON` in uppercase tracking 0.04.**
- **Title. Uses 700, 13, 1.3, 0.04. Meal labels `BRKF LUNCH DINR SNCK`, card titles, and dock keys.**
- **Body. Uses 400, 13, 1.5, -0.01. Forms, row names, and helper copy. Measure 65 to 75ch because containers cap at 720.**
- **Label. Uses 700, 10, 0.08, uppercase. Chips, badges, chart ticks, and tab labels at 9 to 10, always uppercase with wide tracking.**
- **Mono. Uses 700, 12, 1.4, -0.01. Every changing number. Ring 28, row kcal 16, bar 13, stepper 19.**

### Named rules

**The Tabular Numbers Rule.** Any numeral that updates is mono tabular. Body text never carries the remaining budget. The ring 28, row 16, bar 13 all mono.

## Layout

Graph-paper grid, thumb-first. `breakpointMedium` is 600. `breakpointWide` is 900. `maxWidthContent` is 720. `maxWidthWide` is 1100. `maxWidthNarrow` is 420. `sideTabWidth` is 120, drawn at 104. `tabBarHeight` is 64 plus safe area. Spacing scale is tight. `xs` is 4, `sm` is 8, `md` is 12, `lg` is 16, `xl` is 24, `2xl` is 32. Space is tight inside groups and generous between groups. More space sits above a heading than below it.

`PageContainer` centers the page at `maxWidthContent`. It uses `p-4` at base and `px-6` on wide. On narrow, the scroll reserves `pb-40` to clear the dock and the tab bar. At 900 the Today view splits into two flex columns at 0.95 and 1.05 with a 16 gap. Meals wrap at 48 percent basis and 280 minimum. The topology stays the same as before, but sheets are square and ruled.

One-hand dock. On phones a fixed row sits above the tab bar at `insets.bottom + 64 + 10`. It uses left and right 12, flex row gap 8, four squares flex 1 min 56 tall for Breakfast, Lunch, Dinner, and Snack each 52 square, plus a 56 square primary water quick add at the end. Hit targets are 48 minimum. Thumb arc is centered. Labels `BRKF` and similar are 9 mono wide.

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

- **Style. Surface sheet with `1.5px` ink rule, `0` radius, `10 12` padding, mono 13.**
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
