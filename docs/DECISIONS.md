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

## D-003 Themes: Desert light and dark only (2026-11-17)

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
