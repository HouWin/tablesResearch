/**
 * 费用预算表使用的稳定业务编码。
 *
 * Worksheet 的字段名、中文标题和物理行列号都属于展示层；保存、定位等
 * 跨层协议只传递“维度编码 -> 成员编码”，避免后端解析复合 field。
 */
export const BUSINESS_DIMENSION_CODES = {
  organization: 'DIM0090',
  subject: 'DIM0069',
  dataCategory: 'DIM0086',
  year: 'DIM0067',
  period: 'DIM0068',
  measure: 'default_measure',
} as const;

export const BUSINESS_ATTRIBUTE_CODES = {
  functionalAttribute: 'ATTR000038',
} as const;

export type BusinessDimensionCode =
  (typeof BUSINESS_DIMENSION_CODES)[keyof typeof BUSINESS_DIMENSION_CODES];

/** 维度编码到成员编码的无序映射。 */
export type DimensionMemberValues = Readonly<Record<string, string>>;

export function dimensionMemberValuesKey(values: DimensionMemberValues) {
  return JSON.stringify(
    Object.entries(values).sort(([left], [right]) => left.localeCompare(right)),
  );
}

export function cloneDimensionMemberValues<T extends DimensionMemberValues>(
  values: T,
): T {
  return { ...values };
}

export function hasExactDimensionCodes(
  value: unknown,
  dimensionCodes: readonly string[],
): value is DimensionMemberValues {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value);
  if (entries.length !== dimensionCodes.length) return false;
  const expectedCodes = new Set(dimensionCodes);
  return entries.every(
    ([code, memberCode]) =>
      expectedCodes.has(code) &&
      typeof memberCode === 'string' &&
      Boolean(memberCode.trim()),
  );
}

/**
 * Demo 中模拟后端成员编码。recordId 仍表示数据记录，memberCode 只表示维度
 * 成员，二者刻意分离，以免真实接口接入时继续误用记录 ID 充当成员编码。
 */
export function createDemoMemberCode(
  namespace: 'ORG' | 'SUBJECT',
  stableId: string,
) {
  return `MEM_${namespace}_${stableId
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toUpperCase()}`;
}
