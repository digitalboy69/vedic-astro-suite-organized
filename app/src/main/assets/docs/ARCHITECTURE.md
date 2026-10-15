# Architecture Map

## Launcher (`index.html`)

The launcher owns the welcome/loading screen, floating app switcher, and app selection. It loads each app from a relative path inside an iframe. `#chart` opens Birth Chart, `#sky` opens 3D Sky, and `#notes` opens Jyotish Notebook. The developer/contact overlay is loaded from `apps/developer/index.html`.

## Birth Chart

| File | Responsibility inferred from source |
|---|---|
| `assets/js/01-contact-helper.js` | Copy contact number to clipboard |
| `assets/js/02-app-core.js` | Main chart calculations, panel builders, profile/storage, navigation, report orchestration |
| `assets/js/03-varga-interface.js` | Divisional-chart interface |
| `assets/js/04-chart-reading.js` | Plain-language chart-reading helper |
| `assets/js/05-life-activation.js` | Date-based life activation helper |
| `assets/js/06-bhava-bala.js` | Bhava Bala panel logic |
| `assets/js/07-tithi-pravesh.js` | Tithi Pravesh logic |
| `assets/js/08-sahams.js` | Sahams calculations and presentation |
| `assets/js/09-fate-meter.js` | Fate Meter calculation/presentation |
| `assets/js/10-export-copy.js` | Copy/export support |
| `assets/js/11-qrcode-library.js` | Embedded QR-code library |
| `assets/js/12-chart-sharing.js` | Share chart through URL/QR workflow |
| `assets/js/13-cloud-account.js` | Account and cloud-sync functionality |

The main app core remains a large file because it contains many interdependent functions and global declarations. It should be split further only after regression fixtures and browser tests are in place.

## 3D Sky

The 3D Sky page preserves script order: the Three.js CDN is loaded first, followed by the astronomical engine, degree/return finder, retrograde planner, and export/copy add-on.

## Notebook and Developer

The Notebook has one application script and a bundled stylesheet. The Developer/Contact overlay has its own stylesheet and small interaction script.
