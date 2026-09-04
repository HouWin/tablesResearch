import {
  BUDGET_VALUE_FIELDS,
  BUSINESS_DATA,
  createBusinessRowDimension,
  createDemoMemberCode,
  stressSummaryRecordKey,
  type BudgetValues,
  type BusinessColumnDimension,
  type BusinessRowDimension,
  type OrganizationNode,
  type StressSummaryRecords,
  type SubjectNode,
  type ViewRow,
} from './model';

export const STRESS_ROW_COUNT = 100_000;
export const STRESS_PAGE_SIZE = 400;
export const STRESS_PAGE_FETCH_DELAY_MS = 120;

export type BudgetPageRequest = {
  /** 服务端返回的不可解析游标；首批不传。 */
  cursor?: string;
  pageSize: number;
  /** 查询条件发生变化时，服务端据此拒绝复用旧游标。 */
  queryVersion: string;
  signal?: AbortSignal;
};

export type BudgetPageResponse<Row> = {
  items: readonly Row[];
  nextCursor: string | null;
  totalRows: number;
  datasetVersion: string;
};

export type BudgetDatasetManifest = {
  datasetVersion: string;
  queryVersion: string;
  totalRows: number;
  recommendedPageSize: number;
};

/**
 * 生产环境的大数据契约。列表、搜索和定位都应由服务端执行，避免为了
 * 找一个单元格而让浏览器下载完整数据集。
 */
export interface BudgetPageGateway<Row> {
  fetchManifest(request: {
    queryVersion: string;
    signal?: AbortSignal;
  }): Promise<BudgetDatasetManifest>;
  fetchPage(request: BudgetPageRequest): Promise<BudgetPageResponse<Row>>;
  search?(request: {
    query: string;
    cursor?: string;
    pageSize: number;
    queryVersion: string;
    signal?: AbortSignal;
  }): Promise<
    BudgetPageResponse<{
      row: BusinessRowDimension;
      column: BusinessColumnDimension;
    }>
  >;
  locate?(request: {
    row: BusinessRowDimension;
    column: BusinessColumnDimension;
    queryVersion: string;
    signal?: AbortSignal;
  }): Promise<{ rowIndex: number; pageCursor: string | null } | null>;
}

export type StressProjectionPage = {
  pageIndex: number;
  startRow: number;
  rows: readonly ViewRow[];
  totalRows: number;
  projectionVersion: number;
};

export interface StressProjectionPageSource {
  replaceProjection(rows: readonly ViewRow[]): number;
  fetchPage(
    pageIndex: number,
    signal?: AbortSignal,
  ): Promise<StressProjectionPage>;
  dispose(): void;
}

export type StressBackendDataset = {
  /** 后台明细记录；10 万行模式的规模口径。 */
  detailRows: ViewRow[];
  /** 后台汇总记录；每个组织、每个科目一条，可独立编辑。 */
  summaryRecords: StressSummaryRecords;
};

const REGION_NAMES = [
  '华东',
  '华南',
  '华北',
  '华中',
  '西南',
  '西北',
  '东北',
  '长三角',
  '粤港澳',
  '成渝',
] as const;

const CITY_NAMES = [
  '上海',
  '无锡',
  '苏州',
  '深圳',
  '东莞',
  '北京',
  '天津',
  '武汉',
  '西安',
  '成都',
  '重庆',
  '合肥',
] as const;

const COST_SCENARIOS = [
  '总部共享',
  '晶圆制造',
  '封装测试',
  '研发平台',
  '市场销售',
  '供应链',
  '数字化',
  '质量管理',
] as const;

type StressSubjectTemplate = {
  summary: string;
  attribute: string;
  baseMonthly: number;
  details: readonly string[];
  seasonality?: readonly number[];
};

const DEFAULT_SEASONALITY = [
  0.92, 0.88, 1.02, 1.04, 1.0, 1.03, 1.08, 1.06, 1.01, 1.04, 1.0, 1.12,
] as const;

