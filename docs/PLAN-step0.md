# Conductor: Step 0 Plan

Status: **draft for approval**. No application code has been written yet.
Scope: the app shell (Step 1), the first SLD sketcher (Step 2), and Revisions. Everything runs in the browser and is stored locally. There is no server and no auth.

---

## 1. Home Conductor visual language (reference: `home_conductor/`)

### 1.1 Component approach

- **Plain CSS, no framework.** The whole UI is one global stylesheet, `apps/web/public/styles.css` (707 lines). It is written against vanilla ES modules (`apps/web/public/app.js`, `apps/web/public/js/*.js`) with hash routing. There is no Tailwind, no CSS modules and no component library.
- **Themes are token sets on `:root`, and components only use tokens.** This is stated in the header comment of `styles.css`. Themes switch through `html[data-theme="…"]`.
- **Icons** are inline SVGs on a 20×20 viewBox, stroked rather than filled: `stroke: currentColor; stroke-width: 1.6; stroke-linecap/linejoin: round` (nav icons in `apps/web/public/index.html`).
- **States** use attributes rather than classes: `aria-current="page"` (nav), `aria-pressed="true"` (segmented buttons, theme cards) and `[hidden]`.
- `color-mix(in srgb, …)` derives hover and soft variants from tokens.

### 1.2 Color tokens (`styles.css` lines 4–49, default "Desert" theme)

| Token | Light (`:root`) | Dark (`desert-dark` / auto-dark) | Use |
|---|---|---|---|
| `--bg` | `#f7eedc` | `#1c1b16` | page background |
| `--surface` | `#fffaf0` | `#24231b` | panels, inputs, buttons |
| `--surface-2` | `#efe5cf` | `#2d2c22` | hover, code, tracks |
| `--header` / `--header-bg` | `#424420` | `#2a2a15` | top bar |
| `--header-ink` / `--header-muted` | `#f7eedc` / `#c9c5a8` | `#e8dfc8` / `#a5ab7d` | top bar text |
| `--header-line` | `3px solid #c85815` | `3px solid #e69556` | top bar bottom rule |
| `--nav-bg` / `--nav-ink` | `#efe5cf` / `#5c5c54` | `#201f18` / `#babaaa` | side nav |
| `--nav-active` / `--nav-active-ink` | `#fffaf0` / `#2a2a15` | `#2d2c22` / `#e8e2cf` | current nav item |
| `--nav-mark` | `#c85815` | `#e69556` | 3px active marker |
| `--ink` / `--ink-2` / `--ink-3` | `#2a2a15` / `#5c5c54` / `#75756a` | `#e8e2cf` / `#babaaa` / `#8f8f82` | text levels |
| `--border` / `--border-strong` | `#d9cfb6` / `#c9b99f` | `#353420` / `#424420` | lines |
| `--primary` / `-hover` / `-ink` | `#525530` / `#424420` / `#fffaf0` | `#6d7042` / `#858a55` / `#fffaf0` | primary buttons |
| `--accent` | `#c85815` | `#e69556` | focus ring, highlights |
| `--good` / `-soft` / `-ink` | `#6d7042` / `#e6e3c9` / `#424420` | `#a5ab7d` / `#33341f` / `#c9cda5` | ok status |
| `--warn` / `-soft` / `-ink` | `#c85815` / `#f6dfc7` / `#8a3d0f` | `#e69556` / `#3a2a1a` / `#f0b87a` | warning |
| `--bad` / `-soft` / `-ink` | `#994444` / `#f2d9d9` / `#7a2e2e` | `#d88989` / `#3a2222` / `#e8a5a5` | error |
| `--idle` | `#8f8f82` | `#75756a` | inactive |
| `--cat-1..5` | `#2a78d6 #eb6834 #1baf7a #eda100 #e87ba4` | `#3987e5 #d95926 #199e70 #c98500 #d55181` | categorical |

Other themes live in the same file: Glacier, Retro, Ember and Robot (lines 51–118). They are listed in `apps/web/public/js/settings.js` (`THEMES`).

### 1.3 Typography

- **Sans:** `"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, sans-serif`. **Mono:** `"Cascadia Mono", "Cascadia Code", ui-monospace, SFMono-Regular, Consolas, monospace`. No web fonts are loaded.
- **Body:** `14px/1.45`, antialiased. Numbers use `.num`, which is mono with `tabular-nums`.

