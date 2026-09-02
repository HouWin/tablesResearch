import { columnName } from './model';

type ClipboardRange = {
  row: number;
  col: number;
  rowCount: number;
  colCount: number;
};

type ClipboardCallbackPayload = {
  sheetName: string;
  range: (ClipboardRange & { a1: string }) | null;
  text: string;
  data: string[][];
  isCutting?: boolean;
};

type ClipboardCallbacks = {
  onCopied?: (payload: ClipboardCallbackPayload) => void;
  onPasting?: (payload: ClipboardCallbackPayload) => boolean | void;
};

export function clipboardTextToMatrix(text: string) {
  const rows = text.replace(/\r\n?/g, '\n').split('\n');
  if (rows.at(-1) === '') rows.pop();
  return rows.map((row) => row.split('\t'));
}

export function describeClipboardRange(range?: ClipboardRange) {
  if (!range || range.row < 0 || range.col < 0) return null;
  const start = `${columnName(range.col)}${range.row + 1}`;
  const end = `${columnName(range.col + range.colCount - 1)}${
    range.row + range.rowCount
  }`;
  return {
    ...range,
    a1: start === end ? start : `${start}:${end}`,
  };
}

export const CLIPBOARD_CALLBACKS: ClipboardCallbacks = {
  onCopied: (payload) => {
    if (process.env.NODE_ENV === 'production') return;
    console.group(`[SpreadJS] 复制回调 · ${payload.range?.a1 ?? '未知区域'}`);
    console.table(payload.data);
    console.info('复制的数据：', payload);
    console.groupEnd();
  },
  onPasting: (payload) => {
    if (process.env.NODE_ENV === 'production') return true;
    console.group(`[SpreadJS] 粘贴前回调 · ${payload.range?.a1 ?? '未知区域'}`);
    console.table(payload.data);
    console.info('即将粘贴的数据：', payload);
    console.groupEnd();
    return true;
  },
};