const STRESS_SUBJECTS: readonly StressSubjectTemplate[] = [
  {
    summary: '日常费用合计',
    attribute: '管理',
    baseMonthly: 6_800,
    details: [
      '费用-办公费',
      '费用-电费',
      '费用-水费',
      '费用-物业费',
      '费用-通讯费',
      '费用-会议费',
      '费用-差旅费',
      '费用-低值易耗品',
    ],
  },
  {
    summary: '人力成本合计',
    attribute: '管理',
    baseMonthly: 28_000,
    details: [
      '基本薪酬',
      '社会保险',
      '住房公积金',
      '员工福利',
      '招聘费',
      '培训费',
    ],
  },
  {
    summary: '研发投入合计',
    attribute: '研发',
    baseMonthly: 46_000,
    details: [
      '研发材料费',
      '试验检测费',
      'EDA 软件费',
      '研发设备租赁',
      '专利及认证费',
    ],
  },
  {
    summary: '市场销售费用合计',
    attribute: '销售',
    baseMonthly: 22_000,
    details: [
      '客户拓展费',
      '展会费',
      '市场推广费',
      '销售佣金',
      '样品费',
      '售后服务费',
    ],
    seasonality: [
      0.76, 0.72, 1.08, 1.16, 1.12, 0.98, 0.92, 0.9, 1.18, 1.22, 1.1, 0.86,
    ],
  },
  {
    summary: '生产制造费用合计',
    attribute: '生产',
    baseMonthly: 65_000,
    details: [
      '动力费',
      '设备维护费',
      '洁净室运行费',
      '工装治具费',
      '生产辅料',
      '外协加工费',
    ],
    seasonality: [
      0.9, 0.82, 1.04, 1.06, 1.08, 1.12, 1.18, 1.16, 1.06, 1.02, 0.98, 0.88,
    ],
  },
  {
    summary: '供应链与物流费用合计',
    attribute: '供应链',
    baseMonthly: 18_000,
    details: [
      '国内运输费',
      '国际货运费',
      '仓储费',
      '报关费',
      '包装材料费',
      '供应商审核费',
    ],
  },
  {
    summary: '信息化费用合计',
    attribute: '信息化',
    baseMonthly: 16_000,
    details: [
      '云资源费',
      '软件订阅费',
      '网络专线费',
      '终端设备费',
      '系统运维费',
      '信息安全费',
    ],
  },
  {
    summary: '质量与合规费用合计',
    attribute: '质量',
    baseMonthly: 12_500,
    details: [
      '质量检测费',
      '体系认证费',
      '环境监测费',
      '安全生产费',
      '合规咨询费',
      '职业健康费',
    ],
  },
  {
    summary: '折旧与摊销合计',
    attribute: '财务',
    baseMonthly: 38_000,
    details: [
      '厂房折旧',
      '生产设备折旧',
      '研发设备折旧',
      '软件摊销',
      '使用权资产折旧',
    ],
    seasonality: Array(12).fill(1),
  },
  {
    summary: '财务及其他费用合计',
    attribute: '财务',
    baseMonthly: 9_500,
    details: [
      '银行手续费',
      '汇兑损益',
      '保险费',
      '审计费',
      '税务咨询费',
      '诉讼及法务费',
    ],
  },
] as const;

const STRESS_GROUP_SIZE = 10_000;
const STRESS_PRODUCT_SIZE = 1_000;
const STRESS_SUBJECT_SIZE = 100;

function flattenOrganizations(
  nodes: readonly OrganizationNode[],
): OrganizationNode[] {
  return nodes.flatMap((node) => [
    node,
    ...flattenOrganizations(node.children ?? []),
  ]);
}

const REGULAR_ORGANIZATION_NAMES = flattenOrganizations(BUSINESS_DATA).map(
  (organization) => organization.name,
);

function mix32(value: number) {
  let mixed = value | 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x45d9f3b);
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x45d9f3b);
  return (mixed ^ (mixed >>> 16)) >>> 0;
}

function roundBudget(value: number) {
  return Math.max(0, Math.round(value / 10) * 10);
}

function createBudgetValues(
  index: number,
  template: StressSubjectTemplate,
): BudgetValues {
  const months = new Array<number>(12);
  let annualTotal = 0;
  for (let month = 0; month < months.length; month += 1) {
    const random = mix32(index * 37 + month * 101 + 17) / 0xffffffff;
    const responsibilityFactor = 0.72 + (index % 17) * 0.035;
    const variance = 0.88 + random * 0.24;
    const seasonality = (template.seasonality ?? DEFAULT_SEASONALITY)[month];
    const value = roundBudget(
      template.baseMonthly * responsibilityFactor * variance * seasonality,
    );
    months[month] = value;
    annualTotal += value;
  }
  return {
    annualTotal,
    january: months[0],
    february: months[1],
    march: months[2],
    april: months[3],
    may: months[4],
    june: months[5],
    july: months[6],
    august: months[7],
    september: months[8],
    october: months[9],
    november: months[10],
    december: months[11],
  };
}

