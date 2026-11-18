# Decisions

Newest last. Each entry: what we decided, why, and what we gave up.

## D-001 Diagramming library: React Flow (`@xyflow/react`), MIT (2026-11-17)

**Decision.** Use React Flow with custom nodes (equipment symbols, buses, containers, notes) and a custom edge (orthogonal cable).

**Why.**
- It is React-native, and its node, handle and edge model maps directly onto equipment, terminals and connections.
- The canvas stays a projection of our own store, so the domain model is not owned by the library.
- Pan, zoom to cursor, fit, minimap, snap to grid, marquee and multi-select are built in.
- The license is MIT, with no runtime key.

**Alternatives.**
- **JointJS:** best built-in orthogonal routing and segment tools, but its Backbone graph would duplicate our model, and undo, clipboard and selection need JointJS+ (about $2,990 per developer).
- **Konva:** everything would be custom.
- **tldraw:** owns the data model, and commercial production use needs a paid license key.

**Costs we accepted.**
- Orthogonal routing with segment handles and bus attachment anywhere are our own code (`src/layout/routing`, `canvas/edges/OrthoEdge.tsx`, `canvas/nodes/BusNode.tsx`).
- React Flow has no node rotation, so rotated terminal positions are computed in `src/layout/geometry.ts`.
- npm resolved `@xyflow/react` 13.x. Its change API uses `NodeChangeset`/`EdgeChangeset` objects; we read changes and commit to our store rather than keeping React Flow state.

## D-002 The attribution badge is hidden (2026-11-17)

`proOptions.hideAttribution = true`, at the user's request. The MIT license allows it. xyflow asks commercial users to subscribe to React Flow Pro. Revisit before commercial release.

## D-003 Themes: Desert light and dark only (2026-11-17), superseded by D-014

Tokens are ported verbatim from Home Conductor's Desert theme (`src/styles/tokens.css`). The theme can be Auto (OS), Light or Dark, set by a pre-paint script in `index.html` (`localStorage['pc-theme']`). Other Home Conductor themes are on the roadmap.

Component styles are plain global CSS (`base.css`, `sld.css`) that reference tokens only. This is like Home Conductor, and simpler than the CSS Modules the plan proposed.

## D-004 "Revisions" means app versions for now (2026-11-17)

The Revisions page shows Conductor's own version history: `package.json` version plus `CHANGELOG.md`. The status bar shows the app version.

Drawing revision control is on the roadmap and not built: issuing A/B/0/1, IFR/IFC/As-Built, immutable snapshots, visual diff and revision clouds from a diff. So the data model has no `revisions` field yet. Revision clouds exist only as a manual annotation.

## D-005 Storage: one versioned JSON document per project, behind a swappable adapter (2026-11-17)

**Decision.**
- Each project is one `ProjectDoc` JSON (`schemaVersion` plus migrations in `src/domain/serialization`).
- It autosaves through `ProjectStorage` (`src/state/storage.ts`). The current adapter is localStorage: an index key plus one key per project.
- Export and import use exactly the same file format (`{ format: 'conductor-project', schemaVersion, project }`).

**Why.** Simplest thing that works, readable files, and easy to back up. Dexie/IndexedDB was dropped for now.

**Limits.** localStorage holds about 5 MB per origin. A 500-object project is a few hundred KB.

**Later.** Choosing between a database and JSON files, with a more formal structure, is a roadmap item. Only the adapter should need to change.

## D-006 Undo/redo with zundo on the whole document (2026-11-17)

- `temporal` wraps the project store, partialized to `{ doc }`, with equality by reference and a limit of 200 steps.
- Every action is one immutable update, so it is one undo step. No-op updates are skipped.
- Drags and resizes preview through local overrides in the canvas and commit once at the end. Inspector text fields commit on blur.

## D-007 Topology model (2026-11-17)

