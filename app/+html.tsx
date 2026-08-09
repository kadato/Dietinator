import { ScrollViewStyleReset } from "expo-router/html"
import type { PropsWithChildren } from "react"

/**
 * Root HTML shell for static web output (Node-only at build time; also
 * rendered per-route by the dev server when `web.output` is "static").
 * Adds global head elements: title, meta description, theme color, and a
 * `<main>` landmark so every route satisfies the basic document checks.
 *
 * NOTE: do not add a `public/index.html` — with static output the dev server
 * serves that file raw (no bundle script, no placeholder substitution), which
 * leaves the app shell spinning forever.
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
        <meta name="mobile-web-app-capable" content="yes" />
        <ScrollViewStyleReset />
        {/*
          The app's height chain is html/body → main → #root. `main` has no
          default height, so `#root { height: 100% }` (set by the reset) would
          resolve against an auto-height parent and collapse the app to zero.
        */}
        <style>{`main{height:100%}`}</style>
        <style>{`
          #app-shell {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f1f5f9;
          }
          @media (prefers-color-scheme: dark) {
            #app-shell {
              background: #141416;
            }
          }
          .app-shell-spinner {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: 3px solid rgba(13, 148, 136, 0.25);
            border-top-color: #0d9488;
            animation: app-shell-spin 0.8s linear infinite;
          }
          @keyframes app-shell-spin {
            to {
              transform: rotate(360deg);
            }
          }
          html[data-shell-hide] #app-shell {
            display: none;
          }
        `}</style>
      </head>
      <body>
        <div id="app-shell" aria-hidden="true">
          <div className="app-shell-spinner" />
        </div>
        <main>{children}</main>
      </body>
    </html>
  )
}
