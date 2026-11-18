# Instructions for Claude: Conductor

Conductor is a fast, low-friction sketch tool for power systems projects. Every item on a one-line (SLD) is a real object with a stable ID, typed terminals, connections and properties grouped by lifecycle phase. The drawing is one view of that object model.

Stack: Vite + React + TypeScript (strict) + Zustand (zundo for undo/redo) + React Flow (`@xyflow/react`). Local-first: no server, no logins. Projects are versioned JSON documents stored in the browser.

## Run

```
npm install
npm run dev      # http://localhost:5180
npm test         # Vitest (domain + layout)
npm run build    # type-check + production build
npm run lint     # ESLint, including the architecture import boundaries
npm run study:check   # export the sample to PSS/E RAW/SEQ/DYR and run ANDES on it
```

`study:check` needs the Python venv once (gitignored):

```
py -3 -m venv .venv-study
.venv-study/Scripts/python -m pip install andes
```

It writes `study-out/sample.raw|.seq|.dyr`, runs ANDES power flow (and a 2 s flat time-domain run on the DYR) and exits non-zero if either fails. `npx tsx scripts/study-export.ts my.conductor.json` does the same for an exported project file; `--no-check` skips ANDES.

## Standing instructions

1. **Keep the docs current in the same piece of work.**
   - `CHANGELOG.md`: every user-visible change gets a line under the next version. Bump `version` in `package.json` (semver) when features land. The in-app Revisions page reads this file, so keep the `## [x.y.z] - YYYY-MM-DD` heading format.
   - `src/content/features.json`: the roadmap. Every feature, deferred item or idea is an entry with a status (`Idea`, `Planned`, `In progress` or `Done`). When the user floats something for later, add it as `Idea` or `Planned`.
   - `docs/DECISIONS.md`: record architectural decisions (what, why, alternatives) with the date.
2. **Respect the architecture boundaries.** ESLint enforces them.
   - `src/domain/` is plain TypeScript: equipment, terminals, connections, schemas, topology, serialization. No React, no diagram library, no state library.
   - `src/layout/` is plain TypeScript geometry: rotation, terminal positions, orthogonal routing, align. It may import `domain` only.
   - `src/canvas/` is the **only** place that imports `@xyflow/react`.
   - `src/state/` holds the Zustand stores, commands, session/autosave and the storage adapter.
3. **IDs are UUIDs; tags are labels.** Never key anything by tag.
4. **The project file format is a contract.** Before changing the shape of `ProjectDoc` or the file format:
   - tell the user first;
   - bump `SCHEMA_VERSION` in `src/domain/model.ts`;
   - add a migration in `src/domain/serialization/migrations.ts` and a test with an old-shape fixture;
   - note the change in `docs/DECISIONS.md`.
5. **Properties are schema-driven.** Add fields in `src/domain/schemas/index.ts`, not in components. Each field has a phase, a type, an optional unit, options, `requiredIn` phases and help text.
6. **Tests:** topology, serialization, routing and clipboard logic must keep passing Vitest tests. Run `npm run build` and `npm test` before every commit.
7. **Don't over-build.** Prefer the smallest change that fits the model. Put anything bigger on the roadmap first.

## Where things live

| Path | What |
|---|---|
| `src/domain/types.ts` | `ProjectDoc`, `Equipment`, `Connection`, `Layout`… |
| `src/domain/catalog.ts` | Equipment types: terminals (local coords), behavior, tag prefix, size |
| `src/domain/schemas/` | Property schemas by type and phase |
| `src/domain/topology.ts` | Electrical nodes (union-find), trace, components, upstream |
| `src/domain/serialization/` | Project file format + migrations |
| `src/domain/study/` | Study export: bus-branch reduction, base kV, per unit, readiness, RAW/SEQ/DYR writers, typical-value libraries (D-011) |
| `src/layout/` | Geometry and orthogonal routing |
| `src/symbols/Symbol.tsx` | ANSI symbol drawings (`currentColor`) |
| `src/canvas/` | React Flow canvas, nodes, edges, lens decorations |
| `src/state/` | Stores, commands, session/autosave, storage adapter, sample project |
| `src/pages/` | SLD workspace (palette, toolbar, inspector) and other pages |
| `src/styles/tokens.css` | Theme tokens (Desert light/dark, from Home Conductor) |
| `src/dev/` | Dev-only tools (500/700 diagram generator) |
| `scripts/study-export.ts`, `scripts/andes-check.py` | `npm run study:check` (export + ANDES power flow / TDS) |
| `scripts/perf-cdp.mjs` | Dev-only perf check (headless Chrome over CDP); re-run after canvas changes (D-010) |

## Working notes

- Every store action is one undo step. Drags and resizes preview locally and commit once when they end. Text fields commit on blur or Enter.
- Topology: closed switches, buses (all taps) and CTs join terminals into one electrical node. Transformers, reactors and inverters pass energy in a trace but keep separate nodes. Tie connectors with the same link name are joined across sheets. Control wiring (CT/VT secondaries to relays and meters) is not a power path.
- Symbols are drawn in the catalog's local coordinates. Keep sizes at multiples of 40 and terminals at multiples of 20 so rotated parts stay on the grid.
- Storage goes through `src/state/storage.ts` (`ProjectStorage`). Swap the adapter there; nothing else should touch `localStorage` for projects.