- Electrical nodes come from union-find over power terminals.
  - Connections join their two terminals.
  - Closed switches join their own terminals.
  - A bus joins all of its taps (one node with dynamic taps). MCCs and panelboards do the same.
  - A CT joins its two power terminals (zero impedance).
  - Tie connectors with the same link name are joined, across sheets too.
- A trace is a breadth-first search (BFS) from the start device. It passes through electrical nodes and through passive devices (transformers, reactors, inverters). It stops at open switching devices and reports them as the boundary.
- Control wiring (signal terminals) is never a power path.

## D-008 Testing: Vitest only for now (2026-11-17)

Domain and layout logic is covered by unit tests: topology, serialization and migrations, clipboard, routing, geometry and align. Playwright end-to-end tests are on the roadmap.

## D-009 Bus-tap behavior (2026-11-17)

Dropping a connection anywhere on a bus creates a tap at the snapped offset, and reuses an existing tap at the same offset. Taps whose last connection is deleted are removed. Stretching the bus from its start keeps taps at their absolute positions. Shrinking it clamps them.

## D-010 Performance at 500 objects / 700 connections: no extra optimization needed (2026-11-17)

**Check.** `scripts/perf-cdp.mjs` drives headless Chrome (1600×1000) over the DevTools protocol. It opens the dev-only generator (500 objects, 700 connections) and records `requestAnimationFrame` deltas and long tasks while it pans, zooms, and drags a device and a bus (a bus drag re-routes about 25 cables per frame). It runs once zoomed to fit (all 500/700 rendered) and once zoomed in (about 260/400 rendered, because `onlyRenderVisibleElements` culls the rest).

**Result (production build, `vite preview`).** Every case holds 60 fps: median frame 17.9 ms, p95 18.1 ms (34.8 ms for the bus drag), worst single frame 36 ms (one dropped frame), and zero long tasks over 50 ms. Committing a drag or undo with a full re-render takes about 26–37 ms.

**Dev build (`npm run dev`).** The median is still 60 fps, but there are periodic hitches of 50–140 ms while zooming or dragging at fit. A CPU profile puts that time in React's development runtime (`jsxDEV`, `runWithFiberInDEV`) and in React Flow's per-frame visibility and handle bookkeeping, not in our adapters, topology or routing.

**Decision.** No code changes. The things that already keep it fast stay as they are:
- the canvas is a memoized projection (`canvas/adapters.ts` `Memo` reuses unchanged node and edge objects);
- drags preview through local overrides and commit once at the end;
- decorations and trace are memoized on `doc`;
- store subscriptions are narrow (cursor and zoom re-render only the status bar);
- `onlyRenderVisibleElements` is on.

Re-run the script after canvas changes. If a larger diagram is needed later, the next steps would be: cull at fit with a level-of-detail mode (draw symbols as boxes below about 0.3 zoom), and incremental topology.

**Caveat.** Headless Chrome on one Windows machine. Real-GPU numbers in a visible window may differ slightly.

## D-011 Study export: PSS/E and ANDES ready (2026-11-17)

**Approved by the user** (this counts as the plan approval CLAUDE.md asks for before domain-model and file-format changes).

**Decision.** The SLD stays node-breaker. A plain-TypeScript study layer in `src/domain/study/` reduces it to a bus-branch case and writes PSS/E RAW v33, SEQ and DYR. ANDES reads the RAW and DYR for power flow and time-domain checks.

