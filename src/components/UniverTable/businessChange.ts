/**
 * 将行列维度转为业务变更载荷（row.key / col.key / oldValue / newValue）。
 * 行/列 path 使用真实维度 field，如 organization / subject / year。
 */
import type {
  ETableBusinessChange,
  ETableBusinessDimRef,
  ETableCellChangeRecord,
  ETableDimensionInfo,
  ETablePrimitive,
  ETableSelectionInfo,
} from './types';

const ATTR_FIELDS = new Set(['funcAttr', 'ATTR000038']);

const dimLabel = (dim: ETableDimensionInfo): string =>
  String(dim.value ?? dim.id ?? dim.title ?? dim.field ?? '').trim();

const isAttrField = (field?: string): boolean => {
  if (!field) {
    return false;
  }
  if (ATTR_FIELDS.has(field)) {
    return true;
  }
  return field.startsWith('ATTR') || field.startsWith('attr:');
};

/**
 * 行定位：按真实维度 field 展开；科目层级合并到 subject 一段。
 * 例：organization:华润微电子集团|subject:费用汇总:日常费用合计:费用-办公费
 */
export const buildBusinessRowRef = (
  rowDimensions?: ETableDimensionInfo[],
): ETableBusinessDimRef => {
  if (!rowDimensions?.length) {
    return { key: '', path: [] };
  }

  const path: string[] = [];
  const subjectLabels: string[] = [];

  const flushSubject = () => {
    if (!subjectLabels.length) {
      return;
    }
    path.push(`subject:${subjectLabels.join(':')}`);
    subjectLabels.length = 0;
  };

  rowDimensions.forEach((dim) => {
    const field = String(dim.field ?? '').trim();
    const label = dimLabel(dim);
    if (!field || !label) {
      return;
    }
    // subject / subjectDetail → 合并为 subject:汇总:中间层:…:明细
    // subjectDetail 可能已是「日常费用合计:费用-办公费」
    if (field === 'subject' || field === 'subjectDetail') {
      subjectLabels.push(...label.split(':').filter(Boolean));
      return;
    }
    flushSubject();
    path.push(`${field}:${label}`);
  });
  flushSubject();

  const key = path.join('|');
  return {
    key,
    path: key ? key.split('|') : [],
  };
};

/**
 * 列定位：按列维 field:成员 展开；属性列直接用 field。
 * 注意：列维通常没有 value，成员取 id / title，避免 path 变成 ['', '']。
 */
export const buildBusinessColRef = (
  columnDimensions?: ETableDimensionInfo[],
  field?: string,
  asAttr?: boolean,
): ETableBusinessDimRef => {
  if (asAttr) {
    const key = field || 'attr';
    return { key, path: [key] };
  }

  const segments = (columnDimensions ?? [])
    .map((dim) => {
      const dimField = String(dim?.field ?? '').trim();
      // 列维没有 value；优先 id，其次 title
      const member = String(dim?.id ?? dim?.title ?? '').trim();
      if (dimField && member) {
        return `${dimField}:${member}`;
      }
      return dimField || member;
    })
    .filter((segment) => Boolean(segment));

  if (!segments.length && field) {
    return { key: field, path: [field] };
  }

  const key = segments.join('|');
  // path 与 key 同源，避免两者不一致
  return {
    key,
    path: key ? key.split('|') : [],
  };
};

const coerceBusinessValue = (
  raw: string,
  type: ETableBusinessChange['type'],
): ETablePrimitive => {
  if (type === 'attr') {
    return raw;
  }
  const text = String(raw ?? '').trim();
  if (text === '') {
    return null;
  }
  const normalized = text.replace(/,/g, '');
  const num = Number(normalized);
  if (Number.isFinite(num) && /^-?\d+(\.\d+)?$/.test(normalized)) {
    return num;
  }
  return raw;
};

export type BuildBusinessChangeInput = {
  from?: string;
  to?: string;
  field?: string;
  rowDimensions?: ETableDimensionInfo[];
  columnDimensions?: ETableDimensionInfo[];
  action?: ETableBusinessChange['action'];
};

/** 由维度信息生成业务变更载荷 */
export const buildBusinessChange = (
  input: BuildBusinessChangeInput,
): ETableBusinessChange => {
  const type: ETableBusinessChange['type'] = isAttrField(input.field)
    ? 'attr'
    : 'value';
  return {
    action: input.action ?? 'change',
    type,
    row: buildBusinessRowRef(input.rowDimensions),
    col: buildBusinessColRef(
      input.columnDimensions,
      input.field,
      type === 'attr',
    ),
    oldValue: coerceBusinessValue(input.from ?? '', type),
    newValue: coerceBusinessValue(input.to ?? '', type),
  };
};

export const attachBusinessChange = (
  record: ETableCellChangeRecord,
): ETableCellChangeRecord => ({
  ...record,
  change: buildBusinessChange({
    from: record.from,
    to: record.to,
    field: record.field,
    rowDimensions: record.rowDimensions,
    columnDimensions: record.columnDimensions,
  }),
});

/** 选区信息也可生成同结构（无 old/new 时用当前格，仅定位） */
export const buildBusinessChangeFromSelection = (
  info: ETableSelectionInfo,
  values?: { oldValue?: string; newValue?: string },
): ETableBusinessChange =>
  buildBusinessChange({
    from: values?.oldValue ?? '',
    to: values?.newValue ?? '',
    field: info.field,
    rowDimensions: info.rowDimensions,
    columnDimensions: info.columnDimensions,
  });