function createStressRecord(index: number): ViewRow {
  const groupIndex = Math.floor(index / STRESS_GROUP_SIZE);
  const productIndex = Math.floor(index / STRESS_PRODUCT_SIZE);
  const subjectIndex =
    Math.floor(index / STRESS_SUBJECT_SIZE) % STRESS_SUBJECTS.length;
  const detailIndex = index % STRESS_SUBJECT_SIZE;
  const template = STRESS_SUBJECTS[subjectIndex];
  const productId = `stress-unit-${productIndex}`;
  const productParentId = `stress-group-${groupIndex}`;
  const regionName = REGION_NAMES[groupIndex % REGION_NAMES.length];
  const baseOrganization =
    REGULAR_ORGANIZATION_NAMES[
      productIndex % REGULAR_ORGANIZATION_NAMES.length
    ];
  const city = CITY_NAMES[productIndex % CITY_NAMES.length];
  const scenario = COST_SCENARIOS[productIndex % COST_SCENARIOS.length];
  const groupLabel = `${
    BUSINESS_DATA[0]?.name ?? '华润微电子集团'
  } · ${regionName}经营单元`;
  const productLabel = `${baseOrganization} · ${city}${scenario} CC-${String(
    productIndex + 1,
  ).padStart(4, '0')}`;
  const detailName = template.details[detailIndex % template.details.length];
  const detailLabel = `${detailName} · ${String(detailIndex + 1).padStart(
    3,
    '0',
  )}`;
  const regionRootId = `stress-subject-${productIndex}-${subjectIndex}`;
  const businessNode: SubjectNode = {
    id: `stress-record-${index}`,
    memberCode: createDemoMemberCode('SUBJECT', `stress-record-${index}`),
    name: detailLabel,
    functionalAttribute: template.attribute,
    ...createBudgetValues(index, template),
  };
  const record: ViewRow = {
    ...businessNode,
    rowDimension: createBusinessRowDimension(
      createDemoMemberCode('ORG', productId),
      businessNode.memberCode,
    ),
    sourceNodes: [],
    productId,
    productParentId,
    productParentLabel: groupLabel,
    productAncestorIds: [productParentId],
    productLabel,
    productDepth: 1,
    productIsGroup: false,
    productExpanded: false,
    productBlockStart: false,
    productRowSpan: 1,
    regionId: `${regionRootId}:detail:${businessNode.id}`,
    regionRootId,
    regionBusinessId: businessNode.id,
    regionRootLabel: template.summary,
    regionLabel: detailLabel,
    regionDepth: 1,
    regionIsGroup: false,
    regionExpanded: false,
  };
  // 压力模式明细行本身就是后台记录。保持同一对象引用，编辑后重建
  // 投影时仍然使用修改后的明细值，而不会回退到生成时的旧数值。
  record.sourceNodes = [record];
  return record;
}

function createEmptyBudgetValues(): BudgetValues {
  return Object.fromEntries(
    BUDGET_VALUE_FIELDS.map((field) => [field, 0]),
  ) as BudgetValues;
}

async function createStressSummaryRecords(rows: readonly ViewRow[]) {
  const records = new Map<string, SubjectNode>();
  const accumulate = (
    organizationRecordId: string,
    subjectLabel: string,
    source: ViewRow,
  ) => {
    const key = stressSummaryRecordKey(organizationRecordId, subjectLabel);
    let summary = records.get(key);
    if (!summary) {
      const subjectIndex = STRESS_SUBJECTS.findIndex(
        (template) => template.summary === subjectLabel,
      );
      summary = {
        id: `stress-summary:${organizationRecordId}:${Math.max(
          subjectIndex,
          0,
        )}`,
        memberCode: createDemoMemberCode(
          'SUBJECT',
          `stress-summary-${Math.max(subjectIndex, 0)}`,
        ),
        name: subjectLabel,
        functionalAttribute: source.functionalAttribute,
        ...createEmptyBudgetValues(),
      };
      records.set(key, summary);
    }
    if (summary.functionalAttribute !== source.functionalAttribute)
      summary.functionalAttribute = '-';
    BUDGET_VALUE_FIELDS.forEach((field) => {
      summary[field] += source[field];
    });
  };

  const chunkSize = 5_000;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, rows.length);
    for (let index = start; index < end; index += 1) {
      const row = rows[index];
      accumulate(row.productId, row.regionRootLabel, row);
      if (row.productParentId)
        accumulate(row.productParentId, row.regionRootLabel, row);
    }
    if (end < rows.length) await yieldToBrowser();
  }
  return records;
}

