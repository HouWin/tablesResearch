import type { BusinessCellChangePayload } from '../../SpreadJSDemo/spreadsheet/business-cell-change';
import type { BusinessCellDimension } from '../../SpreadJSDemo/spreadsheet/business-cell-coordinate';
import type {
  BusinessRowDimension,
  ViewRow,
} from '../../SpreadJSDemo/spreadsheet/model';

export type Expansion = { all: boolean; ids: string[] };
export type BudgetQuery = {
  mode: 'regular' | 'stress';
  organizations: Expansion;
  subjects: Expansion;
  drillPath: string[];
};
export type BudgetRow = ViewRow & {
  index: number;
  blockStart: number;
  formulas: Record<string, string>;
};
export type Manifest = {
  id: string;
  totalRows: number;
  detailCount: number;
  summaryCount: number;
  pageSize: number;
  organizationGroups: number;
  organizationExpanded: number;
  subjectGroups: number;
  subjectExpanded: number;
  breadcrumbs: { id: string; name: string }[];
};
export type Page = { projectionId: string; offset: number; rows: BudgetRow[] };
export type CellPosition = { row: number; col: number };
export type CellRange = { anchor: CellPosition; focus: CellPosition };
export type SearchMatch = {
  recordId: string;
  organizationId: string;
  subjectKey: string;
  ancestors: string[];
  column: number;
  label: string;
  rowDimension: BusinessRowDimension;
};
export type SearchResult = {
  total: number;
  index: number;
  match: SearchMatch | null;
};
export type CellWrite = {
  recordId: string;
  col: number;
  input: string | number;
  expected?: string | number;
};
export type CellPatch = {
  recordId: string;
  col: number;
  before: string | number;
  after: string | number;
  beforeFormula: string;
  afterFormula: string;
  payload: BusinessCellChangePayload;
};
export type Transaction = {
  id: string;
  source: string;
  createdAt: number;
  patches: CellPatch[];
};
export type Statistics = {
  cells: number;
  numeric: number;
  sum: number;
  average: number;
  min: number;
  max: number;
  ignored: number;
};
/** Display samples only; the business rows and edit callback contract stay unchanged. */
export type ColumnSizeSample = {
  col: number;
  text: string;
  bold: boolean;
  indent: number;
  formula: boolean;
};
export type ColumnSizePage = {
  revision: number;
  samples: ColumnSizeSample[];
  nextOffset: number | null;
};
export type BudgetGateway = {
  project: (query: BudgetQuery, signal?: AbortSignal) => Promise<Manifest>;
  page: (id: string, offset: number, signal?: AbortSignal) => Promise<Page>;
  columnSizes: (
    id: string,
    columns: number[],
    offset: number,
    signal?: AbortSignal,
  ) => Promise<ColumnSizePage>;
  search: (
    mode: BudgetQuery['mode'],
    query: string,
    index: number,
    signal?: AbortSignal,
  ) => Promise<SearchResult>;
  locate: (
    mode: BudgetQuery['mode'],
    dimension: BusinessCellDimension,
    signal?: AbortSignal,
  ) => Promise<SearchMatch | null>;
  position: (
    id: string,
    recordId: string,
    signal?: AbortSignal,
  ) => Promise<number>;
  write: (
    id: string,
    writes: CellWrite[],
    source: string,
  ) => Promise<Transaction>;
  replay: (
    mode: BudgetQuery['mode'],
    transaction: Transaction,
    direction: 'undo' | 'redo',
  ) => Promise<Transaction>;
  statistics: (
    id: string,
    range: CellRange,
    columns: number[],
    signal?: AbortSignal,
  ) => Promise<Statistics>;
  range: (
    id: string,
    range: CellRange,
    columns: number[],
    offset: number,
    signal?: AbortSignal,
  ) => Promise<{ rows: BudgetRow[]; nextOffset: number | null }>;
};

export function isExpanded(state: Expansion, id: string) {
  return state.all !== state.ids.includes(id);
}
export function toggleExpanded(state: Expansion, id: string): Expansion {
  return {
    ...state,
    ids: state.ids.includes(id)
      ? state.ids.filter((item) => item !== id)
      : [...state.ids, id],
  };
}
export function bounds(range: CellRange) {
  return {
    top: Math.min(range.anchor.row, range.focus.row),
    bottom: Math.max(range.anchor.row, range.focus.row),
    left: Math.min(range.anchor.col, range.focus.col),
    right: Math.max(range.anchor.col, range.focus.col),
  };
}
