import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { memo, useEffect } from 'react';
import type { Dir } from '../../domain/catalog';
import { localSize, placedSize, placedTerminals, svgTransform } from '../../layout/geometry';
import { useProject } from '../../state/projectStore';
import { SymbolSvg } from '../../symbols/Symbol';
import type { EquipmentNode as EquipmentNodeType } from '../adapters';

export const POS: Record<Dir, Position> = { up: Position.Top, down: Position.Bottom, left: Position.Left, right: Position.Right };

function EquipmentNodeImpl({ id, data, selected }: NodeProps<EquipmentNodeType>) {
  const { eq, layout, deco } = data;
  const updateInternals = useUpdateNodeInternals();
  const { w: lw, h: lh } = localSize(eq, layout);
  const { w, h } = placedSize(eq, layout);
  const terminals = placedTerminals(eq, layout);

  useEffect(() => {
    updateInternals(id);
  }, [id, layout.rot, layout.flip, updateInternals]);

  const onDoubleClick = () => {
    if (eq.state) useProject.getState().toggleState(id);
  };

  return (
    <div className={`eq ${deco.cls} ${selected ? 'is-selected' : ''} ${eq.state === 'open' ? 'is-open' : ''}`} style={{ width: w, height: h }} onDoubleClick={onDoubleClick}>
      <svg className="eq-svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect className="eq-hit" x={0} y={0} width={w} height={h} />
        <SymbolSvg eq={eq} w={lw} h={lh} transform={svgTransform(lw, lh, layout.rot, layout.flip)} />
      </svg>
      {terminals.map((t) => (
        <Handle
          key={t.id}
          id={t.id}
          type="source"
          position={POS[t.dir]}
          className={`term term-${t.kind}`}
          style={{ left: t.x, top: t.y, right: 'auto', bottom: 'auto' }}
          title={t.id}
        />
      ))}
      <div className="eq-label" style={{ left: w + 6 }}>
        <span className="eq-tag">{eq.tag}</span>
        {deco.lines.map((l, i) => (
          <span key={i} className="eq-line">{l}</span>
        ))}
      </div>
      {deco.badge > 0 && <span className="eq-badge" title={`${deco.badge} required field(s) missing in this phase`}>{deco.badge}</span>}
      {deco.flag && <span className="eq-flag" title="O&M attention flag">⚑</span>}
    </div>
  );
}

export const EquipmentNode = memo(EquipmentNodeImpl);