function yieldToBrowser() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function')
      requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

let stressDatasetCache: StressBackendDataset | null = null;
let stressDatasetPromise: Promise<StressBackendDataset> | null = null;
let stressDatasetCacheEpoch = 0;

/**
 * 独立 Demo 在浏览器中确定性生成后台样例。每批主动让出主线程；生产环境
 * 应以 BudgetPageGateway 的 manifest/page/search/locate 接口替代。
 */
export async function getStressDatasetAsync(
  onProgress?: (loaded: number, total: number) => void,
) {
  if (stressDatasetCache) {
    onProgress?.(
      stressDatasetCache.detailRows.length,
      stressDatasetCache.detailRows.length,
    );
    return stressDatasetCache;
  }
  stressDatasetPromise ??= (async () => {
    const cacheEpoch = stressDatasetCacheEpoch;
    const rows = new Array<ViewRow>(STRESS_ROW_COUNT);
    const chunkSize = 5_000;
    for (let start = 0; start < rows.length; start += chunkSize) {
      const end = Math.min(start + chunkSize, rows.length);
      for (let index = start; index < end; index += 1)
        rows[index] = createStressRecord(index);
      onProgress?.(end, rows.length);
      if (end < rows.length) await yieldToBrowser();
    }
    const dataset = {
      detailRows: rows,
      summaryRecords: await createStressSummaryRecords(rows),
    } satisfies StressBackendDataset;
    if (cacheEpoch === stressDatasetCacheEpoch) stressDatasetCache = dataset;
    return dataset;
  })();
  try {
    return await stressDatasetPromise;
  } finally {
    stressDatasetPromise = null;
  }
}

export function releaseStressDataset() {
  stressDatasetCacheEpoch += 1;
  stressDatasetCache = null;
}

function abortError() {
  return new DOMException('请求已取消', 'AbortError');
}

function delay(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(abortError());
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * 本地可运行的“服务端投影分页”替身。控制器只通过 fetchPage 取得当前
 * 视口数据，因此接入真实接口时可保留相同的加载、取消和错误处理流程。
 */
export function createLocalStressProjectionPageSource(): StressProjectionPageSource {
  let rows: readonly ViewRow[] = [];
  let projectionVersion = 0;
  let sessionController = new AbortController();
  const pending = new Map<number, Promise<StressProjectionPage>>();

  const replaceProjection = (nextRows: readonly ViewRow[]) => {
    sessionController.abort();
    sessionController = new AbortController();
    pending.clear();
    rows = nextRows;
    projectionVersion += 1;
    return projectionVersion;
  };

  const fetchPage = (pageIndex: number, signal?: AbortSignal) => {
    const existing = pending.get(pageIndex);
    if (existing) return existing;
    const version = projectionVersion;
    const snapshot = rows;
    const startRow = pageIndex * STRESS_PAGE_SIZE;
    const combinedController = new AbortController();
    const abort = () => combinedController.abort();
    const sessionSignal = sessionController.signal;
    sessionSignal.addEventListener('abort', abort, { once: true });
    signal?.addEventListener('abort', abort, { once: true });
    const request = delay(
      STRESS_PAGE_FETCH_DELAY_MS,
      combinedController.signal,
    ).then(() => ({
      pageIndex,
      startRow,
      rows: snapshot.slice(startRow, startRow + STRESS_PAGE_SIZE),
      totalRows: snapshot.length,
      projectionVersion: version,
    }));
    pending.set(pageIndex, request);
    const cleanup = () => {
      if (pending.get(pageIndex) === request) pending.delete(pageIndex);
      sessionSignal.removeEventListener('abort', abort);
      signal?.removeEventListener('abort', abort);
    };
    void request.then(cleanup, cleanup);
    return request;
  };

  return {
    replaceProjection,
    fetchPage,
    dispose() {
      sessionController.abort();
      pending.clear();
      rows = [];
    },
  };
}
