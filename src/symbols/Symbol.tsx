// ANSI-style one-line symbols, drawn in each type's local (unrotated) coordinates from the catalog.
// Linework uses currentColor so lenses and themes can recolor. IEC variants are on the roadmap;
// the IEC setting currently falls back to these.

import { memo, type ReactElement } from 'react';
import type { Equipment } from '../domain/types';

const SW = 2;

function Lead({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return <line x1={x} y1={y1} x2={x} y2={y2} />;
}

function Ground({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y + 6} />
      <line x1={x - 10} y1={y + 6} x2={x + 10} y2={y + 6} />
      <line x1={x - 6} y1={y + 10} x2={x + 6} y2={y + 10} />
      <line x1={x - 2} y1={y + 14} x2={x + 2} y2={y + 14} />
    </g>
  );
}

function Txt({ x, y, children, size = 14, weight = 600 }: { x: number; y: number; children: string; size?: number; weight?: number }) {
  return (
    <text x={x} y={y} fontSize={size} fontWeight={weight} textAnchor="middle" dominantBaseline="central" fill="currentColor" stroke="none" fontFamily="var(--sans)">
      {children}
    </text>
  );
}

/** Winding glyph: Δ, Y or Yg (Y with ground). */
function Winding({ x, y, kind }: { x: number; y: number; kind: string }) {
  if (kind === 'Δ') return <path d={`M${x} ${y - 6} L${x + 6} ${y + 5} L${x - 6} ${y + 5} Z`} strokeWidth={1.5} />;
  return (
    <g strokeWidth={1.5}>
      <line x1={x} y1={y} x2={x} y2={y + 7} />
      <line x1={x} y1={y} x2={x - 6} y2={y - 5} />
      <line x1={x} y1={y} x2={x + 6} y2={y - 5} />
      {kind === 'Yg' && (
        <>
          <line x1={x - 4} y1={y + 7} x2={x + 4} y2={y + 7} />
          <line x1={x - 2} y1={y + 10} x2={x + 2} y2={y + 10} />
        </>
      )}
    </g>
  );
}

function Chevrons({ x, y, up }: { x: number; y: number; up: boolean }) {
  const d = up ? -5 : 5;
  return <path d={`M${x - 7} ${y - d} L${x} ${y} L${x + 7} ${y - d}`} strokeWidth={1.5} />;
}

const str = (v: unknown, fallback = '') => (v === undefined || v === null || v === '' ? fallback : String(v));

export interface SymbolProps {
  eq: Equipment;
  w: number;
  h: number;
}

