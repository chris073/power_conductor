// Stroked 20×20 icons in the Home Conductor style (currentColor, 1.6 stroke, round caps).

const PATHS = {
  folder: 'M2.5 5.5a1.5 1.5 0 0 1 1.5-1.5h3.5l2 2H16a1.5 1.5 0 0 1 1.5 1.5v7.5A1.5 1.5 0 0 1 16 16.5H4A1.5 1.5 0 0 1 2.5 15z',
  sld: 'M10 2v4M7 6h6v4H7zM10 10v3M4 13h12M6 13v4M14 13v4',
  history: 'M4 10a6 6 0 1 0 1.8-4.3M4 3.5v3h3M10 7v3.2l2.2 1.6',
  flag: 'M4 17V3M4 4h9l-1.5 3L13 10H4',
  doc: 'M5 2.5h6.5L15 6v11.5H5zM11 2.5V6h4M7.5 10h5M7.5 13h5',
  gear: 'M10 7.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4',
  sun: 'M10 6.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M4 16l1.4-1.4M14.6 5.4 16 4',
  moon: 'M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8z',
  auto: 'M10 3a7 7 0 1 1 0 14zM10 3a7 7 0 1 0 0 14',
  keyboard: 'M2.5 5.5h15v9h-15zM5 8.5h.01M8 8.5h.01M11 8.5h.01M14 8.5h.01M6 11.5h8',
  undo: 'M7 5 3.5 8.5 7 12M3.5 8.5H12a4.5 4.5 0 0 1 0 9H9',
  redo: 'M13 5l3.5 3.5L13 12M16.5 8.5H8a4.5 4.5 0 0 0 0 9h3',
  rotate: 'M15.5 10a5.5 5.5 0 1 1-1.6-3.9M15.5 3.5v3h-3',
  flip: 'M10 2.5v15M7.5 5 3 15h4.5zM12.5 5 17 15h-4.5z',
  trash: 'M4 5.5h12M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11',
  copy: 'M7 7h9v9H7zM4 13V4h9',
  power: 'M10 2.5v7M6 5a6 6 0 1 0 8 0',
  trace: 'M3 10h3l2-5 4 10 2-5h3',
  x: 'M5 5l10 10M15 5 5 15',
  fit: 'M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4',
  plus: 'M10 4v12M4 10h12',
  minus: 'M4 10h12',
  alignL: 'M3 3v14M6 6h9M6 12h5',
  alignC: 'M10 3v14M5 6h10M7 12h6',
  alignT: 'M3 3h14M6 6v9M12 6v5',
  alignM: 'M3 10h14M6 5v10M12 7v6',
  distH: 'M3 4v12M17 4v12M8 7h4v6H8z',
  distV: 'M4 3h12M4 17h12M7 8h6v4H7z',
  search: 'M8.5 3.5a5 5 0 1 1 0 10 5 5 0 0 1 0-10zM12.5 12.5 17 17',
  download: 'M10 3v10M6 9l4 4 4-4M4 16h12',
  upload: 'M10 15V5M6 9l4-4 4 4M4 17h12',
  bolt: 'M11 2 4 11h5l-1 7 7-9h-5z',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}
