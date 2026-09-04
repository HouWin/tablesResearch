/**
 * 将后端 FormSchema（columns / records）适配为 ETable treeData + treeConfig。
 */
import type {
  ETableCell,
  ETableColumn,
  ETablePrimitive,
  ETableTreeConfig,
  ETableTreeNode,
} from '@/components/UniverTable/types';
import type {
  FormColumn,
  FormDimValue,
  FormRecord,
  FormSchema,
} from './formSchemaTypes';

export type FormAdaptMeta = {
  headerDepth: number;
  freezeCols: number;
  valueFields: string[];
  attrField?: string;
  rowDimField: string;
  /** 叶子 field → formDimValue */
  valueFormDimValue: Record<string, FormDimValue>;
  orgCount: number;
  flatRowCount: number;
};

export type FormAdaptResult = {
  treeData: ETableTreeNode[];
  treeConfig: ETableTreeConfig;
  meta: FormAdaptMeta;
};

const DEFAULT_ROW_WIDTH = 180;
const DEFAULT_ATTR_WIDTH = 110;
const DEFAULT_VALUE_WIDTH = 100;

const resolveWidth = (
  width: FormColumn['width'],
  fallback: number,
): number => {
  if (typeof width === 'number' && Number.isFinite(width)) {
    return width;
  }
  return fallback;
};

const firstLeafFormDimValue = (column: FormColumn): FormDimValue | undefined => {
  if (column.type === 'value' && column.formDimValue) {
    return column.formDimValue;
  }
  for (const child of column.columns ?? []) {
    const hit = firstLeafFormDimValue(child);
    if (hit) {
      return hit;
    }
  }
  return undefined;
};

const collectValueFields = (columns: FormColumn[]): string[] => {
  const fields: string[] = [];
  const walk = (cols: FormColumn[]) => {
    cols.forEach((col) => {
      if (col.type === 'value') {
        fields.push(col.field);
      }
      if (col.columns?.length) {
        walk(col.columns);
      }
    });
  };
  walk(columns);
  return fields;
};

const maxDepth = (columns: FormColumn[]): number => {
  let depth = 1;
  columns.forEach((col) => {
    if (col.columns?.length) {
      depth = Math.max(depth, 1 + maxDepth(col.columns));
    }
  });
  return depth;
};

const toMeasureColumn = (column: FormColumn): ETableColumn => {
  const editable = column.readOnly === true ? false : true;
  const base: ETableColumn = {
    id: column.field,
    title: column.title,
    dimensionField: column.field,
    width: resolveWidth(
      column.width,
      column.type === 'attr' ? DEFAULT_ATTR_WIDTH : DEFAULT_VALUE_WIDTH,
    ),
    editable,
  };

  if (column.type === 'attr' || column.dataType === 'enum') {
    return {
      ...base,
      type: 'select',
      options: (column.options ?? []).map((item) => item.value),
    };
  }

  if (column.dataType === 'percentage') {
    return {
      ...base,
      type: 'number',
      numberFormat: '0.00%',
      dimensionId: column.formDimValue?.default_measure ?? column.field,
    };
  }

  if (column.dataType === 'number' || column.type === 'value') {
    return {
      ...base,
      type: 'number',
      numberFormat: '#,##0.00',
      dimensionId: column.formDimValue?.default_measure ?? column.field,
    };
  }

  return base;
};

const toHeaderColumn = (
  column: FormColumn,
  pathKeys: string[] = [],
): ETableColumn => {
  if (column.type === 'value' || !column.columns?.length) {
    return toMeasureColumn(column);
  }

  const leafDim = firstLeafFormDimValue(column);
  const dimMember = leafDim?.[column.field];
  const uniqueKey = [...pathKeys, column.field, column.title, dimMember ?? '']
    .filter(Boolean)
    .join('__');

  return {
    id: uniqueKey,
    title: column.title,
    width: resolveWidth(column.width, DEFAULT_VALUE_WIDTH),
    editable: column.readOnly === true ? false : undefined,
    dimensionField: column.field,
    dimensionId: dimMember ?? column.field,
    children: column.columns.map((child) =>
      toHeaderColumn(child, [...pathKeys, uniqueKey]),
    ),
  };
};

const countTreeNodes = (nodes: ETableTreeNode[]): number =>
  nodes.reduce((sum, node) => {
    return sum + 1 + (node.children?.length ? countTreeNodes(node.children) : 0);
  }, 0);