| Role | Size / weight / case |
|---|---|
| Wordmark `.brand h1` | 18px, 700, `letter-spacing: .18em`, uppercase text ("HOME CONDUCTOR") |
| Brand subtitle | 12px, `--header-muted` |
| Page title `.page-head h1` | 22px, 700 |
| Section title `.section-head h2` | 13px, 700, uppercase, `.14em`, `--ink-2`, followed by a 1px rule |
| Nav group label | 10.5px, 700, uppercase, `.14em`, `--ink-3` |
| Nav link | 14px, weight 550 |
| Buttons | 13px, 600 (small buttons 12px) |
| Field label | 12.5px, 600, `--ink-2`; help text 11.5px `--ink-3` |
| Table header | 11px, 600, uppercase, `.1em` |
| Stat value / label | 28px 600 / 11px 600 uppercase `.12em` |

### 1.4 Spacing, radii, shadows

- **Spacing:** there is no formal scale. The ad-hoc values used are 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 28 px. Typical uses: panel padding 16px, grid gaps 14px, main padding `20px 28px 56px`.
- **Radii:** `--radius: 12px` (panels) and `--radius-sm: 8px` (buttons, inputs, nav items). Pills use 999px, code uses 4px and toasts use 10px.
- **Shadow:** `--shadow: 0 1px 0 rgba(42,42,21,.06), 0 2px 8px rgba(42,42,21,.06)` in light mode and `0 1px 0 rgba(0,0,0,.3)` in dark mode. The drawer uses `-8px 0 24px rgba(0,0,0,.18)`.

### 1.5 Layout

- **Top bar** `.topbar`: sticky, `z-index: 15`, about 64px tall, padding `12px 24px`, `--header-bg`, with a 3px accent bottom rule. It holds a brand mark (34px SVG), the wordmark and subtitle, a flex spacer, and a right-aligned host/status block with a "pulse" dot (live = `--good` with a 3px soft ring).
- **Shell** `.shell`: `grid-template-columns: 210px minmax(0,1fr)`.
- **Side nav** `.nav`: sticky, full height, `--nav-bg`, right border, padding `14px 10px`. Items are grouped under uppercase group labels. Each item has an 18px icon, 8px/10px padding and `--radius-sm`. The active item has an `--nav-active` background, `--shadow`, and a 3px `--nav-mark` bar on the left edge.
- **Below 900px** the nav becomes an off-canvas drawer opened by a hamburger button.
- **Main** area has a max width of 1480px. A `.page-head` holds the title, description and actions.

### 1.6 Components

- **Panel** `.panel`: `--surface`, 1px `--border`, `--radius`, `--shadow`. `.pad` adds 16px padding.
- **Buttons** `.btn`: 1px `--border-strong`, `--surface`, `7px 14px`, 13px/600, inline-flex with a 6px gap and 14px icons. Variants: `.primary` (filled `--primary`), `.danger` (red outline, `--bad-soft` on hover), `.ghost` (transparent), `.small`, `.icon`.
- **Segmented control** `.seg`: bordered group; the pressed button is filled `--primary`. **Chips and tags** are 999px pills.
- **Inputs** `.input` / `.search`: 1px `--border-strong`, `--surface`, `7px 10px`, 13px. Focus shows `outline: 2px solid var(--accent); outline-offset: 1px`, and `.input.changed` gets an accent border. Fields use `.field` (a grid with a label, the control and help text).
- **Status pills** `.status`: 12px/600 on soft backgrounds (`--good-soft`, `--warn-soft`, `--bad-soft`).
- **Toast** `.toast`: fixed at bottom center, inverted colors (`--ink` background, `--bg` text), `10px 16px`, radius 10px, z-index 40. `.toast.err` uses `--bad`. There is a single element, `#toast`, with `role="status"`.
- **Drawer:** right side, 760px, slides in with `transform`.
- **Tables:** 13px, row hover, uppercase headers.

### 1.7 Light/dark mechanism

1. An inline script in `index.html` `<head>` reads `localStorage['conductor-theme']` **before first paint** and sets `document.documentElement.dataset.theme` unless the value is `auto`. This avoids a flash of the wrong theme.
2. `auto` means no `data-theme` attribute: `@media (prefers-color-scheme: dark) { :root:not([data-theme]) {…dark tokens…} }`.
3. An explicit theme sets `:root[data-theme="desert-dark"]` and the other named themes. Every theme sets `color-scheme`.
4. `applyTheme(id)` / `currentTheme()` in `js/settings.js` persist the choice and dispatch a `conductor-theme` event.

