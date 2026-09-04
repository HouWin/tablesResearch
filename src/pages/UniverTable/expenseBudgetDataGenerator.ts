/**
 * 费用预算大数据：按 FormSchema.records 形状生成，再经 adaptFormSchemaToETable 接入 ETable。
 */
import { adaptFormSchemaToETable } from './adaptFormSchemaToETable';
import { expenseBudgetFormData } from './expenseBudgetFormData';
import type { FormRecord, FormSchema } from './formSchemaTypes';
import type { ETableTreeNode } from '@/components/UniverTable/types';

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const listValueFields = (schema: FormSchema): string[] => {
  const fields: string[] = [];
  const walk = (cols: FormSchema['columns']) => {
    cols.forEach((col) => {
      if (col.type === 'value') {
        fields.push(col.field);
      }
      if (col.columns?.length) {
        walk(col.columns);
      }
    });
  };
  walk(schema.columns);
  return fields;
};

const rowDimField =
  expenseBudgetFormData.columns.find((col) => col.type === 'rowDim')?.field ??
  'DIM0069';
const attrField = expenseBudgetFormData.columns.find(
  (col) => col.type === 'attr',
)?.field;
const VALUE_FIELDS = listValueFields(expenseBudgetFormData);

const SAMPLE_LEAVES: FormRecord[] =
  (expenseBudgetFormData.records[0]?.children as FormRecord[] | undefined) ??
  [];

const makeLeafRecord = (
  index: number,
  template: FormRecord,
): FormRecord => {
  const row = cloneJson(template);
  const label = String(template[rowDimField] ?? `科目`);
  row[rowDimField] = `${label}-${index + 1}`;
  row.formDimValue = {
    ...(template.formDimValue ?? {}),
    [rowDimField]: `MEM-leaf-${index}`,
  };
  row.readOnly = false;
  // 轻微一点数值，避免全表相同
  VALUE_FIELDS.forEach((field, fieldIndex) => {
    const base = template[field];
    if (typeof base === 'number') {
      row[field] = base + ((index + fieldIndex) % 7);
    }
  });
  return row;
};

const makeGroupRecord = (
  groupIndex: number,
  leaves: FormRecord[],
): FormRecord => {
  const row: FormRecord = {
    [rowDimField]: `费用合计组 ${groupIndex + 1}`,
    ...(attrField ? { [attrField]: '' } : {}),
    formDimValue: { [rowDimField]: `MEM-group-${groupIndex}` },
    readOnly: true,
    children: leaves,
  };
  VALUE_FIELDS.forEach((field) => {
    row[field] = null;
  });
  return row;
};

/**
 * 规划分组数 / 每组叶子数，使展平行数贴近 targetFlatRows。
 * 每组 1 个父行 + leafPerGroup 个子行。
 */
export const planScaledExpenseBudgetForm = (targetFlatRows: number) => {
  const groupCount = Math.min(
    200,
    Math.max(4, Math.round(Math.sqrt(Math.max(targetFlatRows, 2) / 8))),
  );
  const leafPerGroup = Math.max(
    1,
    Math.floor((targetFlatRows - groupCount) / groupCount),
  );
  const flatRowCount = groupCount * (1 + leafPerGroup);
  return { groupCount, leafPerGroup, flatRowCount };
};

/**
 * 分片生成 FormSchema，再适配为 ETable treeData。
 */
export const generateScaledExpenseBudgetTreeData = (
  targetFlatRows: number,
  onProgress?: (percent: number) => void,
): Promise<{
  treeData: ETableTreeNode[];
  flatRowCount: number;
  orgCount: number;
  treeConfig: ReturnType<typeof adaptFormSchemaToETable>['treeConfig'];
  meta: ReturnType<typeof adaptFormSchemaToETable>['meta'];
}> =>
  new Promise((resolve) => {
    const { groupCount, leafPerGroup, flatRowCount } =
      planScaledExpenseBudgetForm(targetFlatRows);
    const templates =
      SAMPLE_LEAVES.length > 0
        ? SAMPLE_LEAVES
        : [
            {
              [rowDimField]: '科目',
              ...(attrField ? { [attrField]: '管理费用' } : {}),
              formDimValue: { [rowDimField]: 'MEM-tpl' },
              readOnly: false,
            } as FormRecord,
          ];

    const groups: FormRecord[] = new Array(groupCount);
    let groupIndex = 0;
    const chunkSize =
      targetFlatRows >= 500000
        ? Math.max(20, Math.floor(leafPerGroup / 25))
        : Math.max(40, Math.floor(leafPerGroup / 10));

    const buildGroup = () => {
      const leaves: FormRecord[] = new Array(leafPerGroup);
      let leafIndex = 0;

      const buildLeaves = () => {
        const end = Math.min(leafIndex + chunkSize, leafPerGroup);
        for (; leafIndex < end; leafIndex += 1) {
          const globalIndex = groupIndex * leafPerGroup + leafIndex;
          const template = templates[globalIndex % templates.length];
          leaves[leafIndex] = makeLeafRecord(globalIndex, template);
        }

        onProgress?.(
          Math.min(
            99,
            Math.round(
              ((groupIndex + leafIndex / leafPerGroup) / groupCount) * 100,
            ),
          ),
        );

        if (leafIndex < leafPerGroup) {
          window.setTimeout(buildLeaves, 0);
          return;
        }

        groups[groupIndex] = makeGroupRecord(groupIndex, leaves);
        groupIndex += 1;

        if (groupIndex < groupCount) {
          window.setTimeout(buildGroup, 0);
          return;
        }

        const schema: FormSchema = {
          columns: cloneJson(expenseBudgetFormData.columns),
          records: groups,
          formStatus: expenseBudgetFormData.formStatus,
          filters: expenseBudgetFormData.filters,
        };
        const adapted = adaptFormSchemaToETable(schema, {
          liteMode: true,
          skipMerges: true,
        });
        onProgress?.(100);
        resolve({
          treeData: adapted.treeData,
          flatRowCount: adapted.meta.flatRowCount || flatRowCount,
          orgCount: adapted.meta.orgCount,
          treeConfig: adapted.treeConfig,
          meta: adapted.meta,
        });
      };

      buildLeaves();
    };

    buildGroup();
  });
