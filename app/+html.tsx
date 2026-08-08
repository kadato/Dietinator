import { ScrollViewStyleReset } from "expo-router/html"
import type { PropsWithChildren } from "react"

/**
 * Root HTML shell for static web export (Node-only at build time).
 * Adds global head elements: title, meta description, theme color, and a
 * `<main>` landmark so every route satisfies the basic document checks.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>Dietinator — Calorie & macro tracker</title>
        <meta
          name="description"
          content="Dietinator is a fast, ad-free calorie tracker that works offline. Log meals, track calories and macros, and search the YAZIO food database."
        />
        <meta name="theme-color" content="#0f766e" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <ScrollViewStyleReset />
        {/*
          The app's height chain is html/body → main → #root. `main` has no
          default height, so `#root { height: 100% }` (set by the reset) would
          resolve against an auto-height parent and collapse the app to zero.
        */}
        <style>{`main{height:100%}`}</style>
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  )
}