1. **Reduction (`study/reduce.ts`).** It reuses the topology union-find (`electricalNodes`), with one new option: connections that become branches are not joined. Closed breakers, disconnects, load-break switches, fuses, reclosers and contactors, CTs, buses, MCCs, panelboards and same-name ties all merge into one study bus. Open devices split buses. A cable with a length becomes a branch. A cable with no length, or shorter than the project's collapse threshold (default 10 ft), or with |Z| below the ohm threshold (default off), merges as a zero-impedance tie. Nodes that hold only switching devices, VTs, arresters or grounds are dropped. DC nodes (PV/BESS and the inverter DC side) are not study buses. A PV array or BESS wired to an inverter is exported as a generator at the inverter's AC bus, using the source's model data. Relays, CTs, VTs, meters and arresters are never exported.
2. **Bus identity.** A study bus that contains a drawn Bus object keeps its PSS/E number in that bus's `design.busNum` (user-editable). When closed ties merge several drawn buses, the lowest number wins. A study bus with no drawn bus keeps its number in `doc.study.busNumbers`, keyed by an anchor terminal `equipmentId:terminalId`. The anchor is picked deterministically: sources, then transformer and line terminals, then loads, each by equipment ID. Numbers are assigned on export (next free number) and written back to the project, so they stay the same across exports. The name is the bus tag (or anchor tag) cut to 12 characters. IDE is 3 for the island swing, 2 for buses with an in-service machine, 1 otherwise, and 4 for buses in an island with no source.
3. **Base kV (`study/basekv.ts`).** Seeds, strongest first: Bus `design.baseKv`, then Bus nominal `concept.kv`, then utility/generator/wind kV, then MCC/panelboard rated kV, then transformer winding kV. Seeds spread through zero-ratio branches (cables, lines, series reactors). Two different strong seeds in one voltage zone are a conflict. A transformer winding kV that differs from its bus base kV by more than 10 % is flagged (smaller differences are legal off-nominal ratios).
4. **Per unit (`study/perunit.ts`).** The system base is a project setting (`doc.study.baseMva`, default 100 MVA). Transformer %Z on the impedance base (default: the kVA rating) becomes R, X on the system base: Z = %Z/100 · (Sbase/Snom) · (V_LV,rated / V_LV,base)², split by X/R. RAW uses CZ = 1 and CW = 2 for two-winding units (winding kV), and CW = 1 for three-winding units (see D-013). Cables use Ω/1000 ft (NEC Table 9 units) and lengths in ft, which matches the existing `concept.lengthFt`. Overhead lines use Ω/mi and miles. Z_base = kV²/Sbase, B_pu = B_S · Z_base.
5. **Readiness (`study/readiness.ts`).** It reports, each with an object ID: islands with no swing, missing base kV, base kV conflicts, transformer kV not matching its buses, missing study values, zero or negative impedance, duplicate bus numbers, and every typical value used.
6. **Writers.** `raw.ts` (v33), `seq.ts`, `dyr.ts`. Formats follow the PSS/E 33 POM. Where ANDES reads a record differently, the writer stays inside valid v33 and the difference is noted in D-013.

**Schema.** `FieldDef` gains `showIf` (conditional fields, e.g. GENROU parameters only when the model is GENROU), `study` ('pf' | 'sc' | 'dyn'), `need` (counts on the readiness badge) and `dflt` (the typical default). Study fields live in the Design phase. The inspector shows them as "Model: Power flow / Short circuit / Dynamics" groups, each with a readiness badge. Dynamic model parameters are generated from the model library (`study/libraries/dynamics.ts`) as `design.dyn.<MODEL>.<PARAM>` and fold per model.

