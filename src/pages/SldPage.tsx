import { CanvasProvider, SldCanvas } from '../canvas/SldCanvas';
import { useProject } from '../state/projectStore';
import { useUi } from '../state/uiStore';
import { Inspector } from './sld/Inspector';
import { Legend } from './sld/Legend';
import { Palette } from './sld/Palette';
import { SheetTabs } from './sld/SheetTabs';
import { Toolbar } from './sld/Toolbar';

export function SldPage() {
  const sheets = useProject((s) => s.doc.sheets);
  const sheetId = useUi((s) => s.sheetId);
  const current = sheets.find((s) => s.id === sheetId)?.id ?? sheets[0]!.id;
  return (
    <CanvasProvider>
      <div className="sld">
        <Palette />
        <div className="sld-main">
          <Toolbar />
          <div className="sld-stage">
            <SldCanvas sheetId={current} />
            <Legend />
          </div>
          <SheetTabs current={current} />
        </div>
        <Inspector />
      </div>
    </CanvasProvider>
  );
}