### 1.8 How Conductor ports it

- **Name:** the wordmark becomes **CONDUCTOR** (uppercase, letter-spaced). "Home" is dropped everywhere. The mark stays a 34px SVG in the same ring style, with a breaker or one-line glyph in place of the compass.
- **Theme:** `src/styles/tokens.css` copies the Desert light and dark token sets verbatim, with the same names and values. The theme toggle cycles **Auto / Light / Dark** using the same pre-paint inline script, under a new key (`pc-theme`) and the values `light|dark`. Other themes (Glacier, Ember…) can be added later as further token blocks (see open questions).
- **Canvas tokens** (new, derived from the palette):

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--canvas-bg` | `#fffaf0` | `#1c1b16` | sheet background |
| `--grid-minor` / `--grid-major` | `#efe5cf` / `#d9cfb6` | `#2d2c22` / `#353420` | grid dots and lines |
| `--sym-stroke` | `#2a2a15` | `#e8e2cf` | symbol linework (`currentColor`) |
| `--wire` | `#2a2a15` | `#e8e2cf` | connections |
| `--bus` | `#2a2a15` | `#e8e2cf` | bus bars (thicker stroke) |
| `--select` | `#c85815` | `#e69556` | selection and handles (= accent) |
| `--energized` / `--boundary` | `#1baf7a` / `#c85815` | `#199e70` / `#e69556` | trace overlay |
| `--diff-add` / `--diff-del` / `--diff-chg` | `--good` / `--bad` / `--cat-4` | same | revision compare |
| `--cx-notstarted…punch` | `--idle`, `--cat-1`, `--good`, `--bad`, `--cat-4` | | commissioning lens |

- **Components:** React with **plain CSS**. `tokens.css` and `base.css` are global, and component styles are CSS Modules (`*.module.css`) that reference tokens only. The `.btn`, `.seg`, `.input`, `.field`, `.panel`, `.status`, `.toast` and `.nav` rules port nearly one-to-one into small React primitives (`Button`, `Seg`, `Field`, `Panel`, `StatusPill`, `Toast`). No Tailwind and no UI kit.
- **Layout:** the top bar (about 56px) and the 210px nav are kept. Two additions: a 26px **status bar** at the bottom (mono, 12px, `--surface-2`), and on the SLD page a right **inspector** (320px, resizable) plus a left **palette** (240px) inside `main`. On the SLD page `main` drops its padding and max width so the canvas runs full bleed.

---

## 2. Diagramming library

### 2.1 Comparison

| Need | React Flow (`@xyflow/react` 12) | JointJS core (MPL-2.0) / JointJS+ | Konva / react-konva | tldraw SDK |
|---|---|---|---|---|
| 500 nodes / 700 edges, fluid | Good with discipline: memoized nodes, `onlyRenderVisibleElements`, a narrow store selector. DOM nodes with SVG edges. | Good (SVG); JointJS+ adds virtual rendering | Excellent (canvas) | Good (DOM shapes plus culling) |
| Custom SVG symbols with named ports | **Native:** any React component as a node; `<Handle id="H1">` per terminal | Native ports and port groups | Hand-built: hit testing, port model | Custom shapes, but bindings are generic, not ports |
| Orthogonal routing with draggable segments | Step edges built in (`getSmoothStepPath`, radius 0); segment drag is **custom** (about 300 LOC) | **Best:** `orthogonal` / `manhattan` routers and `linkTools.Segments` are in core | All custom | Arrows only (straight or curved); elbow arrows are limited |
| Stretchable bus with taps anywhere | Custom node with dynamic handles (see §2.3) | Ports can be added dynamically, or links to a "connection point anywhere" | All custom | Awkward |
| Select, multi, marquee, copy/paste, undo | Selection, marquee and snap built in; copy/paste and undo are ours (zundo) | Core: selection is DIY; JointJS+ has Selection, Clipboard, CommandManager (undo) | All custom | All built in (its own store) |
| React + TS fit | Native React, typed | Imperative (Backbone MVC); React wrapper only in JointJS+ | React bindings, imperative scene | React, but it owns the document model |
| Keeps the domain model ours | Yes: nodes and edges are a projection of our store | Graph model competes with ours | Yes | No: the tldraw store *is* the model |
| License | **MIT.** Optional Pro subscription for Pro examples and removing the attribution badge (about $169–289/mo per sources). Not required. | Core MPL-2.0 (fine for commercial use; modified library files stay open). JointJS+ about **$2,990 per developer**, perpetual, updates about $1,490/yr | MIT | **Production needs a license key.** Commercial licenses are annual and sales-priced (third-party sources say from about $6k/yr); the free hobby tier is non-commercial with a watermark; internal company tools count as commercial |

