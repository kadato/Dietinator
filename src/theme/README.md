# Theme system

Modular, deduped styling for Dietinator. One palette, many surfaces, future themes plug in without touching 100 files.

## Layout

```
src/theme/
  palette.ts      - ColorPalette type, MealType
  tokens.ts       - spacing, borders, radii, tints, overlays, layout, fonts, typography
  themes.ts       - lightColors, darkColors, ThemeName, themes registry, getColors, registerCustomTheme
  helpers.ts      - chipTint, cardStyle, borderStyle, iconBoxStyle, wellStyle, chipStyle, barTrackStyle
  styles.ts       - aliases for helpers (cardBase etc.) + thinBorder, flat primitive
  typography.ts   - mono presets, label/headline/body
  css.ts          - lightCssVars(), darkCssVars(), generateThemeCss() for global.css
  index.ts        - barrel: `import { spacing, getColors, cardStyle } from "@/theme"`
```

`src/theme.ts` and `src/theme.helpers.ts` stay as compatibility shims re-exporting this folder so `import from "@/theme"` keeps working.

## Single source of truth

`src/theme/themes.ts` owns every hex. `src/theme/css.ts` turns it into CSS vars. `global.css` mirrors those vars, `tailwind.config.js` meal tokens use `var(--meal-*)`, and `components/ui/gluestack-ui-provider/config.ts` is overridden by `global.css` for borders/primary. Update `themes.ts` and the whole app follows.

Do not hard-code hex elsewhere. Use `useTheme().colors` on native and `var(--app-*)` on web.

## Tokens

- `spacing`: 2xs 2, xs 4, sm 8, md 12, lg 16, xl 24, 2xl 32. Use these, not literals 6/10/12.
- `borders.width` 1.5, `borders.widthThin` 1, `radii.none` 0. Always reference these, not `1.5` or `0` literals.
- `tints`: chip 0.14, chipStrong 0.2, overlay 0.14, backdrop 0.45, highlight 0.22, grid 0.035.
- `overlays`: backdrop `rgba(0,0,0,0.45)`, highlight `rgba(255,255,255,0.22)`.
- `layout`: breakpoints 600/900/1280/1440 and shell widths.
- `fonts.mono`: Departure Mono everywhere, tabular-nums forced.

## Helpers

Use these instead of inlining 5 props:

- `chipTint(accent, alpha=0.14)` - 14% tinted well for chips, badges, icon wells.
- `cardStyle(colors)` - surface + 1.5px ink rule, flat.
- `borderStyle(colors)` - 1.5px ink rule, square.
- `iconBoxStyle(accent, colors)` - chip tint + ink rule.
- `wellStyle(colors)` - surfaceAlt well.
- `chipStyle(accent, {alpha, borderAlpha})` - full pill chrome.
- `barTrackStyle(colors)` + `barHighlight` - progress track/fill.
- `flat` - `{ borderRadius: 0, boxShadow: "none", elevation: 0 }`.

Before:

```ts
style={{ backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 0, boxShadow: "none", elevation: 0 }}
style={{ backgroundColor: `${accent}14` }}
```

After:

```ts
style={cardStyle(colors)}
style={{ backgroundColor: chipTint(accent) }}
```

## Adding a theme

1. Define palette in `src/theme/themes.ts`:

```ts
export const sepiaColors: ColorPalette = {
  background: "#fdf6e3",
  surface: "#eee8d5",
  // ... copy lightColors and recolor ...
}
```

2. Register it:

```ts
import { registerCustomTheme } from "@/theme"
registerCustomTheme("sepia", sepiaColors, { isDark: false })
```

Or add to `themes` object for a first-class theme:

```ts
export const themes = {
  light: { name: "light", colors: lightColors, isDark: false },
  dark: { name: "dark", colors: darkColors, isDark: true },
  sepia: { name: "sepia", colors: sepiaColors, isDark: false },
}
export type ThemeName = keyof typeof themes // "light" | "dark" | "sepia"
```

3. Add CSS vars in `src/theme/css.ts`:

```ts
export function sepiaCssVars(): CssVarMap { return { "--app-background": sepiaColors.background, ... } }
```

And in `global.css`:

```css
html.theme-sepia { --app-background: #fdf6e3; ... }
```

4. Extend `ThemePreference` in `src/types/index.ts` and `ThemeContext` if you want it selectable in Settings. The registry helpers `registerCustomTheme` / `getCustomTheme` already let runtime themes work without that.

5. Verify: `pnpm run typecheck`, check `global.css` and `tailwind.config.js` use vars, not hex.

## Deduplication checklist

- No `borderWidth: 1.5` literal - use `borders.width`.
- No `borderRadius: 0` literal - use `radii.none`.
- No `boxShadow: "none"` + `elevation: 0` pair without `flat` or `cardStyle`.
- No `${hex}14` suffix - use `chipTint` or `withAlpha`.
- No duplicated `--app-background` hex - derive via `css.ts`.
- No meal hex outside `themes.ts` - `tailwind.config.js` uses `var(--meal-*)`.

Run `grep -R "borderWidth: 1.5" --include="*.ts" --include="*.tsx" src app` - should be empty.
