import { toBusinessCellDimension } from './business-cell-coordinate';
import {
  BUSINESS_ATTRIBUTE_CODES,
  BUSINESS_DIMENSION_CODES,
  COLUMNS,
  getCellSourceNode,
  getCellSourceRowDimension,
  isValueColumn,
  type BusinessField,
  type BusinessRowDimension,
  type BudgetValueField,
  type ViewRow,
} from './model';

type BusinessCellChangeBase = {
  /** 后台 BUSINESS_DATA 中被修改的唯一记录。 */
  recordId: string;
  oldValue: unknown;
  newValue: unknown;
};

export type BusinessValueCellChangePayload = BusinessCellChangeBase & {
  type: 'value';
  /** 完整行维和列维，可原样回传给 locateBusinessCell。 */
  dimension: NonNullable<ReturnType<typeof toBusinessCellDimension>>;
};

export type BusinessAttributeChangePayload = BusinessCellChangeBase & {
  type: 'attribute';
  /** 属性修改不伪装成数值列坐标，单独描述属性及其所属维度成员。 */
  row: BusinessRowDimension;
  attribute: {
    code: typeof BUSINESS_ATTRIBUTE_CODES.functionalAttribute;
    owner: {
      dimensionCode: typeof BUSINESS_DIMENSION_CODES.subject;
      memberCode: string;
    };
  };
};

export type BusinessCellChangePayload =
  | BusinessValueCellChangePayload
  | BusinessAttributeChangePayload;

type BusinessCellEditTargetBase = {
  recordId: string;
  rowDimension: BusinessRowDimension;
};

export type BusinessCellEditTarget = BusinessCellEditTargetBase &
  (
    | {
        type: 'value';
        field: BudgetValueField;
        dimension: BusinessValueCellChangePayload['dimension'];
      }
    | {
        type: 'attribute';
        field: Extract<BusinessField, 'functionalAttribute'>;
        row: BusinessRowDimension;
        attribute: BusinessAttributeChangePayload['attribute'];
      }
  );

/**
 * 将当前投影单元格转换为保存目标。该函数是 Worksheet 与后端保存协议之间
 * 的唯一适配点，展示组件和事件处理器无需了解维度编码的拼装规则。
 */
export function toBusinessCellEditTarget(
  row: ViewRow | undefined,
  col: number,
): BusinessCellEditTarget | null {
  const column = COLUMNS[col];
  const sourceNode = getCellSourceNode(row, col);
  const rowDimension = getCellSourceRowDimension(row, col);
  if (!row || !column || !sourceNode || !rowDimension) return null;

  const base = {
    recordId: sourceNode.id,
    rowDimension,
  };
  if (isValueColumn(column)) {
    const dimension = toBusinessCellDimension(row, col);
    return dimension
      ? {
          ...base,
          type: 'value',
          field: column.field,
          dimension,
        }
      : null;
  }
  if (column.type !== 'attr') return null;
  return {
    ...base,
    type: 'attribute',
    field: column.field,
    row: rowDimension,
    attribute: {
      code: column.attributeCode,
      owner: {
        dimensionCode: column.ownerDimensionCode,
        memberCode: rowDimension[column.ownerDimensionCode],
      },
    },
  };
}

export function createBusinessCellChangePayload(
  target: BusinessCellEditTarget,
  oldValue: unknown,
  newValue: unknown,
): BusinessCellChangePayload {
  const base = {
    recordId: target.recordId,
    oldValue,
    newValue,
  };
  return target.type === 'value'
    ? {
        type: 'value',
        ...base,
        dimension: target.dimension,
      }
    : {
        type: 'attribute',
        ...base,
        row: target.row,
        attribute: target.attribute,
      };
}
