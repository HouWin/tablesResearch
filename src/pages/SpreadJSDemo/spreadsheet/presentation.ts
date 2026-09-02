import { displayValue, type SelectedCell } from './model';

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

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function canPreviewAttachment(mimeType: string, name: string) {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    /\.pdf$/i.test(name)
  );
}

export function getLineageDetails(
  selected: SelectedCell | null,
): LineageDetails | null {
  if (!selected) return null;
  const sourceIds = selected.node.sourceNodes.map(({ id }) => id).join('、');
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