Sources: tldraw license ([tldraw.dev/legal/tldraw-license](https://tldraw.dev/legal/tldraw-license), [license key](https://tldraw.dev/sdk-features/license-key)); JointJS ([jointjs.com/license](https://www.jointjs.com/license), [jointjs.com/pricing](https://www.jointjs.com/pricing)); React Flow ([npm @xyflow/react](https://www.npmjs.com/package/@xyflow/react), [reactflow.dev/attribution](https://reactflow.dev/attribution)).

### 2.2 Recommendation: React Flow (`@xyflow/react`), MIT

**Why:**
- It is React-native.
- Its node, port and edge model maps directly onto equipment, terminals and connections.
- The canvas stays a pure projection of our Zustand domain store.
- It is MIT with no runtime license key.
- Pan, zoom-to-cursor, fit view, minimap, snap-to-grid, marquee and multi-select come built in.

**Why not the others:**
- **JointJS core** has the best orthogonal routing, but its Backbone graph would duplicate our model, and the polish (undo, clipboard, selection) sits behind JointJS+ per-developer licensing.
- **Konva** means building everything ourselves.
- **tldraw** owns the data model and needs a paid key for commercial production use.

**Known costs we accept:**
- Segment-drag routing and the bus attachment logic are our code.
- React Flow has no node rotation, so we compute rotated terminal positions ourselves.
- The free tier shows a small "React Flow" attribution badge. MIT allows hiding it (`proOptions.hideAttribution`), and xyflow asks commercial users to subscribe. We decide later.

### 2.3 How the hard parts are implemented

**A. Orthogonal routing with draggable segment handles (`src/layout/routing/`, plain TS, unit-tested)**
- The route is stored in the layout model: `ConnectionLayout { mode: 'auto' | 'manual', points: Pt[] }`. The points are the interior bend points; the endpoints always come from terminal positions.
- **Auto mode:** the router computes a Manhattan polyline. It leaves each terminal along the terminal's outward direction with a stub of one grid unit, then picks L, Z or U shapes, preferring the fewest bends. It snaps to the grid. Version 1 has no obstacle avoidance; a later version can add a grid A* router over node bounding boxes.
- **Rendering:** `OrthoEdge` (a custom edge) renders `M…L…` with square corners. On select it shows one **segment handle** at each segment midpoint (a small pill, `--select`).
- **Dragging a segment:**
  - A horizontal segment moves only in y, a vertical one only in x, snapped to the grid.
  - The two adjacent bend points move together, so the route stays orthogonal.
  - Dragging the first or last segment inserts a new bend next to the terminal, so the stub stays attached.
  - The route switches to `manual`.
  - Collinear points are merged afterwards.
- **Moving a node** with a manual route: only the end segment(s) touching that terminal are adjusted, by sliding the adjacent bend; interior geometry is kept. If the route degenerates, it falls back to auto.
- Settings → "default routing" chooses orthogonal or straight for new connections.

**B. Bus bars with arbitrary attach points**
- **Domain:** a `Bus` is equipment with **dynamic terminals** (`taps`). Every tap is a normal `Terminal` with a UUID id. Topologically, the whole bus is **one electrical node**: all taps are joined, with zero impedance.
- **Layout:** `BusLayout { orientation: 'h' | 'v', length, taps: Record<tapId, offset> }`.
- **Canvas:** `BusNode` is a thick line with one `<Handle id={tapId}>` positioned at each offset. It has custom resize grips on both ends, constrained to its axis and snapped to the grid, plus a full-length invisible hit band.
- **Attaching:** when a connection drag ends over the hit band (`onConnectEnd` plus a hit test with `screenToFlowPosition`), we create a new tap at the snapped offset and connect to it. The commit calls `updateNodeInternals(busId)`. Dragging an existing tap slides it along the bus. Deleting the last connection on a tap removes the tap.
- **Resizing:** shrinking a bus clamps taps to the new length.

**C. Symbols, rotation and flip:** each type declares its terminals in the domain catalog in unrotated local coordinates (`{ id: 'H1', x, y, dir: 'up' }`). `EquipmentNode` applies `rotate(90·k)` and flip to the SVG, transforms each terminal point, and places `<Handle>` at the transformed position with the rotated `Position`.

**D. Performance:**
- `React.memo` on nodes and edges, with stable node and edge objects derived per ID.
- Selectors read by ID rather than the whole document.
- `onlyRenderVisibleElements`.
- Edge paths are memoized on the endpoints and route.
- Drags update layout in a transient slice, and the undoable store is committed once on drag stop.
- Milestone 4 has a perf gate (see §5).

---

## 3. Folder structure

```
power_conductor/
  CLAUDE.md                  # standing instructions (rendered in-app)
  CHANGELOG.md
  README.md
  docs/  PLAN-step0.md  DECISIONS.md
  index.html                 # pre-paint theme script
  package.json  vite.config.ts  tsconfig.json (strict)  eslint.config.js  vitest.config.ts  playwright.config.ts
  src/
    main.tsx  App.tsx  routes.tsx
    domain/                  # plain TS: NO react, NO @xyflow
      ids.ts                 # uuid(), branded Id types
      types.ts               # Project, Sheet, Equipment, Terminal, Connection, Annotation
      catalog.ts             # equipment type defs: terminals, category, switching?, default props
      schemas/               # property schemas per type + shared field defs
        fields.ts  common.ts  phases.ts
        source.ts transformer.ts switching.ts bus.ts protection.ts loads.ts cable.ts ...
      topology.ts            # union-find nodes, components, trace, upstream/downstream
      validation.ts          # missing-required-in-phase
      tags.ts                # default tag generation, uniqueness warnings
      clipboard.ts           # subgraph copy + ID remap
      revisions.ts           # issue, numbering scheme
      diff.ts                # snapshot diff (object + property level)
      serialization/  projectFile.ts  migrations.ts
      __tests__/
    layout/                  # plain TS geometry: positions, rotation, routes
      types.ts  geometry.ts  align.ts
      routing/  orthogonal.ts  segments.ts  __tests__/
    state/                   # Zustand
      projectStore.ts        # ProjectDoc (domain + layout), zundo temporal
      uiStore.ts             # selection, tool, lens phase, viewport, trace result
      settingsStore.ts
      autosave.ts
    db/  dexie.ts  repo.ts   # IndexedDB tables + load/save
    canvas/                  # the ONLY place importing @xyflow/react
      SldCanvas.tsx  adapters.ts  useCanvasHandlers.ts  lenses.ts
      nodes/  EquipmentNode.tsx BusNode.tsx ContainerNode.tsx NoteNode.tsx CloudNode.tsx
      edges/  OrthoEdge.tsx  SegmentHandle.tsx
    symbols/                 # themeable SVG (currentColor), ANSI + IEC variants
      registry.ts  ansi/*.tsx  iec/*.tsx
    pages/
      projects/  sld/ (Palette, Inspector, Toolbar, Legend, TraceButton)
      revisions/  features/  claude/  settings/
    shell/  TopBar.tsx SideNav.tsx StatusBar.tsx Toast.tsx ShortcutOverlay.tsx
    ui/     Button Seg Field Panel StatusPill Tabs Modal (thin primitives)
    styles/ tokens.css base.css
    content/features.json
    dev/    generateLargeDiagram.ts   # dev-only (import.meta.env.DEV)
  tests/e2e/                 # Playwright smoke flows
```

**Dependency rule**, enforced with an ESLint `no-restricted-imports` per folder:
- `domain` imports nothing from the app.
- `layout` may import `domain`.
- `canvas` may import `domain`, `layout`, `state` and `symbols`.
- Only `canvas` imports `@xyflow/react`.

**Libraries:**
- `react`, `react-dom`, `react-router-dom` (hash router)
- `@xyflow/react`
- `zustand`, `zundo`, `immer`
- `dexie`
- `react-markdown` and `remark-gfm` (Claude Instructions page)
- `vitest`, `@testing-library/react`, `playwright`

---

## 4. Data model (sketch)

```ts
// ---------- ids & phases
type Id = string & { __brand: 'Id' };           // crypto.randomUUID()
type Phase = 'concept'|'design'|'procurement'|'construction'|'commissioning'|'operations';

// ---------- project
interface ProjectDoc {
  schemaVersion: number;                        // e.g. 1
  id: Id; name: string; createdAt: string; updatedAt: string;
  settings: ProjectSettings;                     // revision scheme, symbol std override
  sheets: Sheet[];                               // >= 1
  equipment: Record<Id, Equipment>;              // project-wide graph
  connections: Record<Id, Connection>;
  annotations: Record<Id, Annotation>;           // notes, revision clouds (non-electrical)
  layout: Layout;                                // separate, keyed by object id
  revisions: RevisionMeta[];                     // snapshots stored separately (see below)
}
interface Sheet { id: Id; name: string; number: string; order: number; }

// ---------- equipment & terminals
interface Equipment {
  id: Id;
  type: EquipmentType;                           // 'breaker' | 'transformer2w' | 'bus' | ...
  sheetId: Id;
  tag: string;                                   // user-facing, editable, NEVER a key
  parentId?: Id;                                 // inside a switchgear lineup / MCC container
  state?: 'open'|'closed';                       // only for switching types
  props: Record<string, PropValue>;              // keyed by schema field key
  custom: CustomProp[];                          // per-instance extras
  labelFields?: [string?, string?];              // up to 2 ratings shown on canvas
  taps?: Terminal[];                             // bus only: dynamic terminals
  link?: { pairId: Id };                         // off-sheet/tie connector pairing
}
interface Terminal { id: string; label: string; role?: 'line'|'load'|'H'|'X'|'Y'|'gnd'; }
// Static terminals come from the catalog (e.g. transformer2w: H1, X1; breaker: 1, 2);
// terminal ids are stable strings per type, or UUIDs for bus taps.
interface TerminalRef { equipmentId: Id; terminalId: string; }

interface CustomProp { id: Id; key: string; value: string; unit?: string; }
type PropValue = string | number | boolean | null;

// ---------- connections (cables are real objects)
interface Connection {
  id: Id; sheetId: Id;
  kind: 'cable'|'busway'|'jumper';
  tag: string;
  from: TerminalRef; to: TerminalRef;
  props: Record<string, PropValue>;              // cable schema: size, material, length, insulation...
  custom: CustomProp[];
}

// ---------- layout (geometry only)
interface Layout {
  nodes: Record<Id, { x: number; y: number; rot: 0|90|180|270; flipX?: boolean;
                      w?: number; h?: number }>;                 // w/h for containers
  buses: Record<Id, { orientation: 'h'|'v'; length: number; taps: Record<string, number> }>;
  routes: Record<Id, { mode: 'auto'|'manual'; points: {x:number;y:number}[] }>;
  annotations: Record<Id, { x:number; y:number; w?:number; h?:number }>;
}

// ---------- schemas (src/domain/schemas)
interface FieldDef {
  key: string; label: string; phase: Phase;      // grouping tab
  type: 'text'|'number'|'enum'|'bool'|'date'|'rating'; // rating = number + unit family
  unit?: string; unitFamily?: 'voltage'|'current'|'power'|'impedance'|'length';
  options?: string[];                            // allowed values (enum)
  min?: number; max?: number;
  requiredIn?: Phase[];                          // drives "missing required" badge
  help?: string;
  label2?: boolean;                              // eligible as canvas label rating
}
interface TypeSchema { type: EquipmentType; fields: FieldDef[]; }
// Shared groups (identity, commissioning status/tests, O&M notes) are composed into each type.
// Commissioning lens reads props['cx.status'] ∈ NotStarted|InProgress|Passed|Failed|Punch.
// Operations lens reads props['ops.energized'], props['ops.flags'].

// ---------- revisions
interface RevisionScheme { preIssue: 'letters'; postIssue: 'numbers'; startNumeric: 0; }
interface RevisionMeta {
  id: Id; label: string;                         // 'A','B',… then '0','1',…
  date: string; author: string; description: string;
  status: 'IFR'|'IFC'|'As-Built';
  snapshotId: Id;                                // immutable frozen ProjectDoc (sans revisions)
}
// Label rule: letters until the first IFC, then 0,1,2… (configurable in project settings).

// ---------- diff
interface RevisionDiff {
  added: Id[]; removed: Id[]; moved: Id[];       // moved = layout-only change
  changed: { id: Id; changes: PropChange[] }[];  // tag/state/props/custom/connection ends
}
interface PropChange { path: string; before: unknown; after: unknown; }
```

### 4.1 Topology (`src/domain/topology.ts`)

- **Electrical nodes:** a union-find over `TerminalRef`s.
  - Each connection unions its two terminals.
  - **Closed** switching devices union their own terminals; **open** ones do not.
  - A **bus** unions all its taps, making it one node.
  - Tie and off-sheet connector pairs union across sheets.
  - Fuses are closed unless their state says otherwise.
- **Device-level graph:** equipment are vertices and electrical nodes are hyperedges. Transformers pass energy between windings, so a trace crosses them while voltage-zone queries do not.
- **API:** `electricalNodes(doc)`, `connectedComponents(doc)`, `trace(doc, sourceId) → { energized: Set<Id>, boundary: Set<Id> }` (a BFS that stops at open devices and reports them as the boundary), `upstream(doc, id)` / `downstream(doc, id)` (relative to sources: utility, generator, PV, BESS, wind), and `neighbors(doc, id)` for the inspector's clickable connections.
- All of it is pure functions over `ProjectDoc`, unit-tested, with no layout needed.

### 4.2 Persistence and serialization

- **Dexie database `conductor`:**
  - `projects` (id, name, updatedAt, `doc: ProjectDoc`)
  - `snapshots` (id, projectId, `doc`), immutable
  - `settings` (key, value)
- **Autosave:** debounced store subscription at the configurable interval, with a top-bar indicator (Saved / Saving / Unsaved).
- **Export file:** `{ format: 'conductor-project', schemaVersion, project: ProjectDoc, snapshots: Snapshot[] }`. This is the exact format import reads.
- **Migrations:** `migrations: Record<number, (doc) => doc>` runs in order on load and on import. Unknown future versions are refused with a toast.
- **Duplicate project:** gives the project a new id and keeps the object ids. They are scoped per project, so tags and history stay readable.

### 4.3 Undo/redo (zundo)

- `temporal` wraps `projectStore` and is partialized to `{ equipment, connections, annotations, layout, sheets }`. UI state is excluded.
- Drags call `temporal.pause()` on drag start and `resume()` with a single commit on drag stop. Multi-field edits are grouped with a small `transaction(fn)` helper.
- History limit is 200. History clears on project switch.

---

## 5. Build sequence (Steps 1 and 2 plus Revisions)

Each milestone ends with: green `tsc --noEmit`, lint, Vitest, a CHANGELOG entry, a features.json status update, a DECISIONS.md entry when a choice was made, and a commit.

| # | Milestone | Contents | Verified by |
|---|---|---|---|
| M0 | Scaffold | Vite + React + TS strict, ESLint import boundaries, Vitest, Playwright, CLAUDE.md, DECISIONS.md, CHANGELOG.md, features.json (seeded from the brief incl. "Later") | `npm run build`, `npm test`, `npm run e2e` all pass on an empty app |
| M1 | Shell | tokens.css (Desert light/dark), TopBar (wordmark, editable project name, phase switcher, save indicator, theme toggle), SideNav, StatusBar, Toast, hash routes | Visual check in both themes; e2e: theme persists across reload with no flash; nav routes render |
| M2 | Domain + persistence | types, catalog, schemas, ids, Dexie repo, autosave, Projects page (CRUD + duplicate + sheets), export/import, migrations scaffold | Unit: serialization round-trip is byte-equal, migration v0→v1, duplicate keeps objects. e2e: create, rename, reload, still there; export → import is identical |
| M3 | Static pages | Features (renders features.json with status pills), Claude Instructions (CLAUDE.md via `?raw` + react-markdown), Settings (all listed options, reset local data with confirm) | e2e: each page renders; settings persist; reset empties IndexedDB |
| M4 | Canvas core + **perf gate** | SldCanvas, grid, snap, pan (space-drag, middle mouse), zoom-to-cursor, fit, minimap, placeholder nodes, dev large-diagram generator (500/700) | Perf: generator at 500 nodes / 700 edges, Chrome Performance panel, pan/zoom/drag of 20 selected nodes at about 60 fps (no frames over 50 ms). **If this fails we stop and revisit §2 before going on.** |
| M5 | Symbols + palette | ANSI set (all listed symbols, Δ/Y/Yg, open/closed variants), IEC variants for the core ones, searchable categorized palette, drag-to-place, labels (tag + 2 ratings) | Visual sheet page in dev (`/dev/symbols`) in light and dark; unit: every catalog type has a symbol and its terminals map to handles |
| M6 | Editing | select, shift-click, marquee, move, rotate 90°, flip, delete, duplicate, copy/paste (ID remap, tag increment), align/distribute, undo/redo, `?` overlay | Unit: clipboard remap, align math. e2e: place → rotate → undo → redo; copy/paste yields new IDs and the same topology |
| M7 | Connections + routing | terminal-to-terminal connect, OrthoEdge auto routing, segment handles, manual routes surviving node moves, cables as selectable objects | Unit: router stays orthogonal for all terminal-direction pairs; segment drag preserves orthogonality; endpoint follow. Manual: route 20 connections, drag segments, move nodes |
| M8 | Bus bars + containers | BusNode resize, taps anywhere, tap slide, switchgear/MCC/panelboard containers | Unit: bus is one electrical node; taps clamp on shrink. e2e: 6 feeders onto one bus, resize, all stay attached |
| M9 | Inspector | phase tabs from schema, ID/type/tag, enum/unit inputs, required badges, clickable connections, custom props, per-object revision history | Unit: validation finds missing required fields per phase. e2e: edit a field, undo, reload, value persists |
| M10 | Lenses + trace | Concept/Design/Commissioning/Operations lens rendering, legend, open/closed toggle, Trace | Unit: trace stops at an open breaker and reports the boundary; crosses a transformer; tie connectors join sheets. Manual: toggle a breaker and re-trace |
| M11 | Revisions | issue (scheme A,B… → 0,1…), list, read-only open, compare (working vs revision, revision vs revision), color overlay, property change list, optional auto clouds | Unit: diff classifies added/removed/moved/changed plus property paths; labels follow the scheme across IFR→IFC; snapshots are immutable (frozen, deep-equal after edits). e2e: issue A, edit, compare shows the expected colors |
| M12 | Hardening | final perf re-run at 500/700 with real symbols, a11y pass (focus rings, keyboard), docs refresh | Perf gate re-measured and recorded in DECISIONS.md; the full definition-of-done checklist is walked and ticked in CHANGELOG |

**Definition-of-done mapping:**
- Every brief bullet becomes a features.json item with a status.
- Each one is marked Done only when its row's verification passes.
- Domain logic (topology, routing, diff, revisions, migrations) is covered by Vitest.
- Interaction flows are covered by a handful of Playwright smoke tests.
- Look and feel is checked manually in both themes.

---

## 6. Open questions and risks

**Questions:**
1. **Themes:** port only Desert light/dark, or also Glacier, Ember, Retro and Robot? The plan is Desert only, with others possible later.
2. **Symbol fidelity:** is ANSI/IEEE 315-style linework fine for v1, with IEC 60617 variants only for the core devices (breaker, disconnect, transformer, fuse, source)?
3. **Revision scheme:** letters until the first IFC, then numbers. Should As-Built continue the numbers, or does it get its own suffix (e.g. "2-AB")?
4. **React Flow attribution badge:** keep it for now (free) or hide it? Hiding is allowed by MIT, but xyflow asks commercial users to subscribe.
5. **Tests:** is Playwright acceptable as a dev dependency? It needs a browser download of about 150 MB.
6. **Author on revisions:** a free-text name stored in Settings (no auth)?

**Risks:**
- **Orthogonal routing quality.** Version 1 does not avoid obstacles, so routes can cross symbols until the user drags segments. The mitigation is a grid A* router as a later feature.
- **Performance with rich SVG symbols at 500 nodes.** Mitigated by the M4 gate (stop and reassess), memoization, and simplified symbols at low zoom.
- **Scope creep in the schemas.** Ship a small, sensible field set per type and let custom properties cover the rest.
- **IndexedDB is per-browser and can be evicted.** Mitigated by a visible export/import, plus a `navigator.storage.persist()` request on first save.
