import { displayValue, getCellSourceNode, type SelectedCell } from './model';

export type LineageDetails = {
  result: string;
  description: string;
  rule: string;
  sources: readonly {
    label: string;
    value: string;
    note: string;
  }[];
};

export function getLineageDetails(
  selected: SelectedCell | null,
): LineageDetails | null {
  if (!selected) return null;
  const cellSource = getCellSourceNode(selected.node, selected.col);
  const sourceIds = cellSource
    ? cellSource.id
    : selected.node.sourceNodes.map(({ id }) => id).join('、');
  return {
    result: selected.text || displayValue(selected.value),
    description: '后台接口返回值',
    rule: '前端不计算、不联动',
    sources: [
      {
        label: '后台字段',
        value: selected.fieldLabel,
        note: `${selected.field} · ${sourceIds || selected.node.id}`,
      },
    ],
  };
}
