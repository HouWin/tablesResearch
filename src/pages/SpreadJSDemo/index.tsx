import '@grapecity-software/spread-sheets/styles/gc.spread.sheets.excel2013white.css';
import { useEffect, useRef, useState } from 'react';
import { InspectorPanels } from './components/inspector-panels';
import { DemoHeader, ToastMessage } from './components/spreadsheet-ui';
import { SpreadsheetToolbar } from './components/spreadsheet-toolbar';
import { SpreadsheetWorkspace } from './components/spreadsheet-workspace';
import { canDrillNode } from './spreadsheet/model';
import { useSpreadsheetController } from './spreadsheet/use-spreadsheet-controller';
import './index.less';

export default function SpreadJSDemoPage() {
  const pageRef = useRef<HTMLDivElement>(null);
  const [fullscreenAvailable, setFullscreenAvailable] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === pageRef.current);
    };

    setFullscreenAvailable(
      Boolean(document.fullscreenEnabled && pageRef.current?.requestFullscreen),
    );
    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);
    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
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
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement === pageRef.current) {
        await document.exitFullscreen();
      } else {
        await pageRef.current?.requestFullscreen();
      }
    } catch (error) {
      console.error('[SpreadJS Demo] 切换全屏失败', error);
    }
  };

  return (
    <div ref={pageRef} className="spreadjs-demo-page">
      <a className="skip-link" href="#spreadsheet-workspace">
        跳到费用预算表
      </a>
      <div className="demo-shell">
        <DemoHeader
          status={initializationError ? 'error' : ready ? 'ready' : 'loading'}
          licenseConfigured={licenseConfigured}
          fullscreenAvailable={fullscreenAvailable}
          isFullscreen={isFullscreen}
          onOpenFeatures={() => openPanel('features')}
          onToggleFullscreen={toggleFullscreen}
        />
        <SpreadsheetToolbar controller={controller} />
        <SpreadsheetWorkspace controller={controller} />
        <InspectorPanels
          controller={controller}
          canDrillSelected={canDrillSelected}
          licenseConfigured={licenseConfigured}
        />
        {toast ? <ToastMessage toast={toast} /> : null}
      </div>
    </div>
  );
}
