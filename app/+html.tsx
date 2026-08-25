import { ScrollViewStyleReset } from "expo-router/html"
import type { PropsWithChildren } from "react"

/**
 * Root HTML shell for static web output (Node-only at build time; also
 * rendered per-route by the dev server when `web.output` is "static").
 * Adds global head elements: title, meta description, theme color, and a
 * `<main>` landmark so every route satisfies the basic document checks.
 *
 * NOTE: do not add a `public/index.html`. With static output the dev server
 * serves that file raw (no bundle script, no placeholder substitution), which
 * leaves the app shell spinning forever.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <title>Dietinator: calorie and macro tracker</title>
        <meta
          name="description"
          content="Dietinator is a fast, ad-free calorie tracker that works offline. Log meals, track calories and macros, and search the YAZIO food database."
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var d=document.documentElement;var m=window.matchMedia('(prefers-color-scheme:dark)').matches;var t=null;try{t=localStorage.getItem('calorie_tracker_theme_preference')||localStorage.getItem('theme')}catch(e){}var dark=t==='dark'||((!t||t==='system')&&m);if(dark){d.classList.add('dark');d.style.colorScheme='dark'}else{d.classList.remove('dark');d.style.colorScheme='light'}}catch(e){}",
          }}
        />
        <link
          rel="preload"
          href="/assets/fonts/DepartureMono-Regular.otf"
          as="font"
          type="font/otf"
          crossOrigin="anonymous"
        />
        <style>{`@font-face{font-family:"Departure Mono";src:url("/assets/fonts/DepartureMono-Regular.otf") format("opentype");font-weight:400 800;font-style:normal;font-display:swap;size-adjust:100%;ascent-override:95%;descent-override:25%}`}</style>
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f1f5f9" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1a1b26" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta property="og:title" content="Dietinator: calorie and macro tracker" />
        <meta
          property="og:description"
          content="Dietinator is a fast, ad-free calorie tracker that works offline. Log meals, track calories and macros, and search the YAZIO food database."
        />
        <meta
          property="og:image"
          content="https://dietinator.kadatodev.workers.dev/assets/icon.png"
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://dietinator.kadatodev.workers.dev/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Dietinator: calorie and macro tracker" />
        <meta
          name="twitter:description"
          content="Dietinator is a fast, ad-free calorie tracker that works offline. Log meals, track calories and macros, and search the YAZIO food database."
        />
        <meta
          name="twitter:image"
          content="https://dietinator.kadatodev.workers.dev/assets/icon.png"
        />
        <link rel="canonical" href="https://dietinator.kadatodev.workers.dev/" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico?v=4" sizes="any" />
        <link rel="icon" type="image/png" href="/assets/favicon.png?v=4" sizes="48x48" />
        <link rel="apple-touch-icon" href="/assets/icon.png?v=4" />
        <link rel="preconnect" href="https://yzapi.yazio.com" crossOrigin="anonymous" />
        <ScrollViewStyleReset />
        {/*
          The app's height chain is html/body, then main, then #root. `main` has no
          default height, so `#root { height: 100% }` (set by the reset) would
          resolve against an auto-height parent and collapse the app to zero.
        */}
        <style>{`main{height:100%}`}</style>
        <style>{`.skip-link{position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;z-index:10000;padding:8px 16px;background:#ffffff;color:#1a1b26;border:1.5px solid #1a1b26;font-family:"Departure Mono",monospace;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;text-decoration:none}.skip-link:focus{left:8px;top:8px;width:auto;height:auto;overflow:visible}`}</style>
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
              background: #1a1b26;
            }
          }
          .app-shell-spinner {
            position: relative;
            width: 32px;
            height: 32px;
            border-radius: 0;
            border: 2px solid #cbd5e1;
          }
          .app-shell-spinner::after {
            content: "";
            position: absolute;
            background: #0b57d0;
            animation: edge-march 0.64s steps(1, end) infinite;
          }
          @keyframes edge-march {
            0% {
              top: -2px;
              left: -2px;
              right: -2px;
              height: 2px;
              bottom: auto;
              width: auto;
            }
            25% {
              top: -2px;
              bottom: -2px;
              right: -2px;
              width: 2px;
              left: auto;
              height: auto;
            }
            50% {
              bottom: -2px;
              left: -2px;
              right: -2px;
              height: 2px;
              top: auto;
              width: auto;
            }
            75% {
              top: -2px;
              bottom: -2px;
              left: -2px;
              width: 2px;
              right: auto;
              height: auto;
            }
            100% {
              top: -2px;
              left: -2px;
              right: -2px;
              height: 2px;
              bottom: auto;
              width: auto;
            }
          }
          @media (prefers-color-scheme: dark) {
            .app-shell-spinner {
              border-color: #292e42;
            }
            .app-shell-spinner::after {
              background: #7aa2f7;
            }
          }
          html[data-shell-hide] #app-shell {
            display: none;
          }
        `}</style>
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <span
          dangerouslySetInnerHTML={{
            __html:
              "<!-- THESIS: Field terminal replaces soft ledger with square ink and grid, refusing pill and shadow, owning one-hand fast logging. OWN-WORLD: Paper #ffedd5 grid 24 on ink #9a3412 rule 1.5, void #1a1b26 on #7aa2f7, mono Departure everywhere, 0 radius, flat invert, thumb dock 52 squares. Harvest deep: #9a3412 ink, #ffedd5 paper, #fed7aa wells, Wong meals #0072B2 #E69F00 #D55E00 #009E73. STORY: Solo tracker sees graph paper, ring, square meal sheets, taps BRKF dock to log without corridor, quick H2O, reads budget instantly. FIRST VIEWPORT: Grid fills viewport, date chrome square with flame, ring centered in square sheet, four meal squares below, bottom dock thumb arc above tab bar. FORM: Operate field terminal, pinned brief sharp beats roll b9619c3c, Storm #1a1b26 #7aa2f7 #bb9af7 #f7768e #e0af68. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->",
          }}
          style={{ display: "none" }}
        />
        <div id="app-shell" aria-hidden="true">
          <div className="app-shell-spinner" />
        </div>
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
      </body>
    </html>
  )
}