function draw({ eq, w, h }: SymbolProps): ReactElement {
  const open = eq.state === 'open';
  switch (eq.type) {
    case 'utility':
      return (
        <g>
          <rect x={20} y={8} width={40} height={40} />
          <path d="M20 21h40M20 35h40M33 8v40M47 8v40" strokeWidth={1.2} />
          <Lead x={40} y1={48} y2={80} />
        </g>
      );
    case 'generator':
      return (
        <g>
          <circle cx={40} cy={34} r={24} />
          <Txt x={40} y={30}>G</Txt>
          <path d="M31 44 q4.5 -6 9 0 t9 0" strokeWidth={1.5} />
          <Lead x={40} y1={58} y2={80} />
        </g>
      );
    case 'pv':
      return (
        <g>
          <rect x={14} y={10} width={52} height={40} />
          <line x1={14} y1={50} x2={66} y2={10} strokeWidth={1.2} />
          <Txt x={30} y={22} size={10}>+</Txt>
          <Txt x={52} y={40} size={10}>PV</Txt>
          <Lead x={40} y1={50} y2={80} />
        </g>
      );
    case 'bess':
      return (
        <g>
          <rect x={14} y={8} width={52} height={44} />
          <path d="M26 22h28M32 30h16M26 38h28M32 46h16" strokeWidth={2} />
          <Lead x={40} y1={52} y2={80} />
        </g>
      );
    case 'inverter':
      return (
        <g>
          <Lead x={40} y1={0} y2={16} />
          <rect x={16} y={16} width={48} height={48} />
          <line x1={16} y1={64} x2={64} y2={16} strokeWidth={1.2} />
          <path d="M22 28h12M22 32h12" strokeWidth={1.5} />
          <path d="M44 52 q4 -6 8 0 t8 0" strokeWidth={1.5} />
          <Lead x={40} y1={64} y2={80} />
        </g>
      );
    case 'wind':
      return (
        <g>
          <circle cx={40} cy={30} r={22} />
          <path d="M40 30 L40 12 M40 30 L24 39 M40 30 L56 39" strokeWidth={2.5} />
          <circle cx={40} cy={30} r={3} fill="currentColor" />
          <Lead x={40} y1={52} y2={80} />
        </g>
      );
    case 'xfmr2': {
      const hv = str(eq.props['design.hvWinding'], 'Δ');
      const lv = str(eq.props['design.lvWinding'], 'Yg');
      return (
        <g>
          <Lead x={40} y1={0} y2={22} />
          <circle cx={40} cy={44} r={22} />
          <circle cx={40} cy={76} r={22} />
          <Lead x={40} y1={98} y2={120} />
          <Winding x={72} y={36} kind={hv} />
          <Winding x={72} y={84} kind={lv} />
        </g>
      );
    }
    case 'xfmr3': {
      return (
        <g>
          <Lead x={60} y1={0} y2={18} />
          <circle cx={60} cy={40} r={22} />
          <circle cx={44} cy={70} r={22} />
          <circle cx={76} cy={70} r={22} />
          <path d="M40 92 V120 M80 92 V120" />
          <Winding x={60} y={36} kind={str(eq.props['design.hvWinding'], 'Δ')} />
          <Winding x={40} y={72} kind={str(eq.props['design.lvWinding'], 'Yg')} />
          <Winding x={80} y={72} kind={str(eq.props['design.tvWinding'], 'Δ')} />
        </g>
      );
    }
    case 'breaker': {
      const drawout = str(eq.props['design.mounting'], 'Draw-out') === 'Draw-out';
      return (
        <g>
          <Lead x={20} y1={0} y2={drawout ? 16 : 26} />
          {drawout && <Chevrons x={20} y={20} up={false} />}
          {drawout && <Lead x={20} y1={20} y2={26} />}
          <rect x={8} y={26} width={24} height={28} className={open ? 'sym-open' : 'sym-closed'} />
          {drawout && <Lead x={20} y1={54} y2={60} />}
          {drawout && <Chevrons x={20} y={60} up />}
          <Lead x={20} y1={drawout ? 64 : 54} y2={80} />
        </g>
      );
    }
    case 'disconnect':
    case 'lbs':
      return (
        <g>
          <Lead x={20} y1={0} y2={26} />
          <path d="M14 26h12" />
          {open ? <line x1={20} y1={56} x2={6} y2={30} /> : <line x1={20} y1={56} x2={20} y2={26} />}
          <circle cx={20} cy={56} r={2.5} fill="currentColor" />
          {eq.type === 'lbs' && (open ? <path d="M3 36 l6 -2" strokeWidth={3} /> : <path d="M20 36 l-7 4" strokeWidth={1.5} />)}
          {eq.type === 'lbs' && !open && <path d="M10 38 a6 6 0 0 1 6 -8" strokeWidth={1.5} />}
          <Lead x={20} y1={56} y2={80} />
        </g>
      );
    case 'fuse':
      return (
        <g>
          <Lead x={20} y1={0} y2={22} />
          <rect x={12} y={22} width={16} height={36} />
          {open ? <path d="M20 22v12 M20 46v12" /> : <line x1={20} y1={22} x2={20} y2={58} />}
          <Lead x={20} y1={58} y2={80} />
        </g>
      );
    case 'recloser':
      return (
        <g>
          <Lead x={20} y1={0} y2={24} />
          <rect x={6} y={24} width={28} height={32} className={open ? 'sym-open' : 'sym-closed-soft'} />
          <Txt x={20} y={40} size={14}>R</Txt>
          <Lead x={20} y1={56} y2={80} />
        </g>
      );
    case 'contactor':
      return (
        <g>
          <Lead x={20} y1={0} y2={32} />
          <path d="M12 32h16" />
          <path d="M12 48h16" />
          {!open && <line x1={20} y1={32} x2={20} y2={48} />}
          <path d="M28 40 a8 8 0 0 0 -8 -8" strokeWidth={1.2} />
          <Lead x={20} y1={48} y2={80} />
        </g>
      );
    case 'bus':
      return <g />; // drawn by the bus node itself
    case 'lineup':
      return <rect x={1} y={1} width={w - 2} height={h - 2} strokeDasharray="10 6" strokeWidth={1.5} rx={6} />;
    case 'mcc':
    case 'panelboard':
      return (
        <g>
          <rect x={4} y={14} width={112} height={52} rx={3} />
          <Lead x={60} y1={0} y2={14} />
          <path d="M20 66v14 M60 66v14 M100 66v14" />
          <line x1={12} y1={52} x2={108} y2={52} strokeWidth={3} />
          <Txt x={60} y={32} size={13}>{eq.type === 'mcc' ? 'MCC' : 'PNL'}</Txt>
        </g>
      );
    case 'ct':
      return (
        <g>
          <Lead x={20} y1={0} y2={80} />
          <path d="M8 40 a12 12 0 0 1 24 0" />
          <path d="M8 44 a12 12 0 0 1 24 0" />
          <path d="M32 40 H40" strokeDasharray="3 2" strokeWidth={1.5} />
        </g>
      );
    case 'vt':
      return (
        <g>
          <Lead x={20} y1={0} y2={18} />
          <circle cx={20} cy={28} r={10} />
          <circle cx={20} cy={44} r={10} />
          <path d="M30 40 H40" strokeDasharray="3 2" strokeWidth={1.5} />
          <Ground x={20} y={54} />
        </g>
      );
    case 'relay': {
      const fn = str(eq.props['design.functions'] ?? eq.props['concept.functions'], '50/51');
      const size = fn.length > 8 ? 9 : fn.length > 5 ? 11 : 13;
      return (
        <g>
          <circle cx={40} cy={40} r={30} />
          <Txt x={40} y={40} size={size}>{fn}</Txt>
          <path d="M0 40 H10 M70 40 H80" strokeDasharray="3 2" strokeWidth={1.5} />
        </g>
      );
    }
    case 'meter':
      return (
        <g>
          <circle cx={22} cy={20} r={15} />
          <Txt x={22} y={20} size={12}>M</Txt>
          <path d="M0 20 H7" strokeDasharray="3 2" strokeWidth={1.5} />
        </g>
      );
    case 'arrester':
      return (
        <g>
          <Lead x={20} y1={0} y2={18} />
          <rect x={11} y={18} width={18} height={30} />
          <path d="M20 22 v10 l-4 -5 M20 32 l4 -5" strokeWidth={1.5} />
          <Lead x={20} y1={48} y2={56} />
          <Ground x={20} y={56} />
        </g>
      );
    case 'motor':
      return (
        <g>
          <Lead x={40} y1={0} y2={22} />
          <circle cx={40} cy={46} r={24} />
          <Txt x={40} y={46} size={16}>M</Txt>
        </g>
      );
    case 'load':
      return (
        <g>
          <Lead x={20} y1={0} y2={54} />
          <path d="M8 50 L20 70 L32 50 Z" fill="currentColor" />
        </g>
      );
    case 'capacitor':
      return (
        <g>
          <Lead x={20} y1={0} y2={34} />
          <path d="M6 34h28" strokeWidth={2.5} />
          <path d="M6 46 q14 -8 28 0" strokeWidth={2.5} />
          <Lead x={20} y1={42} y2={60} />
          <Ground x={20} y={60} />
        </g>
      );
    case 'reactor':
      return (
        <g>
          <Lead x={20} y1={0} y2={22} />
          <path d="M20 22 a8 6 0 0 1 0 12 a8 6 0 0 1 0 12 a8 6 0 0 1 0 12" />
          <Lead x={20} y1={58} y2={80} />
        </g>
      );
    case 'ground':
      return <Ground x={20} y={0} />;
    case 'tie': {
      const link = str(eq.props['concept.link'], '?');
      return (
        <g>
          <path d="M40 0 V6" />
          <path d="M8 6 H72 V26 L40 38 L8 26 Z" />
          <Txt x={40} y={17} size={link.length > 6 ? 9 : 11}>{link}</Txt>
        </g>
      );
    }
  }
}

export const SymbolSvg = memo(function SymbolSvg(p: SymbolProps & { transform?: string }) {
  return (
    <g transform={p.transform} fill="none" stroke="currentColor" strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round">
      {draw(p)}
    </g>
  );
});
