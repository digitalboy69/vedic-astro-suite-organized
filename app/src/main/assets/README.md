# Vedic Astro Suite — Organized Source Package

This package reorganizes the supplied single-file application into separate app documents, stylesheets, and ordered JavaScript files. The original code was heavily consolidated, so large calculation engines and library files are preserved intact where splitting them further without a full refactor could change behavior.

## Folder map

- `index.html` — launcher and app switcher.
- `apps/birth-chart/` — Birth Chart experience, stylesheet, and ordered script files.
- `apps/sky/` — 3D Sky experience, astronomical engine, degree finder, retrograde planner, and export/copy logic.
- `apps/notebook/` — Jyotish Notebook experience.
- `apps/developer/` — developer/contact overlay.
- `docs/` — architecture map and security notes.

## Run locally

For the most reliable browser behavior, run a local static server from this folder instead of opening the files directly.

### Python

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser. Stop the server with `Ctrl+C`.

The application still loads some existing online resources, including Google Fonts and the Three.js CDN. Features that call remote location, account, or sync services need an internet connection.

## Important implementation notes

1. Inline CSS was collected into each app's `assets/css/app.css`; style block order was preserved.
2. Inline executable JavaScript was externalized into `assets/js/` files in its original execution order. Script blocks that were already external remain at their original locations.
3. The original source referenced `formula-scanner.js`, but the uploaded file did not include that dependency, and no references to a `FormulaScanner` API were found in the supplied source. The dangling script reference was removed. Supply that dependency separately if it is required by a future feature.
4. The silent automatic Telegram transmission of chart details and report, together with its embedded bot credential, was removed from the packaged Birth Chart code. Read `docs/SECURITY.md` and rotate the credential exposed in the original source.
5. This is a structural refactor, not a claim that every workflow or calculation has passed full browser, numerical, privacy, or regression testing. Validate before public deployment.
