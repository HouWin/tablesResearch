import '@grapecity-software/spread-sheets/styles/gc.spread.sheets.excel2013white.css';
import { useEffect } from 'react';
import { InspectorPanels } from './components/inspector-panels';
import { DemoHeader, ToastMessage } from './components/spreadsheet-ui';
import { SpreadsheetToolbar } from './components/spreadsheet-toolbar';
import { SpreadsheetWorkspace } from './components/spreadsheet-workspace';
import { canDrillNode } from './spreadsheet/model';
import { useSpreadsheetController } from './spreadsheet/use-spreadsheet-controller';
import './index.less';

export default function SpreadJSDemoPage() {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = '经营数据表 · 经营分析工作台';
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const controller = useSpreadsheetController();
  const {
    initializationError,
    ready,
    selected,
    dataMode,
    openPanel,
    toast,
    licenseConfigured,
  } = controller;
  const canDrillSelected =
    dataMode === 'regular' && canDrillNode(selected?.node);

  return (
    <div className="spreadjs-demo-page">
      <a className="skip-link" href="#spreadsheet-workspace">
        跳到经营数据表
      </a>
      <main className="demo-shell">
        <DemoHeader
          status={initializationError ? 'error' : ready ? 'ready' : 'loading'}
          licenseConfigured={licenseConfigured}
          onOpenFeatures={() => openPanel('features')}
        />
        <SpreadsheetToolbar controller={controller} />
        <SpreadsheetWorkspace controller={controller} />
        <InspectorPanels
          controller={controller}
          canDrillSelected={canDrillSelected}
          licenseConfigured={licenseConfigured}
        />
        {toast ? <ToastMessage toast={toast} /> : null}
      </main>
    </div>
  );
}