const adaptRecord = (
  record: FormRecord,
  ctx: {
    rowDimField: string;
    attrField?: string;
    valueFields: string[];
  },
): ETableTreeNode => {
  const label = String(record[ctx.rowDimField] ?? '');
  const formDimValue = record.formDimValue ?? {};
  const id =
    formDimValue[ctx.rowDimField] ??
    `${ctx.rowDimField}-${label || 'row'}`;

  const values: Record<string, ETablePrimitive | ETableCell> = {};

  if (ctx.attrField) {
    const raw = record[ctx.attrField];
    const attrValue =
      raw === undefined || raw === null ? '' : (raw as ETablePrimitive);
    if (record.readOnly) {
      values[ctx.attrField] = {
        value: attrValue === '' ? '-' : attrValue,
        editable: false,
      };
    } else {
      values[ctx.attrField] = attrValue;
    }
  }

  ctx.valueFields.forEach((field) => {
    const raw = record[field];
    if (raw === undefined) {
      return;
    }
    if (record.readOnly) {
      values[field] = {
        value: raw as ETablePrimitive,
        editable: false,
      };
    } else {
      values[field] = raw as ETablePrimitive;
    }
  });

  const children = record.children?.map((child) => adaptRecord(child, ctx));

  return {
    id: String(id),
    label,
    collapsed: true,
    values,
    ...(children?.length ? { children } : {}),
  };
};

/**
 * columns → headerColumns / measures / dimensions
 */
export const adaptFormColumns = (columns: FormColumn[]) => {
  const rowDim = columns.find((col) => col.type === 'rowDim');
  if (!rowDim) {
    throw new Error('FormSchema.columns 缺少 type=rowDim 列');
  }
  const attr = columns.find((col) => col.type === 'attr');
  const colDims = columns.filter((col) => col.type === 'colDim');
  const valueFields = collectValueFields(columns);

  const dimensions = [
    {
      field: rowDim.field,
      title: rowDim.title,
      width: resolveWidth(rowDim.width, DEFAULT_ROW_WIDTH),
      editable: rowDim.readOnly === true ? false : true,
    },
  ];

  const measures: ETableColumn[] = [];
  if (attr) {
    measures.push(toMeasureColumn(attr));
  }

  const headerColumns: ETableColumn[] = [
    {
      id: rowDim.field,
      title: rowDim.title,
      width: resolveWidth(rowDim.width, DEFAULT_ROW_WIDTH),
      editable: false,
    },
  ];
  if (attr) {
    headerColumns.push(toMeasureColumn(attr));
  }

  colDims.forEach((col) => {
    const header = toHeaderColumn(col);
    headerColumns.push(header);
    const collectLeaves = (node: ETableColumn) => {
      if (!node.children?.length) {
        if (node.id !== rowDim.field && node.id !== attr?.field) {
          measures.push(node);
        }
        return;
      }
      node.children.forEach(collectLeaves);
    };
    collectLeaves(header);
  });

  const valueFormDimValue: Record<string, FormDimValue> = {};
  const walkValues = (cols: FormColumn[]) => {
    cols.forEach((col) => {
      if (col.type === 'value' && col.formDimValue) {
        valueFormDimValue[col.field] = col.formDimValue;
      }
      if (col.columns?.length) {
        walkValues(col.columns);
      }
    });
  };
  walkValues(columns);

  const headerDepth = maxDepth(
    columns.filter((col) => col.type === 'colDim' || col.type === 'value'),
  );
  // 行维 + 属性列不计入 colDim 深度；表头深度取多级 colDim/value 与左侧固定列的最大深度
  const leftDepth = 1;
  const resolvedHeaderDepth = Math.max(headerDepth, leftDepth);

  return {
    headerColumns,
    measures,
    dimensions,
    attrField: attr?.field,
    rowDimField: rowDim.field,
    valueFields,
    valueFormDimValue,
    headerDepth: resolvedHeaderDepth,
    freezeCols: 1 + (attr ? 1 : 0),
  };
};

export const adaptFormRecords = (
  records: FormRecord[],
  ctx: {
    rowDimField: string;
    attrField?: string;
    valueFields: string[];
  },
): ETableTreeNode[] => records.map((record) => adaptRecord(record, ctx));

export const adaptFormSchemaToETable = (
  schema: FormSchema,
  options?: { liteMode?: boolean; skipMerges?: boolean },
): FormAdaptResult => {
  const adapted = adaptFormColumns(schema.columns);
  const treeData = adaptFormRecords(schema.records, {
    rowDimField: adapted.rowDimField,
    attrField: adapted.attrField,
    valueFields: adapted.valueFields,
  });

  const treeConfig: ETableTreeConfig = {
    treeUI: true,
    labelMode: 'single',
    defaultCollapsed: true,
    dimensions: adapted.dimensions,
    headerColumns: adapted.headerColumns,
    measures: adapted.measures.map((col) => ({
      field: col.id,
      title: col.title,
      width: col.width,
      type: col.type,
      options: col.options,
      numberFormat: col.numberFormat,
    })),
    rowBackgrounds: ['#F7FBFF', '#F0F5FF'],
    ...(options?.liteMode
      ? { liteMode: true, skipMerges: options.skipMerges ?? true }
      : {}),
  };

  const orgCount = countTreeNodes(treeData);

  return {
    treeData,
    treeConfig,
    meta: {
      headerDepth: adapted.headerDepth,
      freezeCols: adapted.freezeCols,
      valueFields: adapted.valueFields,
      attrField: adapted.attrField,
      rowDimField: adapted.rowDimField,
      valueFormDimValue: adapted.valueFormDimValue,
      orgCount,
      flatRowCount: orgCount,
    },
  };
};
