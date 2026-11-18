// Dev-only: a large diagram for performance checks (default about 500 objects / 700 connections).
// Rows of: source -> bus -> N feeders (breaker -> load), plus short ties between neighboring loads.

import type { ProjectDoc } from '../domain/types';
import { sampleBuilder } from '../state/sample';

export function generateLargeDiagram(targetNodes = 500, targetConnections = 700): ProjectDoc {
  const b = sampleBuilder(`Perf test ${targetNodes}/${targetConnections}`);
  const rows = 10;
  const perRow = Math.max(1, Math.floor((targetNodes - rows * 2) / rows / 2)); // breaker + load per feeder
  const pitch = 80;
  let connections = 0;
  const loads: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const y0 = r * 400;
    const src = b.add('utility', `U-${r + 1}`, 0, y0, { 'design.kv': 13.8 });
    const busLen = perRow * pitch + 80;
    const bus = b.add('bus', `BUS-${r + 1}`, 120, y0 + 120, { 'design.kv': 13.8 }, { w: busLen });
    b.wire(src, 'T', bus, b.tap(bus, 0));
    connections++;
    const row: string[] = [];
    for (let i = 0; i < perRow; i++) {
      const x = 120 + 80 + i * pitch;
      const brk = b.add('breaker', `CB-${r + 1}-${i + 1}`, x - 20, y0 + 180, { 'design.ratedA': 600 });
      const ld = b.add(i % 3 === 0 ? 'motor' : 'load', `LD-${r + 1}-${i + 1}`, i % 3 === 0 ? x - 40 : x - 20, y0 + 300, { 'concept.kw': 100 });
      b.wire(bus, b.tap(bus, x - 120), brk, '1');
      b.wire(brk, '2', ld, 'T');
      connections += 2;
      row.push(ld);
    }
    loads.push(row);
  }
  // Extra cables between neighboring loads until the connection target is met.
  outer: for (const row of loads) {
    for (let i = 0; i + 1 < row.length; i++) {
      if (connections >= targetConnections) break outer;
      b.wire(row[i]!, 'T', row[i + 1]!, 'T');
      connections++;
    }
  }
  return b.doc;
}
