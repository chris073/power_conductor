// Align and distribute boxes. Works on plain rectangles; callers map results back to layout.

export interface Box { id: string; x: number; y: number; w: number; h: number }

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

export function align(boxes: Box[], mode: AlignMode): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  if (boxes.length < 2) return out;
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxX = Math.max(...boxes.map((b) => b.x + b.w));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxY = Math.max(...boxes.map((b) => b.y + b.h));
  // Centers align on the first selected item, which is what one-line work usually wants.
  const ref = boxes[0]!;
  for (const b of boxes) {
    let { x, y } = b;
    if (mode === 'left') x = minX;
    if (mode === 'right') x = maxX - b.w;
    if (mode === 'hcenter') x = ref.x + ref.w / 2 - b.w / 2;
    if (mode === 'top') y = minY;
    if (mode === 'bottom') y = maxY - b.h;
    if (mode === 'vcenter') y = ref.y + ref.h / 2 - b.h / 2;
    out[b.id] = { x, y };
  }
  return out;
}

export function distribute(boxes: Box[], axis: 'h' | 'v'): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  if (boxes.length < 3) return out;
  const sorted = [...boxes].sort((a, b) => (axis === 'h' ? a.x + a.w / 2 - (b.x + b.w / 2) : a.y + a.h / 2 - (b.y + b.h / 2)));
  const first = sorted[0]!, last = sorted[sorted.length - 1]!;
  const c0 = axis === 'h' ? first.x + first.w / 2 : first.y + first.h / 2;
  const c1 = axis === 'h' ? last.x + last.w / 2 : last.y + last.h / 2;
  const gap = (c1 - c0) / (sorted.length - 1);
  sorted.forEach((b, i) => {
    const c = c0 + gap * i;
    out[b.id] = axis === 'h' ? { x: c - b.w / 2, y: b.y } : { x: b.x, y: c - b.h / 2 };
  });
  return out;
}
