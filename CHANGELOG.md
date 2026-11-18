# Changelog

All notable changes to Conductor. Versions follow semver; the in-app **Revisions** page shows this file.

## [0.2.0] - 2026-11-17

PSS/E and ANDES ready: modeling data on every device, and a study-case export (D-011).

### Added
- **Modeling fields** on sources, transformers, cables, loads, motors, capacitors, reactors and buses, for power flow, short circuit and dynamics. They live in the Design phase and the inspector groups them as **Model: Power flow / Short circuit / Dynamics**, each with a readiness badge. Fields can be conditional (GENROU parameters show only when the model is GENROU). Values that came from a typical-value library are marked **typical**; editing one makes it yours.
- **Overhead line** equipment (palette › Lines): conductor, phase spacing, length, R/X/B per mile, ratings and zero-sequence data. It exports as a branch.
- **Typical-value libraries**: cable impedance by size and material (NEC Table 9), ACSR line constants from conductor and spacing (Carson), transformer X/R and %Z by MVA, and default parameter sets for GENROU, GENSAL, GENCLS, SEXS, ESST1A, IEEET1, TGOV1, GAST, IEEEG1, the WECC REGCA1/REECA1/REECC1/REPCA1 set, the wind WTDTA1/WTARA1/WTPTA1/WTTQA1 models and CIM5BL.

- **Study page** (left nav): system MVA base, frequency, cable-collapse thresholds; a **readiness report** (islands without a swing bus, missing or conflicting base kV, transformer kV that does not match its buses, missing study values, zero or negative impedance, duplicate bus numbers, and every typical value used), where each item opens the object on the SLD; the **bus-branch table** (bus number, name, base kV, type, island, member objects); **Save bus numbers** and **Apply typicals**; and **RAW v33 export**.
- Node-breaker to bus-branch reduction: closed switching devices, buses, CTs and ties merge into study buses; open devices split them; cables with a length become branches (short ones merge). PSS/E bus numbers are sticky across exports.
- **SEQ export** (short circuit): machine positive/negative/zero-sequence impedances, zero-sequence branch data, and transformer zero-sequence data with connection codes from the Δ/Y/Yg fields and neutral grounding (D-015).
- **Bus-number overlay** on the canvas (toolbar › Study overlay) in the Design lens.
- `npm run study:check`: exports the sample project and runs ANDES power flow on it (`scripts/andes-check.py`, Python venv in `.venv-study`).
- The sample project gains an overhead line, a capacitor bank, a standby generator and a PV array behind an inverter.

- **All Home Conductor themes**: Glacier, Retro, Ember and Robot join Desert light and night. They are picked from theme cards in Settings, and the top-bar button steps through them. Each theme includes canvas colors for symbols, wires, selection, trace and commissioning (D-014).

### Changed
- Project files move to schema 2 (D-012). Transformer voltage ratio text ("13.8-0.48 kV") becomes numeric HV/LV (and tertiary) winding voltages; older files migrate automatically.
- Pasting a bus drops its PSS/E bus number so numbers stay unique.

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
