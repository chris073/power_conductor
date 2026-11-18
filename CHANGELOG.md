# Changelog

All notable changes to Conductor. Versions follow semver; the in-app **Revisions** page shows this file.

## [0.1.1] - 2026-11-17

### Added
- `scripts/perf-cdp.mjs`: a repeatable, dependency-free performance check. It drives headless Chrome over the DevTools protocol and reports frame times for pan, zoom and drag on the 500-object / 700-connection generated diagram. The production build holds 60 fps with no long tasks (docs/DECISIONS.md D-010).

### Changed
- The inspector opens the first phase tab that has fields when the current lens phase has none for the selected type (for example, a breaker in the Concept lens opens on Design).

## [0.1.0] - 2026-11-17

First working sketcher.

### Added
- App shell in the Home Conductor visual language (Desert light/dark): top bar with the CONDUCTOR wordmark, editable project name, lifecycle lens switcher, save indicator and theme toggle; a side nav; a status bar with cursor, zoom, selection count, sheet, lens and app version.
- **SLD sketcher** on an infinite canvas: grid with snap, pan (Space+drag or middle mouse), zoom at the cursor, zoom to fit, minimap.
- Searchable, categorized **symbol palette** with drag-to-place or click-to-place. ANSI-style symbols: utility, generator, PV, BESS, inverter/PCS, wind turbine; 2- and 3-winding transformers with Δ/Y/Yg; breaker (draw-out or fixed), disconnect, load-break switch, fuse, recloser, contactor (each with an open/closed symbol); bus, switchgear lineup (container), MCC, panelboard; CT, VT, protective relay (ANSI device numbers), meter, surge arrester; motor, load, capacitor bank, reactor; ground, tie/off-sheet connector, text note, revision cloud.
- Editing: select, Shift/Ctrl-click, marquee, move, rotate 90°, mirror, delete, duplicate, copy/cut/paste (new IDs and tags), align and distribute, arrow-key nudge, undo/redo, and a `?` shortcut overlay.
- **Connections** from terminal to terminal with right-angle routing and draggable segment handles. Manual routes survive later moves. Cables are objects with their own properties. CT/VT secondaries make dashed control wiring.
- **Bus bars** that stretch from either end and accept any number of connections anywhere along their length (drop a connection on the bus). Taps can slide along the bus.
- **Inspector** with ID, type and tag, an open/closed toggle, phase tabs from the property schemas (with required-field markers), a choice of two canvas label ratings, clickable connections and custom properties.
- **Lifecycle lens** (view only): Concept shows tags; Design shows ratings and a missing-required badge; Commissioning colors objects by status with a legend; Operations shows energization from all sources and O&M flags.
- **Energization trace** from a selected source: it highlights everything downstream through closed devices and marks open devices as the boundary. It updates live as you open and close devices.
- **Projects** page: create, rename, duplicate, delete, open, plus a sample project. Projects hold several sheets (tabs under the canvas).
- Projects **autosave** to the browser as one versioned JSON document (with schemaVersion and migrations). Export and import use the same format.
- **Settings**: symbol standard (IEC falls back to ANSI for now), kV/V display, grid size and snap, default routing, minimap, theme, autosave delay, export/import, reset local data.
- **Features** page (the roadmap from `features.json`), **Claude Instructions** page (renders `CLAUDE.md`), and a **Revisions** page that lists app versions from this changelog.
- Dev-only generator for a 500-object / 700-connection diagram (toolbar button in `npm run dev`).
