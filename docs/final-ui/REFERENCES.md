# Patterns adopted from the integration UI

Read-only study of `origin/feat/integration` (`web/index.html`, `web/visual/platform.css`, `web/decode.html`) with
`git show`. Nothing was copied; these are patterns we re-implemented on our own tokens (`web/cinematic/site/tokens.css`).

| Pattern in the integration UI | What we adopted | Where |
|---|---|---|
| One shared header (`.shell`): brand left, short nav, language button right | One shared shell on every page: logo, five links, accessibility icon, EN \| العربية | `web/cinematic/site/nav.js`, `shell.css` |
| Skip link that appears on focus (`.skip`) | Skip link on every page | `nav.js` (`.site-skip`) |
| Brand is `direction: ltr` even in RTL | Logo and map geography never mirror in Arabic | `shell.css` (`.site-logo`), Studio map `dir="ltr"` |
| `[hidden] { display: none !important }` and a visible `:focus-visible` ring | Same rule and a 3 px focus ring on every control | `shell.css` |
| Sentence-first hero with two actions (`.arrival .actions`) | Decode landing and Studio entry: one sentence, one primary button | `web/index.html`, `earthmap.css` (`.em-entry`) |
| Honest framing next to media (figcaption) | Provenance badges: real data / related NASA visualization / decorative | `site.css` (`.badge-*`) |
| RTL font stack switch (`[dir="rtl"] --sans`) | Arabic stack with bundled IBM Plex Sans Arabic | `tokens.css`, `web/assets/fonts/` |
| `scroll-behavior: smooth` | Kept, disabled under reduced motion | `site.css` |

Not adopted: its green palette (we keep the EARTHPULSE teal/amber), its separate per-page headers, and the pages that
belong to other teammates (`dust.html`, `forest.html`, `decode.html`), which we do not touch.
