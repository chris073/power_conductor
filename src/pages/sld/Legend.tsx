import { CX_STATUS } from '../../domain/schemas';
import { useUi } from '../../state/uiStore';

const CX_CLS = ['cx-notstarted', 'cx-progress', 'cx-passed', 'cx-failed', 'cx-punch'];

export function Legend() {
  const phase = useUi((s) => s.phase);
  const trace = useUi((s) => s.trace);
  if (trace) {
    return (
      <div className="legend panel">
        <strong>Trace</strong>
        <span><i className="sw tr-live" /> Energized</span>
        <span><i className="sw tr-boundary" /> Open device (boundary)</span>
        <span><i className="sw tr-dim" /> Not reached</span>
      </div>
    );
  }
  if (phase === 'commissioning') {
    return (
      <div className="legend panel">
        <strong>Commissioning</strong>
        {CX_STATUS.map((s, i) => (
          <span key={s}><i className={`sw ${CX_CLS[i]}`} /> {s}</span>
        ))}
      </div>
    );
  }
  if (phase === 'operations') {
    return (
      <div className="legend panel">
        <strong>Operations</strong>
        <span><i className="sw op-live" /> Energized from sources</span>
        <span><i className="sw op-boundary" /> Open device</span>
        <span><i className="sw op-dead" /> De-energized</span>
        <span>⚑ O&amp;M flag</span>
      </div>
    );
  }
  if (phase !== 'concept') {
    return (
      <div className="legend panel">
        <strong>{phase[0]!.toUpperCase() + phase.slice(1)}</strong>
        <span><i className="badge-demo">2</i> Required fields missing in this phase</span>
      </div>
    );
  }
  return null;
}
