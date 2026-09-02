import { formatMoney, type SelectedCell } from './model';

export type LineageDetails = {
  result: string;
  description: string;
  formula: string;
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
  if (selected.field === 'revenue') {
    return {
      result: formatMoney(selected.node.revenue),
      description: '商品收入 + 服务收入',
      formula: 'SUM(商品收入, 服务收入)',
      sources: [
        {
          label: '商品收入',
          value: formatMoney(selected.node.productRevenue),
          note: `业务日报 · ${selected.node.id}`,
        },
        {
          label: '服务收入',
          value: formatMoney(selected.node.serviceRevenue),
          note: '服务台账 · 已核验',
        },
      ],
    };
  }
  if (selected.field === 'avgOrder') {
    return {
      result: formatMoney(selected.node.avgOrder),
      description: '净收入 ÷ 订单数',
      formula: 'DIVIDE(净收入, 订单数)',
      sources: [
        {
          label: '净收入',
          value: formatMoney(selected.node.revenue),
          note: `业务日报 · ${selected.node.id}`,
        },
        {
          label: '订单数',
          value: selected.node.orders.toLocaleString('zh-CN'),
          note: '订单明细 · 去重后',
        },
      ],
    };
  }
  if (selected.field === 'completion') {
    const target = selected.node.completion
      ? selected.node.revenue / selected.node.completion
      : 0;
    return {
      result: `${(selected.node.completion * 100).toFixed(1)}%`,
      description: '实际完成额 ÷ 目标额',
      formula: 'DIVIDE(实际完成额, 目标额)',
      sources: [
        {
          label: '实际完成额',
          value: formatMoney(selected.node.revenue),
          note: `经营日报 · ${selected.node.id}`,
        },
        {
          label: '目标额',
          value: formatMoney(target),
          note: '目标计划 · 当前周期',
        },
      ],
    };
  }
  return null;
}
