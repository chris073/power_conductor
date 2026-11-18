import { useStore } from 'zustand';
import { useCanvasApi } from '../../canvas/SldCanvas';
import { generateLargeDiagram } from '../../dev/generateLargeDiagram';
import * as cmd from '../../state/commands';
import { redo, undo, useProject } from '../../state/projectStore';
import { openGenerated } from '../../state/session';
import { useUi } from '../../state/uiStore';
import { Icon, type IconName } from '../../shell/icons';

function Tb({ icon, title, onClick, disabled, active }: { icon: IconName; title: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button className={`tb ${active ? 'active' : ''}`} title={title} aria-label={title} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={17} />
    </button>
  );
}

export function Toolbar() {
  const api = useCanvasApi();
  const sel = useUi((s) => s.selection);
  const trace = useUi((s) => s.trace);
  const canUndo = useStore(useProject.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useProject.temporal, (s) => s.futureStates.length > 0);
  const n = sel.length;
  const nodes = cmd.selectedNodes().length;

  return (
    <div className="toolbar" role="toolbar" aria-label="Sheet tools">
      <Tb icon="undo" title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo} />
      <Tb icon="redo" title="Redo (Ctrl+Y)" onClick={redo} disabled={!canRedo} />
      <span className="tb-sep" />
      <Tb icon="rotate" title="Rotate 90° (R)" onClick={cmd.rotateSelection} disabled={!nodes} />
      <Tb icon="flip" title="Mirror (M)" onClick={cmd.flipSelection} disabled={!nodes} />
      <Tb icon="copy" title="Duplicate (Ctrl+D)" onClick={cmd.duplicateSelection} disabled={!n} />
      <Tb icon="trash" title="Delete (Del)" onClick={cmd.deleteSelection} disabled={!n} />
      <Tb icon="power" title="Toggle open/closed (O)" onClick={() => { if (!cmd.toggleSelection()) useUi.getState().toast('Select a switching device to open or close it.'); }} disabled={!n} />
      <span className="tb-sep" />
      {nodes >= 2 && (
        <>
          <Tb icon="alignL" title="Align left" onClick={() => cmd.alignSelection('left')} />
          <Tb icon="alignC" title="Align centers (vertical line, on first selected)" onClick={() => cmd.alignSelection('hcenter')} />
          <Tb icon="alignT" title="Align top" onClick={() => cmd.alignSelection('top')} />
          <Tb icon="alignM" title="Align middles (horizontal line, on first selected)" onClick={() => cmd.alignSelection('vcenter')} />
          <Tb icon="distH" title="Distribute horizontally" onClick={() => cmd.distributeSelection('h')} disabled={nodes < 3} />
          <Tb icon="distV" title="Distribute vertically" onClick={() => cmd.distributeSelection('v')} disabled={nodes < 3} />
          <span className="tb-sep" />
        </>
      )}
      <button
        className={`btn small ${trace ? 'primary' : ''}`}
        title="Trace energization downstream from the selected source (T)"
        onClick={() => {
          const msg = cmd.traceSelection();
          if (msg) useUi.getState().toast(msg);
        }}
      >
        <Icon name="trace" size={14} /> Trace
      </button>
      {trace && (
        <button className="btn small ghost" onClick={cmd.clearTrace} title="Clear trace (Esc)">
          <Icon name="x" size={14} /> Clear
        </button>
      )}
      <span className="spacer" />
      {import.meta.env.DEV && (
        <button
          className="btn small ghost"
          title="Dev only: open a generated 500-object / 700-connection project for performance checks"
          onClick={() => {
            openGenerated(generateLargeDiagram(500, 700));
            setTimeout(api.fit, 60);
          }}
        >
          <Icon name="bolt" size={14} /> 500/700
        </button>
      )}
      <Tb icon="minus" title="Zoom out" onClick={api.zoomOut} />
      <Tb icon="plus" title="Zoom in" onClick={api.zoomIn} />
      <Tb icon="fit" title="Zoom to fit (F)" onClick={api.fit} />
    </div>
  );
}