**Typical values.** `study/libraries/` holds conductor impedances (NEC Chapter 9 Table 9 for cables; ACSR data with Carson's equations for overhead lines), transformer X/R and %Z by MVA (IEEE C37.010 / IEEE 399 typical curves), and default parameter sets for GENCLS, GENROU, GENSAL, SEXS, IEEET1, ESST1A, TGOV1, GAST, IEEEG1, REGCA1, REECA1, REECC1, REPCA1, WTDTA1/WTARA1/WTPTA1/WTTQA1 and CIM5BL. The export never needs every value to be entered. Empty values are filled from the libraries and schema defaults, listed in the readiness report, and can be written back with **Apply typicals**. That marks them in `Equipment.typical` / `Connection.typical` (the keys whose value is a typical). Editing a value removes its mark.

**New equipment.** `line` (overhead line): two terminals, conductor, phase spacing, length, R/X/B per mile, ratings A/B/C, R0/X0/B0. It exports as a non-transformer branch.

**Alternatives.**
- Export node-breaker RAW v35 directly. Rejected for now: ANDES reads v33/v34 bus-branch only. It is on the roadmap.
- Store all bus numbers in one doc-level map. Rejected: a drawn bus should carry its own number in the inspector, where people expect it.
- Keep `kvRatio` text and parse it at export. Rejected: numbers are needed for base-kV propagation and per-unit math, and silent parsing hides errors.

## D-012 Project schema 2 (2026-11-17)

`SCHEMA_VERSION` 1 → 2, with migration `migrations[1]`:
- `ProjectDoc.study` (StudySettings: baseMva 100, freqHz 60, rawVersion 33, collapseFt 10, collapseOhm 0, busNumbers {}) and `ProjectDoc.studyResults` (null) are added.
- Transformer `design.kvRatio` text becomes numeric `design.hvKv` / `design.lvKv` (and `design.tvKv` on 3-winding units). Values of 1000 or more, or a trailing "V", are read as volts. Text that cannot be parsed is kept as a custom property "Voltage ratio (old)". Labels that showed the ratio now show `design.hvKv`.
- `Equipment.typical` / `Connection.typical` are optional and need no migration.

Test: `src/domain/__tests__/migration-v1.test.ts` with the fixture `fixtures/v1-project.json`. Pasting a bus drops its `design.busNum`, so numbers stay unique.

## D-013 RAW v33 choices for PSS/E and ANDES together (2026-11-17)

ANDES 2.0.0 (`andes/io/psse.py`) reads v33 RAW with its own parser. The writer stays inside valid v33 and picks the options both tools read the same way:
- **Two-winding transformers: CW = 2, CZ = 1, NOMV = 0.** ANDES computes the tap from both winding kV only for CW = 2; for CW = 1 it reads WINDV1 and ignores WINDV2. A non-zero NOMV makes ANDES rescale the impedance by (NOMV / bus kV)², so NOMV stays 0 and R, X are already referred to the bus base.
- **Three-winding transformers: CW = 1.** ANDES uses WINDV as a per-unit tap for each star branch whatever CW says, so per-unit ratios are the only form both read the same.
- **Phase shift.** ANG1 = +30° for Δ-Y and Y-Δ units (HV leads LV, ANSI), with VECGRP "Dyn1"/"YNd1". ANDES applies it: the sample's LV buses solve at about −28.9°.
- **No blank lines** after the three header lines (ANDES indexes `line[0]`). Section ends are written as `0 / END OF … DATA, BEGIN … DATA`. ANDES detects them by the leading `0 `.
- **Loads.** ANDES folds the ZIP parts into a constant-PQ load at the initial voltage. PSS/E keeps the split.
- **Owners and zones** are written; ANDES reads areas only.
- **Utility source.** A generator with MBASE = fault MVA and ZSORCE = 1 pu at the source X/R. It is the island swing unless another unit is flagged.

**Result.** `npm run study:check` exports the sample substation (7 buses, 2 transformers, 5 branches including a 2-mile overhead line, a utility, a genset and a PV inverter). ANDES 2.0.0 power flow converges in 4 Newton iterations (mismatch 9.4e-9).

## D-014 All Home Conductor themes (reverses D-003) (2026-11-17)

**At the user's request**, Conductor now ships every Home Conductor theme, not only Desert: Desert light and night, Glacier, Retro, Ember and Robot. The token values are copied verbatim from Home Conductor (`apps/web/public/styles.css`), along with their theme-specific component rules (Retro hover and selection, Robot hazard-stripe top bar).

- **Canvas tokens.** Each theme also defines Conductor's canvas tokens: canvas, grid, symbol stroke, wire, control wire, bus, selection, terminals, energized and boundary (trace and Operations), commissioning colors and minimap. The rules: linework uses the theme ink; selection uses the accent; energized uses the theme's "good"; the boundary uses "warn". Where the accent and warn are the same color (Robot), or the accent is the ink (Retro), the boundary uses "bad" and selection uses warn, so the two stay distinct. Conductor has no diff colors yet (revision diff is on the roadmap), so there are no diff tokens to derive.
- **`--accent-ink`** is new: the text color on accent fills (the active lens button). Badges on warn and bad fills use `var(--bg)` as text, so they stay readable on both light and dark themes.
- **Ids.** `light` and `dark` keep meaning Desert light and night, so saved choices from 0.1 still work. Auto (no `data-theme`) follows the OS between Desert light and night. The pre-paint script in `index.html` accepts every id, so there is no flash.
- **UI.** Settings has Home Conductor-style theme cards (`aria-pressed`). The top-bar button steps through all themes in picker order.
- **Checked** in headless Chrome against the production build: the SLD in every theme in the Design lens, with the energization trace on, renders with no console errors.

## D-015 SEQ (sequence data) export (2026-11-17)

`src/domain/study/seq.ts` writes the PSS/E 33 sequence file: a change-code record `0, 33`, then machine impedance data, empty negative- and zero-sequence shunt load sections, zero-sequence branch data, an empty mutual section, zero-sequence transformer data, and empty switched and fixed shunt sections, then `Q`.

- **Machines** (`I, ID, ZRPOS, ZXPOS, ZRNEG, ZXNEG, RZERO, XZERO`, pu on MBASE). Utility: Z1 = Z2 = the Thevenin source; Z0 from the SLG fault MVA and X0/R0 (Z0 = 3·S/S_slg − 2·Z1), or Z1 when there is no SLG data. Synchronous machines: Z1 = ZSORCE (R, X″d); Z2 = X2 (default X″d); Z0 = X0, plus 3·Rn of the neutral resistor. An ungrounded neutral, and inverter-based plants, are written as an open zero-sequence path (999 pu). A generator with high- or low-resistance grounding and no resistor value gets a typical resistor sized for 5 A or 400 A (IEEE 142).
- **Branches** (`I, J, ICKT, RLINZ, XLINZ, BCHZ, GI, BI, GJ, BJ`, system base) take R0/X0/B0 from cables (rule-of-thumb typicals 3·R1, 3·X1) and lines (Carson). The optional trailing fields of later revisions (IPR, SCTYP) are left off, so PSS/E uses its defaults.
- **Transformers** (`I, J, K, ICKT, CZ0, CZG, CC, RG1, XG1, R01, X01, RG2, XG2, R02, X02, RNUTRL, XNUTRL`, with CZ0 = CZG = 1). The whole Z0 is put on winding 1. RG is the neutral resistance in pu at that winding's bus base. Connection codes: Yg-Yg 1, Yg-Δ 2, Δ-Yg 3, anything else 4. Three-winding units get star-equivalent Z0 per winding and a best-effort code (all Yg 1, Yg-Yg-Δ 2, else 4).

**Uncertain.** The SEQ format changed in v33, and no copy of the v33 POM was available while this was written. The machine and branch layouts are the long-standing ones. The transformer layout with CZ0/CZG, whether RG is entered as Zn or 3Zn, and the three-winding CC table should be checked against the PSS/E 33 manual before anyone relies on short-circuit results. ANDES does not read SEQ files, so `study:check` only checks that the file is written. Golden tests (`src/state/__tests__/study-sample.test.ts`) pin the current output.

## D-016 DYR export and the ANDES time-domain check (2026-11-17)

`src/domain/study/dyr.ts` writes one record per device and chosen model: `IBUS 'MODEL' ID ICONs CONs /`, eight values per line, with no header comment (PSS/E reads every `/` as the end of a record). Values come from the object's `design.dyn.<MODEL>.<PARAM>` props, or else the library typicals. Machine IDs are unquoted when numeric. REPCA1's branch ID is quoted.

- **Utility:** GENCLS (H = 10 s on the fault-MVA base), a stiff grid.
- **Synchronous generators:** GENROU / GENSAL / GENCLS, plus exciter (SEXS / ESST1A / IEEET1) and governor (TGOV1 / GAST / IEEEG1). A GENCLS machine gets no exciter or governor.
- **PV, wind and stand-alone inverters:** REGCA1 + REECA1 (+ REPCA1 when the plant controller is on). BESS uses REECC1. Type 3 wind adds WTDTA1, WTARA1, WTPTA1 and WTTQA1.
- **Motors** with the CIM5 option: CIM5BL (bus and load ID). ANDES 2.0 skips it and keeps the static load.

**What ANDES needed** (each change stays valid PSS/E):
1. **Q limits in the power flow.** Without them the sample PV inverter absorbs 0.48 Mvar to hold 1.0 pu, beyond its −0.26 Mvar limit, so REECA1's Q limiter changes state right after initialization. `andes-check.py` now loads with `PV.pv2pq=1`, so a PV bus at a limit becomes PQ, as PSS/E does by default.
2. **Converter Q limits follow the machine.** REECA1/REECC1 QMax/QMin and REPCA1 Qmax/Qmin default to 0, which means "use the machine's Qmax/Qmin ÷ MBASE". The converter and the power flow then agree. A typical 0.436 pu would not.
3. **REECA1 VMIN = 0.** ANDES starts the Q-control PI integrator at 0 and clamps it to [VMIN, VMAX]. A VMIN of 0.9 makes the anti-windup tracking term non-zero at t = 0, and init fails (`PIQ_xi`, `PIV_xi` residuals). With VFLAG = 0 (the default here) that PI is not in the signal path, so VMIN = 0 changes nothing in PSS/E.
4. **ESST1A order.** The writer uses the PSS/E CON order. ANDES 2.0's `psse-dyr.yaml` maps ESST1A in a different order, so prefer SEXS or IEEET1 for ANDES runs. The sample uses SEXS.

**Result** (`npm run study:check`, ANDES 2.0.0): the power flow converges in 5 iterations with Q limits enforced (mismatch 8.4e-11). Time-domain initialization passes `test_init`, and the 2 s flat run completes (exit code 0) with bus voltages 0.9889 to 1.0035 pu, the same as the power flow. Models in the case: GENCLS, GENROU, SEXS, TGOV1, REGCA1, REECA1, REPCA1. ANDES notes that the GENCLS internal EMF (1.0) is at the low end of its typical range. That is expected for a stiff source at a 1.0 pu setpoint.

## D-017 Study results import: JSON from a small ANDES helper (2026-11-17)

**Decision.** `scripts/andes-check.py case.raw [case.dyr] --json case.pf.json` writes the power-flow solution as JSON: `format: conductor-andes-pf`, source, solve time, converged, iterations, bus `vm`/`va` (deg), and per-Line `pFrom/qFrom/pTo/qTo` (MW/Mvar). The flows are computed from the solved pi model of each ANDES Line, with tap and phase shift. The Study page imports that file (`src/domain/study/results.ts`) into `doc.studyResults`, stamped with the import time. Re-importing or clearing is one undo step.

- **Buses** match by their sticky PSS/E number. The voltage goes on the drawn Bus objects, or, for a study bus with no drawn bus, on its sources and loads.
- **Branches** match by ANDES Line order (RAW branches, then two-winding transformers), checked against both end bus numbers. Results that no longer match the one-line are skipped with a warning. Three-winding star branches are skipped; their flows are not shown yet.
- Results show read-only in the inspector ("Study results") and on the canvas through Toolbar › Study overlay › Study results (bus Vm∠Va, branch MW/Mvar at the from end).

**Why JSON from a helper.** ANDES can write CSV and xlsx too, but those hold per-model variable dumps that would need ANDES's own naming to decode in the app. A ten-line JSON written next to the run is stable, needs no parser dependency in the browser, and carries the convergence flag with the numbers.

**Alternatives.** Run ANDES in the browser (Pyodide): too heavy for now, on the roadmap as an idea. Parse PSS/E output files: no PSS/E license here.
