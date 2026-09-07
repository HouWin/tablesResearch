import type { BusinessCellChangePayload } from '../SpreadJSDemo/spreadsheet/business-cell-change';
import { BudgetWorkbench } from '../TanStackBudget/components/budget-workbench';
import { VTableBudgetGrid } from './budget-grid';
import './index.less';

/** Keep the integration payload identical to the SpreadJS budget page. */
function handleBusinessCellChange(payload: BusinessCellChangePayload) {
  console.log(
    `[VTable Budget][单元格修改]\n${JSON.stringify(payload, null, 2)}`,
  );
}

export default function VTablePage() {
  return (
    <BudgetWorkbench
      engineName="VTable"
      Grid={VTableBudgetGrid}
      onBusinessCellChange={handleBusinessCellChange}
    />
  );
}
