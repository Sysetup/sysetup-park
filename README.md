# SYSETUP website

SYSETUP is a small static website for the systems development company. The
runtime is deliberately limited to HTML, CSS, and browser JavaScript with
local assets only.

## Runtime structure

- `index.html` contains the complete semantic document and essential contact
  information.
- `style/site.css` contains the consolidated visual system and responsive
  behavior.
- `js/app.js` bootstraps optional enhancements.
- `js/content.js` contains presentation copy and bounded asset constants.
- `js/modules/` contains the clock, typewriter, background stream, and bounded
  local-text loader.
- `assets/background.txt` is the local decorative text corpus.
- `fonts/Doto-Black.woff2` and `favicon.png` are local presentation assets.
- `CNAME` records the site domain expected by the hosting boundary.

The page remains useful when JavaScript or the optional background asset is
unavailable: the description, contact links, and company statement are
rendered directly in HTML.

## Content changes

Keep essential copy in `index.html` and rotating decorative copy in
`js/content.js`. When changing the background, edit `assets/background.txt`
as plain text only. It is inserted with `textContent`, never interpreted as
HTML.

Use local relative paths for runtime resources. Do not add analytics,
trackers, remote scripts, remote fonts, or client-side storage without a new
documented product decision.

## Local preview

Open `index.html` through the editor or an existing static-file preview. A
regular HTTP origin is required for the optional background fetch; direct
`file://` opening still presents the essential page but may omit that
decorative layer.

The repository contains the website source only. Hosting and release
operations remain outside this project.

See [`docs/README.md`](docs/README.md) for the current implementation
contract and scope decisions.
