/**
 * Jspreadsheet Data Grid · 预算费用表
 * 能力：批注 / 下钻上钻 / 回撤 / 批量复制 / 多行列折叠 / 自定义右键 /
 * 下拉·日期·数值 / 单元格历史 / 数据追踪 / 快速搜索 / 显隐列 / 附件 /
 * 大数据虚拟滚动 / 列宽拖动 / 自适应列宽 / 导出 / 选区统计
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spreadsheet, Worksheet, jspreadsheet } from '@jspreadsheet/react';
import comments from '@jspreadsheet/comments';
import search from '@jspreadsheet/search';
import bar from '@jspreadsheet/bar';
import barFormulas from '@jspreadsheet/bar/dist/formulas.json';
import lemonade from 'lemonadejs';
import { PageContainer } from '@ant-design/pro-components';
import { Button, Select, Space, Spin, message } from 'antd';
import 'jsuites/dist/jsuites.css';
import 'jspreadsheet/dist/jspreadsheet.css';
import '@jsuites/css/dist/style.css';
import '@jspreadsheet/comments/dist/style.css';
import '@jspreadsheet/bar/dist/style.css';
import 'material-icons/iconfont/material-icons.css';
import { zhCN } from '../dictionary';
import '../index.less';
import {
  createBusinessProjectionRows,
  createInitialRegionExpansion,
  INITIAL_PRODUCT_EXPANDED,
  type ExtensionExpansionState,
} from '../../SpreadJSDemo/spreadsheet/model';
import {
  BUDGET_SCALE_OPTIONS,
  COL_ATTR,
  COL_COUNT,
  COL_MONTH_START,
  applySheetToWorksheet,
  bindHeaderStability,
  buildBudgetEditPayload,
  buildLargeSheetFromData,
  buildRowDimension,
  buildSheetFromProjection,
  buildLargeDataAsync,
  calcSelectionStats,
  canonicalProductId,
  cellName,
  dirtyCellKey,
  downloadTextFile,
  expandViewRowsForScale,
  formatStatNumber,
  getWorksheetList,
  isBudgetValueRowEditable,
  paintVisibleFoldToggles,
  parseA1,
  resolveViewRow,
  scaleTargetRows,
  sheetDataToCsv,
  snapshotRowData,
  stableCellKey,
  toEditValue,
  type BudgetDirtyChange,
  type BudgetScale,
  type BuiltSheet,
  type FoldMeta,
  type SelectionStats,
  type TrackItem,
} from './budget-core';

(window as any).lemonade = lemonade;

jspreadsheet.setLicense('evaluation');
jspreadsheet.setDictionary(zhCN);

comments({
  user_id: 1,
  name: '演示用户',
  permission: 2,
});

bar({ suggestions: barFormulas as any });

const extensions = { bar, comments, search };

const historyBridge = {
  onChange: (_ws: any, _x: any, _y: any, _oldValue: any, _newValue: any) => {},
  onSelect: (_ws: any, _px: any, _py: any, _ux: any, _uy: any) => {},
};

const cellHistoryPlugin = {
  onevent(event: string, worksheet?: any, a?: any, b?: any, c?: any, d?: any, e?: any) {
    if (event === 'onchange') {
      historyBridge.onChange(worksheet, b, c, e, d);
      return;
    }
    if (event === 'onafterchanges' && Array.isArray(a)) {
      a.forEach((rec: any) => {
        historyBridge.onChange(
          worksheet,
          rec.x ?? rec.col,
          rec.y ?? rec.row,
          rec.oldValue ?? rec.oldvalue,
          rec.value ?? rec.newValue ?? rec.v,
        );
      });
      return;
    }
    if (event === 'onselection') {
      historyBridge.onSelect(worksheet, a, b, c, d);
    }
  },
};

const recentModKeys = new Set<string>();
function takeModificationKey(col: number, row: number, from: string, to: string) {
  const key = `${col}:${row}:${from}=>${to}`;
  if (recentModKeys.has(key)) return null;
  recentModKeys.add(key);
  window.setTimeout(() => recentModKeys.delete(key), 0);
  return key;
}

function logBudgetEdit(payload: unknown) {
  // eslint-disable-next-line no-console
  console.log('[budget-edit]', payload);
}

export default function JspreadsheetBudgetPage() {
  const spreadsheet = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachTarget = useRef<{ x: number; y: number } | null>(null);
  const [mountId, setMountId] = useState(0);
  const [dirtyCount, setDirtyCount] = useState(0);
  const dirtyRef = useRef<Map<string, BudgetDirtyChange>>(new Map());
  const suppressChangeRef = useRef(true);
  const clearInitGateRef = useRef(true);
  const [scale, setScale] = useState<BudgetScale>('demo');
  const [tracks, setTracks] = useState<TrackItem[]>([]);
  const [historyCell, setHistoryCell] = useState('A1');
  const [sheetBusy, setSheetBusy] = useState(false);
  const sheetBusyRef = useRef(false);
  sheetBusyRef.current = sheetBusy;
  const [loadInfo, setLoadInfo] = useState('');
  const [selectionStats, setSelectionStats] = useState<SelectionStats | null>(
    null,
  );

  const resetPendingChanges = useCallback(() => {
    dirtyRef.current.clear();
    setDirtyCount(0);
  }, []);

  /** 程序化灌数 / remount 前同步屏蔽 onchange，避免初始化噪音进追踪/待保存 */
  const beginProgrammaticWrite = useCallback(
    (clearPending = false) => {
      suppressChangeRef.current = true;
      clearInitGateRef.current = true;
      if (clearPending) resetPendingChanges();
    },
    [resetPendingChanges],
  );
  const [productExpanded, setProductExpanded] = useState(
    () => new Set<string>(INITIAL_PRODUCT_EXPANDED),
  );
  const [regionExpanded, setRegionExpanded] = useState<ExtensionExpansionState>(
    () => createInitialRegionExpansion(),
  );

  const isLarge = scale !== 'demo';
  const isHuge = scale === '100000';
  const loadTokenRef = useRef(0);

  const [sheet, setSheet] = useState<BuiltSheet>(() => {
    const base = createBusinessProjectionRows(
      [],
      new Set(INITIAL_PRODUCT_EXPANDED),
      createInitialRegionExpansion(),
    );
    return buildSheetFromProjection(base, { large: false });
  });

  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;

  // 大档 Worksheet 的 React props 只在 remount 时更新，折叠走原地 setData，避免 1 万行 props 双通道灌数抖动
  const [propSheet, setPropSheet] = useState(sheet);
  useEffect(() => {
    setPropSheet(sheet);
  }, [mountId]);

  // 仅跟随折叠状态重建；scale 切换由下方 load effect 负责，避免双通道抢建导致闪抖
  useEffect(() => {
    if (scale === '100000') return;
    const base = createBusinessProjectionRows(
      [],
      productExpanded,
      regionExpanded,
    );
    if (scale === '10000') {
      const viewRows = expandViewRowsForScale(base, 10000);
      setSheet(buildSheetFromProjection(viewRows, { large: true }));
    } else {
      setSheet(buildSheetFromProjection(base, { large: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 故意不监听 scale
  }, [productExpanded, regionExpanded]);

  const toggleFold = useCallback((meta: FoldMeta) => {
    if (!meta.canFold) return;
    const productId = canonicalProductId(meta.productId);
    if (meta.col === 0) {
      setProductExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(productId)) next.delete(productId);
        else next.add(productId);
        return next;
      });
      return;
    }
    if (!meta.regionRootId) return;
    setRegionExpanded((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(productId) ?? []);
      if (current.has(meta.regionRootId!)) current.delete(meta.regionRootId!);
      else current.add(meta.regionRootId!);
      next.set(productId, current);
      return next;
    });
  }, []);

  // 切换数据量：大档分块异步生成，避免同步 10 万物化卡死/崩溃
  useEffect(() => {
    const token = ++loadTokenRef.current;
    beginProgrammaticWrite(true);
    const base = createBusinessProjectionRows(
      [],
      productExpanded,
      regionExpanded,
    );
    const target = scaleTargetRows(scale);

    if (!target) {
      setSheetBusy(false);
      setLoadInfo('');
      setSheet(buildSheetFromProjection(base, { large: false }));
      setMountId((n) => n + 1);
      return;
    }

    let cancelled = false;
    setSheetBusy(true);
    setLoadInfo(`正在生成 ${target.toLocaleString()} 行… 0%`);

    (async () => {
      try {
        // 1 万内可物化 viewRows；10 万只持模板 + data
        if (target <= 12000) {
          const viewRows = expandViewRowsForScale(base, target);
          if (cancelled || token !== loadTokenRef.current) return;
          beginProgrammaticWrite(true);
          setSheet(buildSheetFromProjection(viewRows, { large: true }));
        } else {
          const data = await buildLargeDataAsync(base, target, (done, total) => {
            if (cancelled || token !== loadTokenRef.current) return;
            const pct = Math.min(99, Math.round((done / total) * 100));
            setLoadInfo(
              `正在生成 ${total.toLocaleString()} 行… ${pct}%（勿关页）`,
            );
          });
          if (cancelled || token !== loadTokenRef.current) return;
          beginProgrammaticWrite(true);
          setSheet(buildLargeSheetFromData(base, data));
        }
        if (cancelled || token !== loadTokenRef.current) return;
        beginProgrammaticWrite(true);
        setMountId((n) => n + 1);
        setLoadInfo('');
        setSheetBusy(false);
        message.success(`已加载 ${target.toLocaleString()} 行（纵向虚拟滚动）`);
      } catch (err) {
        if (cancelled || token !== loadTokenRef.current) return;
        console.error(err);
        setSheetBusy(false);
        setLoadInfo('');
        message.error('大数据生成失败，已回退演示数据');
        setScale('demo');
      }
    })();

    return () => {
      cancelled = true;
    };
    // 仅 scale 切换触发大档重建；折叠状态取当前闭包即可
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  const pushTrack = useCallback(
    (a1: string, from: unknown, to: unknown, stableKey?: string) => {
      const item: TrackItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        cell: a1,
        stableKey: stableKey || a1,
        from: from == null || from === '' ? '' : String(from),
        to: to == null || to === '' ? '' : String(to),
        time: new Date().toLocaleTimeString(),
      };
      setTracks((prev) => [item, ...prev].slice(0, 200));
    },
    [],
  );

  const drillSelected = useCallback(
    (expand: boolean) => {
      if (!sheetRef.current.foldMetas.some((m) => m.canFold)) {
        message.info('当前数据没有可折叠行组');
        return;
      }
      const ws = getWorksheetList(spreadsheet)[0];
      const selected = ws?.getSelected?.()?.[0];
      const row =
        typeof selected?.[1] === 'number'
          ? selected[1]
          : typeof selected?.y === 'number'
            ? selected.y
            : null;
      if (row == null) {
        message.warning('请先选中一行');
        return;
      }
      const metas = sheetRef.current.foldMetas.filter(
        (m) => m.row === row && m.canFold,
      );
      if (!metas.length) {
        message.info(expand ? '当前行无可下钻分组' : '当前行无可上钻折叠');
        return;
      }
      metas.forEach((meta) => {
        const shouldExpand = expand && !meta.expanded;
        const shouldCollapse = !expand && meta.expanded;
        if (shouldExpand || shouldCollapse) toggleFold(meta);
      });
      message.success(expand ? '已下钻展开' : '已上钻折叠');
    },
    [toggleFold],
  );

  const expandAllFolds = useCallback(() => {
    if (!sheetRef.current.foldMetas.some((m) => m.canFold)) {
      message.info('当前数据没有可折叠行组');
      return;
    }
    const products = new Set<string>();
    const regions = new Map<string, Set<string>>();
    sheetRef.current.foldMetas.forEach((m) => {
      if (!m.canFold) return;
      if (m.col === 0) products.add(m.productId);
      if (m.col === 1 && m.regionRootId) {
        const set = regions.get(m.productId) ?? new Set<string>();
        set.add(m.regionRootId);
        regions.set(m.productId, set);
      }
    });
    setProductExpanded(products);
    setRegionExpanded(regions);
    message.success('已全部展开');
  }, []);

  const collapseAllFolds = useCallback(() => {
    if (!sheetRef.current.foldMetas.some((m) => m.canFold)) {
      message.info('当前数据没有可折叠行组');
      return;
    }
    setProductExpanded(new Set());
    setRegionExpanded(new Map());
    message.success('已全部折叠');
  }, []);

  const handleCellChange = useCallback(
    (
      _worksheet: any,
      _cell: any,
      x: any,
      y: any,
      newValue: any,
      oldValue: any,
    ) => {
      // 灌数 / 换档 / loading 期间的 onchange 不是用户编辑
      if (suppressChangeRef.current || sheetBusyRef.current) return;
      const col = Number(x);
      const row = Number(y);
      if (!Number.isFinite(col) || !Number.isFinite(row)) return;
      if (col < COL_ATTR) return;
      const viewRow = resolveViewRow(sheetRef.current, row);
      if (!viewRow) return;
      if (!isBudgetValueRowEditable(viewRow)) return;
      const next = toEditValue(newValue);
      const prevVal = toEditValue(oldValue);
      if (
        Object.is(prevVal, next) ||
        String(prevVal ?? '') === String(next ?? '')
      ) {
        return;
      }
      if (
        !takeModificationKey(
          col,
          row,
          String(prevVal ?? ''),
          String(next ?? ''),
        )
      ) {
        return;
      }
      const payload = buildBudgetEditPayload(viewRow, col, oldValue, newValue);
      if (!payload) return;

      logBudgetEdit(payload);
      pushTrack(
        cellName(col, row),
        payload.oldValue,
        payload.newValue,
        stableCellKey(viewRow, col) ?? undefined,
      );

      const key = dirtyCellKey(payload.row.key, payload.col.key);
      const prev = dirtyRef.current.get(key);
      const original = prev?.oldValue ?? payload.oldValue;
      if (
        Object.is(original, payload.newValue) ||
        String(original ?? '') === String(payload.newValue ?? '')
      ) {
        dirtyRef.current.delete(key);
      } else {
        dirtyRef.current.set(key, {
          type: payload.type,
          row: payload.row,
          col: payload.col,
          field: payload.field,
          oldValue: original,
          newValue: payload.newValue,
          rowData: {
            ...(prev?.rowData ?? payload.rowData),
            [payload.field]: payload.newValue,
          },
          rowIndex: row,
        });
      }
      setDirtyCount(dirtyRef.current.size);
    },
    [pushTrack],
  );

  historyBridge.onChange = (worksheet, x, y, oldValue, newValue) => {
    handleCellChange(worksheet, null, x, y, newValue, oldValue);
  };

  const handleSave = useCallback(() => {
    if (dirtyRef.current.size === 0) {
      message.info('没有待保存的修改');
      return;
    }

    const changes: BudgetDirtyChange[] = [...dirtyRef.current.values()].map(
      (entry) => {
        const viewRow =
          typeof entry.rowIndex === 'number'
            ? resolveViewRow(sheetRef.current, entry.rowIndex)
            : sheetRef.current.viewRows.find(
                (r) => buildRowDimension(r).key === entry.row.key,
              ) || null;
        const rowData = viewRow
          ? snapshotRowData(viewRow, { [entry.field]: entry.newValue })
          : { ...entry.rowData };
        dirtyRef.current.forEach((other) => {
          if (other.row.key === entry.row.key) {
            rowData[other.field] = other.newValue;
          }
        });
        return { ...entry, rowData };
      },
    );

    // eslint-disable-next-line no-console
    console.log('[budget-save]', {
      count: changes.length,
      changes,
    });

    message.success(`已收集 ${changes.length} 处修改，详见控制台 [budget-save]`);
    resetPendingChanges();
  }, [resetPendingChanges]);

  const refreshSelectionStats = useCallback(
    (px: any, py: any, ux: any, uy: any) => {
      const c0 = Number(px);
      const r0 = Number(py);
      const c1 = Number(ux);
      const r1 = Number(uy);
      if (
        ![c0, r0, c1, r1].every((n) => Number.isFinite(n)) ||
        c0 < 0 ||
        r0 < 0
      ) {
        setSelectionStats(null);
        return;
      }
      setSelectionStats(
        calcSelectionStats(sheetRef.current.data, c0, r0, c1, r1),
      );
    },
    [],
  );

  const gotoA1 = useCallback((a1: string) => {
    const cell = (a1 || '').split(':')[0];
    const parsed = parseA1(cell);
    if (!parsed) {
      message.warning('无法解析单元格地址');
      return;
    }
    const ws = getWorksheetList(spreadsheet)[0];
    if (!ws) return;
    try {
      ws.updateSelectionFromCoords?.(
        parsed.col,
        parsed.row,
        parsed.col,
        parsed.row,
      );
    } catch {
      // ignore
    }
    try {
      ws.goto?.(cell);
    } catch {
      // ignore
    }
    setHistoryCell(cell);
    refreshSelectionStats(parsed.col, parsed.row, parsed.col, parsed.row);
  }, [refreshSelectionStats]);

  const exportCsv = useCallback(() => {
    const rows = sheetRef.current.data;
    if (!rows.length) {
      message.warning('没有可导出的数据');
      return;
    }
    if (rows.length > 20000) {
      message.loading({
        content: '正在生成 CSV…',
        key: 'budget-export',
        duration: 0,
      });
    }
    window.setTimeout(() => {
      try {
        const csv = sheetDataToCsv(rows);
        downloadTextFile(
          `budget-${scale}-${rows.length}.csv`,
          `\uFEFF${csv}`,
          'text/csv;charset=utf-8',
        );
        message.success({
          content: `已导出 ${rows.length.toLocaleString()} 行 CSV`,
          key: 'budget-export',
        });
      } catch (err) {
        console.error(err);
        message.error({ content: '导出失败', key: 'budget-export' });
      }
    }, 0);
  }, [scale]);

  historyBridge.onSelect = (_worksheet, px, py, ux, uy) => {
    const start = cellName(Number(px), Number(py));
    const end = cellName(Number(ux), Number(uy));
    if (!start) return;
    setHistoryCell(start === end ? start : `${start}:${end}`);
    refreshSelectionStats(px, py, ux, uy);
  };

  const onbeforecomments = useCallback((_ws: any, cells: Record<string, any>) => {
    const next: Record<string, any> = {};
    Object.keys(cells || {}).forEach((key) => {
      const val = cells[key];
      if (val == null || val === '') {
        next[key] = '';
        return;
      }
      if (typeof val === 'string' || Array.isArray(val)) {
        next[key] = val;
        return;
      }
      if (typeof val === 'object' && (val.comments != null || val.text != null)) {
        next[key] = [val];
        return;
      }
      next[key] = '';
    });
    return next;
  }, []);

  const handleAttachFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const target = attachTarget.current;
      const ws = getWorksheetList(spreadsheet)[0];
      e.target.value = '';
      if (!file || !target || !ws) return;

      const reader = new FileReader();
      reader.onload = () => {
        const url = String(reader.result || '');
        const a1 = cellName(target.x, target.y);
        const viewRow = resolveViewRow(sheetRef.current, target.y);
        const stable = viewRow ? stableCellKey(viewRow, target.x) : a1;
        try {
          ws.setMeta?.(a1, {
            attachmentName: file.name,
            attachmentType: file.type,
            attachmentSize: file.size,
            attachmentDataUrl: url,
            stableKey: stable,
          });
        } catch {
          // ignore
        }
        pushTrack(a1, '', `[附件] ${file.name}`, stable || a1);
        message.success(`已添加附件：${file.name}`);
      };
      reader.readAsDataURL(file);
    },
    [pushTrack],
  );

  const contextMenu = useCallback(
    (
      instance: any,
      x: number,
      y: number,
      _e: MouseEvent,
      items: any[],
      section: string,
    ) => {
      if (section !== 'cell' && section !== 'header') return items;

      items.push({ type: 'line' });
      items.push({
        title: '查看单元格历史',
        icon: 'history',
        onclick: () => {
          if (typeof x === 'number' && typeof y === 'number') {
            setHistoryCell(cellName(x, y));
          }
        },
      });
      items.push({
        title: '取消批注',
        icon: 'speaker_notes_off',
        onclick: () => {
          const clearNames = new Set<string>();
          const selected = instance.getSelected?.() || [];
          if (Array.isArray(selected) && selected.length) {
            selected.forEach((sel: any) => {
              const x0 = Number(sel?.[0] ?? sel?.x);
              const y0 = Number(sel?.[1] ?? sel?.y);
              const x1 = Number(sel?.[2] ?? sel?.[0] ?? sel?.x);
              const y1 = Number(sel?.[3] ?? sel?.[1] ?? sel?.y);
              if (
                ![x0, y0, x1, y1].every((n) => Number.isFinite(n)) ||
                x0 < 0 ||
                y0 < 0
              ) {
                return;
              }
              const c0 = Math.min(x0, x1);
              const c1 = Math.max(x0, x1);
              const r0 = Math.min(y0, y1);
              const r1 = Math.max(y0, y1);
              for (let r = r0; r <= r1; r += 1) {
                for (let c = c0; c <= c1; c += 1) {
                  clearNames.add(cellName(c, r));
                }
              }
            });
          } else if (typeof x === 'number' && typeof y === 'number') {
            clearNames.add(cellName(x, y));
          }
          if (!clearNames.size) {
            message.warning('请先选中单元格');
            return;
          }
          const payload: Record<string, string> = {};
          clearNames.forEach((name) => {
            payload[name] = '';
          });
          try {
            instance.setComments?.(payload);
          } catch {
            clearNames.forEach((name) => {
              try {
                instance.setComments?.(name, '');
              } catch {
                // ignore
              }
            });
          }
          // 同步内存里的 comments，避免 remount 又带回来
          const nextComments = {
            ...(sheetRef.current.comments || {}),
          };
          clearNames.forEach((name) => {
            delete nextComments[name];
          });
          sheetRef.current = {
            ...sheetRef.current,
            comments: nextComments,
          };
          message.success(
            clearNames.size === 1
              ? `已取消 ${[...clearNames][0]} 的批注`
              : `已取消 ${clearNames.size} 个单元格的批注`,
          );
        },
      });
      items.push({
        title: '添加单元格附件',
        icon: 'attach_file',
        onclick: () => {
          if (typeof x !== 'number' || typeof y !== 'number') return;
          attachTarget.current = { x, y };
          fileInputRef.current?.click();
        },
      });
      items.push({
        title: '批量复制选区',
        icon: 'content_copy',
        onclick: () => {
          instance.copy?.();
          message.success('已复制选区到剪贴板');
        },
      });
      items.push({
        title: '隐藏当前列',
        icon: 'visibility_off',
        onclick: () => {
          if (typeof x === 'number') instance.hideColumn(x);
        },
      });
      items.push({
        title: '显示全部隐藏列',
        icon: 'visibility',
        onclick: () => {
          instance.showColumn?.(
            Array.from({ length: COL_COUNT }, (_, i) => i),
          );
        },
      });
      items.push({
        title: '下钻：展开行组',
        icon: 'unfold_more',
        onclick: () => drillSelected(true),
      });
      items.push({
        title: '上钻：折叠行组',
        icon: 'unfold_less',
        onclick: () => drillSelected(false),
      });
      items.push({
        title: '展开月份列组',
        icon: 'view_column',
        onclick: () => instance.openColumnGroup?.(COL_MONTH_START),
      });
      items.push({
        title: '折叠月份列组',
        icon: 'view_week',
        onclick: () => instance.closeColumnGroup?.(COL_MONTH_START),
      });
      items.push({ type: 'line' });
      items.push({
        title: '导出当前表 CSV',
        icon: 'download',
        onclick: () => exportCsv(),
      });

      return items;
    },
    [drillSelected, exportCsv],
  );

  const toolbar = useCallback(
    (defaultToolbar: any) => {
      const ws = () => getWorksheetList(spreadsheet)[0];

      const extraItems = [
        { type: 'divisor' },
        {
          content: 'unfold_more',
          tooltip: '下钻：展开选中行组',
          onclick: () => drillSelected(true),
        },
        {
          content: 'unfold_less',
          tooltip: '上钻：折叠选中行组',
          onclick: () => drillSelected(false),
        },
        {
          content: 'expand_all',
          tooltip: '全部展开组织/科目',
          onclick: () => expandAllFolds(),
        },
        {
          content: 'collapse_all',
          tooltip: '全部折叠组织/科目',
          onclick: () => collapseAllFolds(),
        },
        { type: 'divisor' },
        {
          content: 'content_copy',
          tooltip: '批量复制选区',
          onclick: () => {
            ws()?.copy?.();
            message.success('已复制选区');
          },
        },
        {
          content: 'search',
          tooltip: '快速搜索',
          onclick: () => {
            const sheetWs = ws();
            sheetWs?.showSearch?.();
            (search as any)?.(sheetWs);
          },
        },
        { type: 'divisor' },
        {
          content: 'view_column',
          tooltip: '展开月份列组',
          onclick: () => ws()?.openColumnGroup?.(COL_MONTH_START),
        },
        {
          content: 'view_week',
          tooltip: '折叠月份列组',
          onclick: () => ws()?.closeColumnGroup?.(COL_MONTH_START),
        },
        { type: 'divisor' },
        {
          content: 'visibility_off',
          tooltip: '隐藏选中列',
          onclick: () => {
            const sheetWs = ws();
            const selected = sheetWs?.getSelectedColumns?.() || [];
            if (!selected.length) {
              message.warning('请先选中列');
              return;
            }
            sheetWs.hideColumn(selected);
          },
        },
        {
          content: 'visibility',
          tooltip: '显示全部隐藏列',
          onclick: () => {
            ws()?.showColumn?.(
              Array.from({ length: COL_COUNT }, (_, i) => i),
            );
          },
        },
        {
          content: 'width_wide',
          tooltip: '自适应内容宽度',
          onclick: () => {
            ws()?.autoWidth?.();
            message.success('已按内容自适应列宽');
          },
        },
        {
          content: 'attach_file',
          tooltip: '为当前选区添加附件',
          onclick: () => {
            const sheetWs = ws();
            const sel = sheetWs?.getSelected?.()?.[0];
            const x = Number(sel?.[0] ?? sel?.x);
            const y = Number(sel?.[1] ?? sel?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
              message.warning('请先选中单元格');
              return;
            }
            attachTarget.current = { x, y };
            fileInputRef.current?.click();
          },
        },
        { type: 'divisor' },
        {
          content: 'download',
          tooltip: '导出 CSV',
          onclick: () => exportCsv(),
        },
      ];

      if (defaultToolbar && Array.isArray(defaultToolbar.items)) {
        defaultToolbar.items.push(...extraItems);
        return defaultToolbar;
      }
      if (Array.isArray(defaultToolbar)) {
        defaultToolbar.push(...extraItems);
        return defaultToolbar;
      }
      return { items: extraItems, responsive: true };
    },
    [collapseAllFolds, drillSelected, expandAllFolds, exportCsv],
  );

  useEffect(() => {
    return () => {
      spreadsheet.current = null;
    };
  }, [mountId]);

  useEffect(() => {
    clearInitGateRef.current = true;
  }, [mountId, scale]);

  // remount 后绑定点击 / 表头稳定；折叠不进 deps，避免拆监听造成闪抖
  useEffect(() => {
    let unbindClick: (() => void) | undefined;
    let unbindHeader: (() => void) | undefined;
    let readyTimer: number | undefined;
    beginProgrammaticWrite();

    const timer = window.setTimeout(() => {
      const list = getWorksheetList(spreadsheet);
      const ws = list[0];
      if (!ws) {
        setMountId((n) => (n === 0 ? 1 : n));
        return;
      }

      beginProgrammaticWrite();
      applySheetToWorksheet(ws, sheetRef.current);

      const table =
        ws.table ||
        ws.element?.querySelector?.('table') ||
        ws.content?.querySelector?.('table');
      if (!table) return;
      table.classList.add('jss-outline-table');

      const onClick = (ev: MouseEvent) => {
        const target = ev.target as HTMLElement | null;
        const toggle = target?.closest?.(
          '.jss-outline-toggle',
        ) as HTMLElement | null;
        if (!toggle || !table.contains(toggle)) return;
        ev.preventDefault();
        ev.stopPropagation();
        const row = Number(toggle.dataset.row);
        const col = Number(toggle.dataset.col);
        if (!Number.isFinite(row) || !Number.isFinite(col)) return;
        const meta = sheetRef.current.foldMetas.find(
          (m) => m.row === row && m.col === col && m.canFold,
        );
        if (meta) toggleFold(meta);
      };

      table.addEventListener('click', onClick);
      unbindClick = () => table.removeEventListener('click', onClick);

      unbindHeader = bindHeaderStability(ws, () => {
        paintVisibleFoldToggles(ws, sheetRef.current);
      });

      // 等虚拟滚动 / 插件初始化的尾随 onchange 结束后再记录编辑
      readyTimer = window.setTimeout(() => {
        if (clearInitGateRef.current) {
          resetPendingChanges();
          clearInitGateRef.current = false;
        }
        if (!sheetBusyRef.current) {
          suppressChangeRef.current = false;
        }
        paintVisibleFoldToggles(ws, sheetRef.current);
      }, 400);
    }, 80);

    return () => {
      suppressChangeRef.current = true;
      window.clearTimeout(timer);
      if (readyTimer) window.clearTimeout(readyTimer);
      unbindClick?.();
      unbindHeader?.();
    };
  }, [mountId, toggleFold, beginProgrammaticWrite, resetPendingChanges]);

  // 折叠等投影更新：原地灌数；初始化换档期间不要提前开闸（交给 mount effect）
  useEffect(() => {
    const ws = getWorksheetList(spreadsheet)[0];
    if (!ws) return;
    suppressChangeRef.current = true;
    applySheetToWorksheet(ws, sheet);
    const settle = window.setTimeout(() => {
      if (clearInitGateRef.current || sheetBusyRef.current) return;
      suppressChangeRef.current = false;
    }, 0);
    return () => window.clearTimeout(settle);
  }, [sheet]);

  const focusCell = historyCell.split(':')[0];
  const cellHistory = useMemo(
    () => tracks.filter((item) => item.cell === focusCell),
    [tracks, focusCell],
  );

  return (
    <PageContainer
      title="Jspreadsheet Data Grid · 预算费用表"
      subTitle={`投影对齐 SpreadJS · ${sheet.data.length.toLocaleString()} 行`}
      extra={
        <Space wrap>
          <Select
            size="small"
            style={{ width: 200 }}
            value={scale}
            options={BUDGET_SCALE_OPTIONS}
            onChange={(v) => {
              beginProgrammaticWrite(true);
              setScale(v as BudgetScale);
              setTracks([]);
              setSelectionStats(null);
            }}
            disabled={sheetBusy}
          />
          {sheetBusy ? (
            <span style={{ color: '#667085', fontSize: 13 }}>{loadInfo}</span>
          ) : (
            <span style={{ color: '#667085', fontSize: 13 }}>
              待保存 {dirtyCount} 处
            </span>
          )}
          <Button size="small" onClick={exportCsv} disabled={sheetBusy}>
            导出 CSV
          </Button>
          <Button
            type="primary"
            onClick={handleSave}
            disabled={dirtyCount === 0 || sheetBusy}
          >
            保存
          </Button>
        </Space>
      }
    >
      <div className="jss-page">
        <p className="jss-page__hint">
          费用表已集成：批注 / 下钻上钻 / 回撤 / 批量复制 / 多行列折叠 / 自定义右键 /
          下拉·日期·数值 / 单元格历史 / 数据追踪 / 快速搜索 / 显隐列 / 附件 /
          大数据虚拟滚动 / 列宽拖动 / 自适应列宽 / 导出 CSV / 选区统计。
          科目与汇总行只读；全年合计、月度、功能属性、业务日期可编辑。点击侧栏追踪记录可跳转单元格。
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.csv,.xlsx"
          style={{ display: 'none' }}
          onChange={handleAttachFile}
        />

        <div className="jss-page__body">
          <div className={`jss-page__sheet${sheetBusy ? ' is-loading' : ''}`}>
            {sheetBusy ? (
              <div className="jss-page__sheet-loading">
                <Spin size="large" tip={loadInfo || '加载中…'} />
              </div>
            ) : null}
            <Spreadsheet
              key={`jss-budget-datagrid-${mountId}-${scale}`}
              ref={spreadsheet}
              tabs={true}
              toolbar={toolbar}
              bar={true}
              extensions={extensions}
              plugins={{ cellHistory: cellHistoryPlugin }}
              tableOverflow={true}
              tableWidth="100%"
              tableHeight="640px"
              onevent={(event: string, ...rest: any[]) => {
                cellHistoryPlugin.onevent(event, ...rest);
              }}
              onbeforecomments={onbeforecomments}
              contextMenu={contextMenu}
              oneditionstart={(_ws: any, _cell: any, x: any, y: any) => {
                const col = Number(x);
                const row = Number(y);
                if (!Number.isFinite(col) || !Number.isFinite(row)) return false;
                if (col < COL_ATTR) return false;
                const viewRow = resolveViewRow(sheetRef.current, row);
                if (!viewRow) return false;
                if (!isBudgetValueRowEditable(viewRow)) return false;
                return true;
              }}
              onselection={(
                _ws: any,
                px: any,
                py: any,
                ux: any,
                uy: any,
              ) => {
                historyBridge.onSelect(_ws, px, py, ux, uy);
              }}
            >
              <Worksheet
                worksheetName="预算费用表"
                data={isLarge ? propSheet.data : sheet.data}
                columns={isLarge ? propSheet.columns : sheet.columns}
                nestedHeaders={
                  isLarge ? propSheet.nestedHeaders : sheet.nestedHeaders
                }
                mergeCells={isLarge ? {} : sheet.mergeCells}
                style={isLarge ? propSheet.style : sheet.style}
                comments={isLarge ? propSheet.comments : sheet.comments}
                minDimensions={[
                  sheet.columns.length,
                  isLarge ? propSheet.data.length : sheet.data.length,
                ]}
                columnResize={true}
                tableOverflow={true}
                tableWidth="100%"
                tableHeight="640px"
                filters={!isHuge}
                virtualizationX={false}
                virtualizationY={true}
              />
            </Spreadsheet>
          </div>

          <aside className="jss-page__side">
            <section className="jss-panel" style={{ flex: '0 0 auto' }}>
              <div className="jss-panel__title">选区统计</div>
              {!selectionStats ? (
                <div className="jss-panel__empty">框选数值单元格后显示求和 / 平均等。</div>
              ) : (
                <ul className="jss-panel__list jss-panel__stats">
                  <li className="jss-panel__item">
                    单元格 <strong>{selectionStats.cells.toLocaleString()}</strong>
                    {selectionStats.truncated ? '（已抽样）' : ''}
                  </li>
                  <li className="jss-panel__item">
                    数值格 <strong>{selectionStats.numeric.toLocaleString()}</strong>
                  </li>
                  <li className="jss-panel__item">
                    求和 <strong>{formatStatNumber(selectionStats.sum)}</strong>
                  </li>
                  <li className="jss-panel__item">
                    平均 <strong>{formatStatNumber(selectionStats.average)}</strong>
                  </li>
                  <li className="jss-panel__item">
                    最小 <strong>{formatStatNumber(selectionStats.min)}</strong>
                  </li>
                  <li className="jss-panel__item">
                    最大 <strong>{formatStatNumber(selectionStats.max)}</strong>
                  </li>
                </ul>
              )}
            </section>

            <section className="jss-panel" style={{ flex: 1.2 }}>
              <div className="jss-panel__title">数据追踪（最近变更）</div>
              {tracks.length === 0 ? (
                <div className="jss-panel__empty">
                  编辑任意单元格后，变更会记录在这里。点击可跳转。
                </div>
              ) : (
                <ul className="jss-panel__list">
                  {tracks.slice(0, 40).map((item) => (
                    <li
                      key={item.id}
                      className="jss-panel__item jss-panel__item--clickable"
                      onClick={() => gotoA1(item.cell)}
                    >
                      <div>
                        <strong>{item.cell}</strong>
                        <span className="jss-panel__meta"> · {item.time}</span>
                      </div>
                      <div>
                        {item.from || '∅'} → {item.to || '∅'}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="jss-panel" style={{ flex: 1 }}>
              <div className="jss-panel__title">
                单元格历史 · {focusCell || historyCell}
              </div>
              {cellHistory.length === 0 ? (
                <div className="jss-panel__empty">
                  编辑当前单元格并确认后，这里会列出该格的变更历史。也可右键「查看单元格历史」。
                </div>
              ) : (
                <ul className="jss-panel__list">
                  {cellHistory.map((item) => (
                    <li key={item.id} className="jss-panel__item">
                      <div className="jss-panel__meta">{item.time}</div>
                      <div>
                        {item.from || '∅'} → {item.to || '∅'}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      </div>
    </PageContainer>
  );
}
