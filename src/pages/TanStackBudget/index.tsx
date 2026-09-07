import type { BusinessCellChangePayload } from '../SpreadJSDemo/spreadsheet/business-cell-change';
import { BudgetWorkbench } from './components/budget-workbench';
import { BudgetGrid } from './components/budget-grid';

function handleBusinessCellChange(payload: BusinessCellChangePayload) {
  // This demo exposes the integration payload in both development and production.
  console.log(
    `[TanStack Budget][单元格修改]\n${JSON.stringify(payload, null, 2)}`,
  );
}

export default function TanStackBudgetPage() {
  return (
    <BudgetWorkbench
      engineName="TanStack Table"
      Grid={BudgetGrid}
      onBusinessCellChange={handleBusinessCellChange}
    />
  );
}
