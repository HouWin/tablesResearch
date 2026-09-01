import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, } from 'react';
import { createUniver, LocaleType, mergeLocales, } from '@univerjs/presets';
import { UniverSheetsAdvancedPreset } from '@univerjs/preset-sheets-advanced';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import { UniverSheetsThreadCommentPreset } from '@univerjs/preset-sheets-thread-comment';
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace';
import { createColumnOutlines, createRowOutlines, getColumnOutlines, getRowOutlines, setOutlineCollapsed, } from './outline';
import { ensureSheetCapacity, flattenColumns, renderColumnWidths, renderData, renderDataAsync, renderHeader, renderMerges, renderMergesAsync, renderRowHeights } from './renderer';
import { buildHeaderLayout } from './layout';
import { flattenGroupedData } from './groupData';
import { flattenTreeData } from './tree';
import { ASYNC_RENDER_ROW_THRESHOLD, LARGE_TREE_FLAT_ROW_THRESHOLD } from './treeDataGenerator';
import { setupTreeCellCollapse } from './treeCollapse';
import type { ETableTreeCollapseApi } from './treeCollapse';
import {
  setupTreeViewport,
  TREE_VIEWPORT_THRESHOLD,
  TREE_VIEWPORT_WINDOW_SIZE,
} from './treeViewport';
import type { TreeViewportStats } from './treeViewport';
import type { ETableFlattenResult } from './types';
import { setupReadonlyCells } from './readonly';
import { applyColumnTypes } from './columnTypes';
import {
  createVirtualDataLoader,
  VIRTUAL_LAZY_THRESHOLD,
} from './virtualRender';
import type { VirtualDataLoader } from './virtualRender';
import { setupCellHistory } from './cellHistory';
import type { ETableCellHistoryApi } from './cellHistory';
import {
  constrainFindDialogToContainer,
  openQuickSearch,
  searchAndSelect,
} from './search';
import {
  customizeContextMenu,
  defaultContextMenuItems,
  disableContextMenu,
  NATIVE_CONTEXT_MENU_HIDE_CONFIG,
  setupCommentContextMenuGuard,
  setupContextMenuBlock,
} from './contextMenu';
import {
  applyInitialAttachments,
  clearCellAttachments,
  defaultUploadAttachment,
  getCellAttachments,
  removeCellAttachment,
  setCellAttachments,
  showAttachmentsModal,
  uploadAndAttachToCell,
} from './attachment';
import { registerAllIcons } from './icons';
import { customizeColumnHeaders } from './header';
import type {
  ETableAttachmentFile,
  ETableDataTraceNode,
  ETableProps,
  ETableRef,
} from './types';
import { message } from 'antd';
import UniverPresetSheetsThreadCommentZhCN from '@univerjs/preset-sheets-thread-comment/locales/zh-CN';
import UniverPresetSheetsAdvancedZhCN from '@univerjs/preset-sheets-advanced/locales/zh-CN';
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import UniverPresetSheetsNoteZhCN from '@univerjs/preset-sheets-note/locales/zh-CN';
import UniverPresetSheetsDataValidationZhCN from '@univerjs/preset-sheets-data-validation/locales/zh-CN';
import UniverPresetSheetsFindReplaceZhCN from '@univerjs/preset-sheets-find-replace/locales/zh-CN';
import '@univerjs/preset-sheets-advanced/lib/index.css';
import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-thread-comment/lib/index.css';
import '@univerjs/preset-sheets-note/lib/index.css';
import '@univerjs/preset-sheets-data-validation/lib/index.css';
import '@univerjs/preset-sheets-find-replace/lib/index.css';


/**
 * ============================================================================
 * ETable（UniverTable）— 基于 Univer Sheets 封装的业务二维表格组件
 * ============================================================================
 *
 * 【实现形态】
 * - 非透视表：树形/分组数据在应用层展平为 rows + columns，写入普通 Worksheet
 * - 非 OLAP 交叉：列布局在初始化时固定，编辑的是物化后的单元格网格
 *
 * 【数据输入优先级】
 *   treeData + treeConfig  >  groupData + groupConfig  >  columns + rows
 *
 * 【大数据渲染路径】（finishInit 内按条件分支）
 *   1. treeUI 且行数 ≥ 5000  → setupTreeViewport（工作表仅投影 ~300 行窗口）
 *   2. 平铺表且行数 ≥ 5000   → createVirtualDataLoader（按页 2000 行懒写入）
 *   3. 行数 ≥ 1000           → renderDataAsync（分片 setValues）
 *   4. 否则                    → renderData 全量写入
 *
 * 【树形折叠】
 *   - 小数据：setupTreeCellCollapse（hideRows / showRows）
 *   - 大数据：treeViewport 过滤可见逻辑行，不 hide 全表
 *
 * 【编辑回传】
 *   setupCellHistory 监听 SheetEditEnded → onCellChange(ETableCellChangeRecord)
 *   不会自动写回 treeData/rows，业务层需自行同步
 *
 * 【已加载 Univer Preset】（无 sheets-pivot）
 *   Core / Advanced / ThreadComment / Note / DataValidation / FindReplace
 *
 * 详细文档：tablesResearch/docs/UniverTable.md
 * ============================================================================
 */
const Table = forwardRef<ETableRef, ETableProps>((props, ref) => {
  // --------------------------------------------------------------------------
  // Props 解构：支持直接模式（columns/rows）与树形/分组模式（treeData/groupData）
  // --------------------------------------------------------------------------
  const {
    columns: propsColumns = [],
    rows: propsRows = [],
    merges: propsMerges = [],
    rowGroups: propsRowGroups = [],
    columnGroups: propsColumnGroups = [],
    treeData,
    treeConfig,
    groupData,
    groupConfig,
    options = {},
    comments = [],
    attachments = [],
    onUploadAttachment,
    onAttachmentsChange,
    onCellChange,
    onSelectionChange,
    onViewCellHistory,
    onViewDataTrace,
    onReady,
  } = props;

  // 回调 ref：避免 useEffect 闭包拿到过期的 onCellChange 等处理器
  const onUploadAttachmentRef = useRef(onUploadAttachment);
  const onAttachmentsChangeRef = useRef(onAttachmentsChange);
  const onCellChangeRef = useRef(onCellChange);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const onViewCellHistoryRef = useRef(onViewCellHistory);
  const onViewDataTraceRef = useRef(onViewDataTrace);
  onUploadAttachmentRef.current = onUploadAttachment;
  onAttachmentsChangeRef.current = onAttachmentsChange;
  onCellChangeRef.current = onCellChange;
  onSelectionChangeRef.current = onSelectionChange;
  onViewCellHistoryRef.current = onViewCellHistory;
  onViewDataTraceRef.current = onViewDataTrace;

  // --------------------------------------------------------------------------
  // 数据展平：树形/分组在 setTimeout(0) 中异步 flatten，首帧可显示「展平数据中…」
  // 展平完成后 flattened 变化会触发下方 Univer 初始化 effect 整表重建
  // --------------------------------------------------------------------------
  const needsFlatten = Boolean(
    (treeData && treeConfig) || (groupData && groupConfig),
  );
  const [flattened, setFlattened] = useState<ETableFlattenResult | null>(null);
  const [flattenPreparing, setFlattenPreparing] = useState(needsFlatten);

  useEffect(() => {
    if (!needsFlatten) {
      setFlattened(null);
      setFlattenPreparing(false);
      return;
    }
    let cancelled = false;
    setFlattenPreparing(true);
    setFlattened(null);

    const timer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      try {
        const result =
          treeData && treeConfig
            ? flattenTreeData(treeData, treeConfig)
            : flattenGroupedData(groupData!, groupConfig!);
        if (!cancelled) {
          setFlattened(result);
          setFlattenPreparing(false);
        }
      } catch (error) {
        console.warn('[ETable] flatten failed', error);
        if (!cancelled) {
          setFlattenPreparing(false);
        }
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [needsFlatten, treeData, treeConfig, groupData, groupConfig]);

  // 统一数据源：展平结果优先，否则使用 props 直接传入的二维表结构
  const columns = flattened?.columns ?? propsColumns;
  const rows = flattened?.rows ?? propsRows;
  const merges = flattened?.merges ?? propsMerges;
  const rowGroups = flattened?.rowGroups ?? propsRowGroups;
  const columnGroups = flattened?.columnGroups?.length
    ? flattened.columnGroups
    : propsColumnGroups;
  const treeToggles = flattened?.treeToggles ?? [];
  const treeUI = Boolean(treeConfig?.treeUI);
  // 表格基础配置
  const {
    name = 'Table',
    // 默认列宽
    defaultColumnWidth = 110,
    // 默认行高
    defaultRowHeight = 30,
    // 是否显示网格线
    showGridLines = true,
    // 冻结行数量
    freezeRows,
    // 冻结列数量
    freezeColumns,
    // 是否自定义 Univer 原生列头
    customizeColumnHeader = true,
    // 虚拟滚动：Canvas 可视区绘制；大数据视口按页懒写入
    virtualScroll = true,
    // 扩展选项：自定义右键菜单项（不传则使用默认的 defaultContextMenuItems）
    contextMenuItems = defaultContextMenuItems,
    // 扩展选项：是否启用自定义右键菜单
    enableContextMenu = true,
  } = options as any;

  // --------------------------------------------------------------------------
  // 实例 Ref：贯穿初始化与对外 API，保存 Univer 与各子模块句柄
  // --------------------------------------------------------------------------
  // Univer DOM 容器
  const containerRef = useRef<HTMLDivElement>(null);
  // Univer API
  const univerAPIRef = useRef<any>(null);
  // Workbook
  const workbookRef = useRef<any>(null);
  // Worksheet
  const worksheetRef = useRef<any>(null);
  const treeCollapseApiRef = useRef<ETableTreeCollapseApi | null>(null);
  const logicalRowResolverRef = useRef<((projectedDataRow: number) => number | null) | null>(
    null,
  );
  const cellHistoryApiRef = useRef<ETableCellHistoryApi | null>(null);
  const leafColumnsRef = useRef<any[]>([]);
  const headerDepthRef = useRef(0);
  const virtualLoaderRef = useRef<VirtualDataLoader | null>(null);
  const treeViewportStatsRef = useRef<TreeViewportStats | null>(null);

  /** 构建「数据追踪」树：当前值 + 列信息 + 行面包屑 + 单元格历史 */
  const buildDataTrace = (cell?: string): ETableDataTraceNode | null => {
    const worksheet = worksheetRef.current;
    if (!worksheet) {
      return null;
    }
    let target = cell;
    if (!target) {
      try {
        const range = worksheet.getSelection?.()?.getActiveRange?.();
        const row = range?.getRow?.() ?? 0;
        const column = range?.getColumn?.() ?? 0;
        let name = '';
        let v = column + 1;
        while (v > 0) {
          const rem = (v - 1) % 26;
          name = String.fromCharCode(65 + rem) + name;
          v = Math.floor((v - 1) / 26);
        }
        target = `${name}${row + 1}`;
      } catch {
        return null;
      }
    }
    if (!target) {
      return null;
    }
    try {
      const range = worksheet.getRange(target);
      const row = range.getRow?.() ?? 0;
      const column = range.getColumn?.() ?? 0;
      const value = range.getValue?.();
      const leaf = leafColumnsRef.current[column];
      const dataRow = row - headerDepthRef.current;
      const logicalRow = logicalRowResolverRef.current?.(dataRow) ?? dataRow;
      const crumb = treeCollapseApiRef.current?.getBreadcrumb(logicalRow) || [];
      const history = cellHistoryApiRef.current?.getCellHistory(target) || [];
      const children: ETableDataTraceNode[] = [
        {
          label: '当前值',
          value: value === null || value === undefined ? '∅' : String(value),
        },
        {
          label: '列',
          value: leaf?.title ? `${leaf.title} (${leaf.type || 'text'})` : String(column),
        },
      ];
      if (crumb.length) {
        children.push({
          label: '行路径',
          value: crumb.join(' / '),
          children: crumb.map((item) => ({ label: item })),
        });
      }
      if (history.length) {
        children.push({
          label: '变更历史',
          children: history.slice(0, 8).map((item) => ({
            label: item.time,
            value: `${item.from || '∅'} → ${item.to || '∅'}`,
          })),
        });
      } else {
        children.push({
          label: '来源',
          value: '原始录入 / 演示数据（无上游计算）',
        });
      }
      return {
        label: `数据追踪 · ${target}`,
        children,
      };
    } catch {
      return null;
    }
  };

  // --------------------------------------------------------------------------
  // useImperativeHandle：对外暴露 ETableRef（行列大纲、批注、附件、搜索、历史等）
  // --------------------------------------------------------------------------
  useImperativeHandle(ref, () => ({
    // Univer API
    getUniverAPI() {
      return univerAPIRef.current;
    },
    // Workbook
    getWorkbook() {
      return workbookRef.current;
    },
    // Worksheet
    getWorksheet() {
      return worksheetRef.current;
    },
    // 行分组
    getRowOutlines() {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return [];
      };
      return getRowOutlines(worksheet);
    },
    // 折叠指定行分组
    collapseRowGroup(id: string) {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return;
      }
      setOutlineCollapsed(worksheet, id, true);
    },
    // 展开指定行分组
    expandRowGroup(id: string) {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return;
      }
      setOutlineCollapsed(worksheet, id, false);
    },
    // 一次性折叠所有行分组
    collapseAllRows() {
      if (treeCollapseApiRef.current) {
        treeCollapseApiRef.current.collapseAll();
        return;
      }
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return;
      }
      const groups = getRowOutlines(worksheet);
      groups.forEach((group: any) => {
        worksheet.setDimensionOutlineCollapsed(
          group.id,
          true,
        );
      });
    },
    // 一次性展开所有行分组
    expandAllRows() {
      if (treeCollapseApiRef.current) {
        treeCollapseApiRef.current.expandAll();
        return;
      }
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return;
      }
      const groups = getRowOutlines(worksheet);
      groups.forEach((group: any) => {
        worksheet.setDimensionOutlineCollapsed(group.id, false);
      });
    },
    // 列分组
    getColumnOutlines() {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return [];
      }

      return getColumnOutlines(worksheet);
    },
    // 折叠指定列分组
    collapseColumnGroup(id: string) {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return;
      }
      setOutlineCollapsed(worksheet, id, true);
    },
    // 展开指定列分组
    expandColumnGroup(id: string) {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return;
      }
      setOutlineCollapsed(worksheet, id, false,);

    },
    // 一次性折叠所有列分组
    collapseAllColumns() {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return;
      }
      const groups = getColumnOutlines(worksheet);
      groups.forEach((group: any) => {
        worksheet.setDimensionOutlineCollapsed(group.id, true);
      });
    },
    // 一次性展开所有列分组
    expandAllColumns() {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return;
      }
      const groups = getColumnOutlines(worksheet);
      groups.forEach((group: any) => {
        worksheet.setDimensionOutlineCollapsed(group.id, false);
      });

    },
    // 批注
    async addComment(cell: string, content: string, userId = 'current-user') {
      const univerAPI = univerAPIRef.current;
      const worksheet = worksheetRef.current;
      if (!univerAPI || !worksheet) {
        return null;
      }
      // 创建富文本
      const richText = univerAPI.newRichText().insertText(content);
      // 创建 Thread Comment
      const commentBuilder = univerAPI.newTheadComment().setContent(richText).setPersonId(userId).setDateTime(new Date());
      // 获取单元格
      const range = worksheet.getRange(cell);
      // 添加批注
      return range.addCommentAsync(
        commentBuilder,
      );
    },
    // 获取全部单元格批注
    getComments() {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return [];
      }
      return worksheet.getComments();
    },
    // 获取指定单元格的批注
    getComment(cell: string) {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return null;
      }
      return worksheet.getRange(cell).getComment();
    },
    // 删除指定单元格的批注
    async deleteComment(cell: string) {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return false;
      }
      const comment = worksheet.getRange(cell).getComment();
      if (!comment) {
        return false;
      }
      return comment.deleteAsync();
    },
    // 删除当前 Worksheet中的全部批注
    async clearComments() {
      const worksheet = worksheetRef.current;
      if (!worksheet) {
        return;
      }
      const comments = worksheet.getComments();
      await Promise.all(comments.map((comment: any) => comment.deleteAsync()),
      );
    },
    // 添加附件（弹文件选择）
    async addAttachment(cell: string) {
      const worksheet = worksheetRef.current;
      if (!worksheet || !cell) {
        return [];
      }
      const range = worksheet.getRange(cell);
      const files = await uploadAndAttachToCell({
        range,
        cell,
        onUpload: onUploadAttachmentRef.current,
      });
      onAttachmentsChangeRef.current?.(cell, files);
      return files;
    },
    // 设置附件列表
    setAttachments(cell: string, files: ETableAttachmentFile[]) {
      const worksheet = worksheetRef.current;
      if (!worksheet || !cell) {
        return;
      }
      const range = worksheet.getRange(cell);
      setCellAttachments(range, files || []);
      onAttachmentsChangeRef.current?.(cell, files || []);
    },
    // 获取附件
    getAttachments(cell: string) {
      const worksheet = worksheetRef.current;
      if (!worksheet || !cell) {
        return [];
      }
      return getCellAttachments(worksheet.getRange(cell));
    },
    // 删除单个附件
    removeAttachment(cell: string, attachmentId: string) {
      const worksheet = worksheetRef.current;
      if (!worksheet || !cell) {
        return [];
      }
      const next = removeCellAttachment(worksheet.getRange(cell), attachmentId);
      onAttachmentsChangeRef.current?.(cell, next);
      return next;
    },
    // 清空附件
    clearAttachments(cell: string) {
      const worksheet = worksheetRef.current;
      if (!worksheet || !cell) {
        return;
      }
      clearCellAttachments(worksheet.getRange(cell));
      onAttachmentsChangeRef.current?.(cell, []);
    },
    // 查看附件弹窗
    viewAttachments(cell: string) {
      const worksheet = worksheetRef.current;
      if (!worksheet || !cell) {
        return;
      }
      showAttachmentsModal(cell, getCellAttachments(worksheet.getRange(cell)));
    },
    drillDown() {
      return Boolean(treeCollapseApiRef.current?.drillDown());
    },
    drillUp() {
      return Boolean(treeCollapseApiRef.current?.drillUp());
    },
    getBreadcrumb() {
      try {
        const worksheet = worksheetRef.current;
        const range = worksheet?.getSelection?.()?.getActiveRange?.();
        const sheetRow = range?.getRow?.() ?? 0;
        const dataRow = sheetRow - headerDepthRef.current;
        const logicalRow = logicalRowResolverRef.current?.(dataRow) ?? dataRow;
        return treeCollapseApiRef.current?.getBreadcrumb(logicalRow) || [];
      } catch {
        return [];
      }
    },
    openSearch() {
      return openQuickSearch(univerAPIRef.current);
    },
    async search(keyword: string) {
      return searchAndSelect(univerAPIRef.current, keyword);
    },
    async undo() {
      try {
        const api = univerAPIRef.current;
        if (!api?.undo) {
          return false;
        }
        return Boolean(await api.undo());
      } catch (error) {
        console.warn('[ETable] undo failed', error);
        return false;
      }
    },
    async redo() {
      try {
        const api = univerAPIRef.current;
        if (!api?.redo) {
          return false;
        }
        return Boolean(await api.redo());
      } catch (error) {
        console.warn('[ETable] redo failed', error);
        return false;
      }
    },
    getTracks() {
      return cellHistoryApiRef.current?.getTracks() || [];
    },
    getCellHistory(cell: string) {
      return cellHistoryApiRef.current?.getCellHistory(cell) || [];
    },
    clearTracks() {
      cellHistoryApiRef.current?.clear();
    },
    getDataTrace(cell?: string) {
      return buildDataTrace(cell);
    },
    getVirtualRenderStats() {
      return virtualLoaderRef.current?.getStats() ?? null;
    },
    getTreeViewportStats() {
      return treeViewportStatsRef.current;
    },
  }), []);

  // --------------------------------------------------------------------------
  // Univer 生命周期：flatten 完成后创建实例 → finishInit 渲染 → 卸载时 dispose
  // 依赖 [needsFlatten, flattenPreparing, flattened]；直接模式 rows 变更不会自动热更新
  // --------------------------------------------------------------------------
  useEffect(() => {
    // 没有 DOM 容器，不初始化
    if (!containerRef.current) {
      return;
    }
    // 树形数据展平未完成
    if (needsFlatten && (flattenPreparing || !flattened)) {
      return;
    }
    const useTreeViewport =
      treeUI && rows.length >= TREE_VIEWPORT_THRESHOLD && treeToggles.length > 0;
    // 防止重复初始化
    if (univerAPIRef.current) {
      return;
    }
    const renderStartedAt = performance.now();
    // 创建 Univer
    const { univerAPI } = createUniver({
      // 中文
      locale: LocaleType.ZH_CN,
      // 中文语言包
      locales: {
        [LocaleType.ZH_CN]: mergeLocales(
          UniverPresetSheetsCoreZhCN,
          UniverPresetSheetsAdvancedZhCN,
          UniverPresetSheetsThreadCommentZhCN,
          UniverPresetSheetsNoteZhCN,
          UniverPresetSheetsDataValidationZhCN,
          UniverPresetSheetsFindReplaceZhCN,
        ),
      },
      // Preset
      presets: [
        // Core：顺带预隐藏一批常见原生右键命令（自定义菜单注册后还会再扫一遍）
        UniverSheetsCorePreset({
          container: containerRef.current,
          header: false,
          toolbar: false,
          formulaBar: false,
          footer: false,
          menu: NATIVE_CONTEXT_MENU_HIDE_CONFIG,
          // 虚拟滚动：启用纵向/横向滚动条；限制自动行高扫描量避免大数据卡顿
          ...(virtualScroll
            ? {
                scrollConfig: {
                  enableVertical: true,
                  enableHorizontal: true,
                },
                maxAutoHeightCount: 200,
              }
            : {}),
        }),
        // Advanced
        UniverSheetsAdvancedPreset(),
        // Thread Comment
        UniverSheetsThreadCommentPreset(),
        // Note（附件角标）
        UniverSheetsNotePreset(),
        // 数据验证（下拉 / 数字）
        UniverSheetsDataValidationPreset(),
        // 查找替换（快速搜索）
        UniverSheetsFindReplacePreset(),
      ],
    });
    // 保存 Univer API
    univerAPIRef.current = univerAPI;
    // 创建 Workbook（按数据规模预置行列数，便于 Canvas 虚拟滚动骨架）
    const { maxDepth: headerDepth } = buildHeaderLayout(columns);
    const leafCount = flattenColumns(columns).length;
    const sheetRowCount = useTreeViewport
      ? headerDepth + TREE_VIEWPORT_WINDOW_SIZE + 10
      : Math.max(1000, headerDepth + rows.length + 10);
    const sheetColCount = Math.max(20, leafCount + 2);
    const workbook = univerAPI.createWorkbook({
      name,
      sheetOrder: ['etable-sheet'],
      sheets: {
        'etable-sheet': {
          id: 'etable-sheet',
          name: name || 'Sheet1',
          rowCount: sheetRowCount,
          columnCount: sheetColCount,
        },
      },
    });
    workbookRef.current = workbook;
    // 获取 Worksheet
    const worksheet = workbook.getActiveSheet();
    if (!worksheet) {
      return;
    }
    worksheetRef.current = worksheet;
    // 0. 扩容兜底：防止版本差异未吃到 snapshot 行列数
    ensureSheetCapacity(
      worksheet,
      sheetRowCount,
      sheetColCount,
    );
    // 1. 网格线
    worksheet.setHiddenGridlines(!showGridLines);
    // 2. 渲染业务多级表头
    const { leafColumns, maxDepth } = renderHeader(worksheet, columns);
    leafColumnsRef.current = leafColumns;
    headerDepthRef.current = maxDepth;
    // 3. ⭐ 自定义 Univer 原生列头
    if (customizeColumnHeader && leafColumns.length) {
      const columnsCfg: Record<number, string> = {};
      leafColumns.forEach((column: any, index: number) => {
        columnsCfg[index] = column.title;
      });
      // 延迟到当前渲染完成后执行。
      requestAnimationFrame(() => {
        try {
          customizeColumnHeaders(worksheet, leafColumns);
        } catch (error) {
          console.warn('[Table] customize column header failed', error);
          // 兼容当前代码。如果当前版本的 Worksheet直接支持 customizeColumnHeader，则继续使用原生 API。
          try {
            worksheet.customizeColumnHeader?.({ columnsCfg });
          } catch (
          fallbackError
          ) {
            console.warn('[Table] fallback customize column header failed', fallbackError);
          }
        }
      });
    }
    // 4. 设置列宽
    renderColumnWidths(worksheet, leafColumns, defaultColumnWidth);
    // 5. 设置表头行高
    renderRowHeights(worksheet, 0, maxDepth, defaultRowHeight);
    const isAsyncRender = rows.length >= ASYNC_RENDER_ROW_THRESHOLD;
    const isLargeData = rows.length >= LARGE_TREE_FLAT_ROW_THRESHOLD;
    // 树形大数据：视口投影（工作表固定窗口行数）；否则 hideRows 折叠
    // 平铺表：视口按页懒写入
    const useLazyVirtual =
      virtualScroll && rows.length >= VIRTUAL_LAZY_THRESHOLD && !treeUI && !useTreeViewport;
    let cancelled = false;
    let disposeVirtualLoader: (() => void) | undefined;
    let virtualLoader: VirtualDataLoader | null = null;
    let treeViewportStats: TreeViewportStats | null = null;
    let disposeTreeCollapse: (() => void) | undefined;
    let disposeReadonly: (() => void) | undefined;
    let historyApi: ReturnType<typeof setupCellHistory> | null = null;
    let disposeFindDialogConstraint: (() => void) | undefined;
    let disposeCommentContextMenuGuard: (() => void) | undefined;
    let disposeContextMenuBlock: (() => void) | undefined;

    const finishInit = async () => {
      // ------ 6. 数据写入（四选一渲染路径）------
      if (useTreeViewport) {
        // 数据由 setupTreeViewport 按可见窗口写入，跳过全量 setValues
      } else if (useLazyVirtual) {
        virtualLoader = createVirtualDataLoader({
          univerAPI,
          worksheet,
          rows,
          leafColumns,
          dataStartRow: maxDepth,
          defaultRowHeight,
        });
        virtualLoaderRef.current = virtualLoader;
        disposeVirtualLoader = () => {
          virtualLoaderRef.current = null;
          virtualLoader?.dispose();
        };
        renderData(worksheet, rows, leafColumns, maxDepth, {
          virtualScroll,
          skipWrite: true,
        });
      } else if (isAsyncRender) {
        await renderDataAsync(worksheet, rows, leafColumns, maxDepth, {
          virtualScroll,
          skipRowBackgrounds: Boolean(treeConfig?.liteMode) || isLargeData,
        });
      } else {
        renderData(worksheet, rows, leafColumns, maxDepth, { virtualScroll });
      }
      if (cancelled) {
        return;
      }
      const readonlyDataRows: number[] = [];
      for (let index = 0; index < rows.length; index += 1) {
        if (rows[index].readonly) {
          readonlyDataRows.push(index);
        }
      }
      // 6.5 列类型：懒虚拟按页写入；树视口在投影时写入；其余路径一次性应用
      if (!useLazyVirtual && !useTreeViewport) {
        applyColumnTypes(univerAPI, worksheet, leafColumns, maxDepth, rows.length, {
          skipValidation: isLargeData,
          readonlyDataRows,
        });
      }
      // 7. 设置数据行高（树视口 / 异步 / 懒虚拟路径已单独处理）
      if (rows.length && !isAsyncRender && !useLazyVirtual && !useTreeViewport) {
        renderRowHeights(worksheet, maxDepth, rows.length, defaultRowHeight);
      }
      // 8. 自定义合并（lite 大数据：首屏跳过，Region 展开时按索引懒合并）
      const lazyLiteMerges = Boolean(treeConfig?.liteMode) && isLargeData;
      if (merges.length > 0 && !lazyLiteMerges && !useTreeViewport) {
        if (isAsyncRender) {
          await renderMergesAsync(worksheet, merges, maxDepth);
        } else {
          renderMerges(worksheet, merges, maxDepth);
        }
      }
      if (cancelled) {
        return;
      }
      // 11–12. 冻结（先冻结再折叠，减少重绘）
      if (typeof freezeRows === 'number') {
        worksheet.setFrozenRows(freezeRows);
      } else if (maxDepth > 0) {
        worksheet.setFrozenRows(maxDepth);
      }
      if (typeof freezeColumns === 'number') {
        worksheet.setFrozenColumns(freezeColumns);
      }
      // ------ 9. 树形折叠 / 行大纲（treeUI 不创建左侧大纲栏）------
      if (isAsyncRender && !isLargeData) {
        await new Promise<void>((resolve) => {
          window.requestAnimationFrame(() => resolve());
        });
      }
      if (cancelled) {
        return;
      }
      const collapseBatchSize =
        treeToggles.length >= 10_000 ? 500 : treeToggles.length >= 2000 ? 250 : 100;
      let collapseReady: Promise<void> = Promise.resolve();
      if (useTreeViewport && treeToggles.length) {
        const api = setupTreeViewport(
          univerAPI,
          worksheet,
          rows,
          rowGroups,
          treeToggles,
          leafColumns,
          maxDepth,
          {
            defaultRowHeight,
            merges,
            skipMerges: Boolean(treeConfig?.skipMerges) || lazyLiteMerges,
            onProjected: (stats) => {
              treeViewportStats = stats;
              treeViewportStatsRef.current = stats;
            },
          },
        );
        treeCollapseApiRef.current = api;
        logicalRowResolverRef.current = api.getLogicalDataRow;
        collapseReady = api.ready;
        disposeTreeCollapse = () => {
          api.dispose();
          treeCollapseApiRef.current = null;
          logicalRowResolverRef.current = null;
          treeViewportStatsRef.current = null;
        };
      } else if (treeUI && treeToggles.length) {
        const api = setupTreeCellCollapse(
          univerAPI,
          worksheet,
          rowGroups,
          treeToggles,
          maxDepth,
          {
            ...(isLargeData
              ? {
                  batchedInit: true,
                  initBatchSize: collapseBatchSize,
                  skipInitLabels: true,
                }
              : {}),
            merges,
            ensureDataRows: virtualLoader
              ? (startRow, endRow) => {
                  virtualLoader!.ensureRows(startRow, endRow);
                }
              : undefined,
          },
        );
        treeCollapseApiRef.current = api;
        collapseReady = api.ready;
        disposeTreeCollapse = () => {
          api.dispose();
          treeCollapseApiRef.current = null;
        };
      } else {
        treeCollapseApiRef.current = null;
        createRowOutlines(worksheet, rowGroups, maxDepth);
      }
      // ------ 9.5 只读区域：表头 + 维度列 + 汇总行（BeforeSheetEditStart 拦截）------
      const readonlyColumnSet = new Set(
        leafColumns
          .map((column, index) => (column.editable === false ? index : -1))
          .filter((index) => index >= 0),
      );
      // treeUI 默认锁定 dimensions + attribute 对应列（列配置 editable: true 时除外）
      if (treeUI && treeConfig) {
        const lockFields = new Set([
          ...treeConfig.dimensions.map((item) => item.field),
          ...(treeConfig.attribute ? [treeConfig.attribute.field] : []),
        ]);
        leafColumns.forEach((column, index) => {
          if (lockFields.has(column.id) && column.editable !== true) {
            readonlyColumnSet.add(index);
          }
        });
      }
      const dimensionFieldSet = new Set(treeConfig?.dimensions.map((item) => item.field) ?? []);
      const editableOnReadonlyRowColumns = leafColumns
        .map((column, index) =>
          column.editable === true && dimensionFieldSet.has(column.id) ? index : -1,
        )
        .filter((index) => index >= 0);
      const readonlyColumns = [...readonlyColumnSet];
      disposeReadonly = setupReadonlyCells(univerAPI, {
        headerRowCount: maxDepth,
        readonlyColumns,
        editableOnReadonlyRowColumns,
        readonlyDataRows: useTreeViewport ? undefined : readonlyDataRows,
        isReadonlyDataRow: useTreeViewport
          ? (dataRow) => {
              const logical = logicalRowResolverRef.current?.(dataRow);
              if (logical == null) {
                return false;
              }
              return Boolean(rows[logical]?.readonly);
            }
          : undefined,
      });
      // 10. 列分组
      createColumnOutlines(worksheet, columnGroups);

      await collapseReady;
      if (cancelled) {
        return;
      }

      const renderMs = Math.round(performance.now() - renderStartedAt);
      onReady?.({
        univerAPI,
        workbook,
        worksheet,
        renderMs,
        rowCount: rows.length,
        virtualRender: virtualLoader?.getStats() ?? null,
        treeViewport: treeViewportStats,
      });

      const setupSecondaryFeatures = () => {
        if (cancelled) {
          return;
        }
        // 13. 初始化批注
        if (comments.length) {
          void Promise.all(comments.map(async (comment: any) => {
            try {
              const { cell, content, userId = 'current-user', dateTime, id, threadId } = comment;
              if (!cell || !content) {
                return;
              }
              const richText = univerAPI.newRichText().insertText(content);
              let builder = univerAPI.newTheadComment().setContent(richText).setPersonId(userId).setDateTime(dateTime ? new Date(dateTime) : new Date());
              if (id) {
                builder = builder.setId(id);
              }
              if (threadId) {
                builder = builder.setThreadId(threadId);
              }
              const range = worksheet.getRange(cell);
              await range.addCommentAsync(builder);
            } catch (error) {
              console.warn('[Table] add comment failed', error);
            }
          }));
        }
        // 13.4 初始化附件
        try {
          applyInitialAttachments(worksheet, attachments);
        } catch (error) {
          console.warn('[Table] apply attachments failed', error);
        }
        // 13.5 单元格历史 / 数据追踪
        historyApi = setupCellHistory(univerAPI, worksheet, {
          onChange: (record) => onCellChangeRef.current?.(record),
          onSelectionChange: (cell, row, column) =>
            onSelectionChangeRef.current?.(cell, row, column),
        });
        cellHistoryApiRef.current = historyApi;

        // 13.6 查找对话框限制在表格容器内（Univer 默认挂 body + 按视口拖拽）
        if (containerRef.current) {
          try {
            disposeFindDialogConstraint = constrainFindDialogToContainer(
              univerAPI,
              containerRef.current,
            );
          } catch (error) {
            console.warn('[Table] constrain find dialog failed', error);
          }
        }

        // 13.7 注册自定义右键菜单
        const menuExtras = {
          onUploadAttachment: async (file: File, cell: string) => {
            if (onUploadAttachmentRef.current) {
              return onUploadAttachmentRef.current(file, cell);
            }
            return defaultUploadAttachment(file);
          },
          onAttachmentsChange: (cell: string, files: ETableAttachmentFile[]) => {
            onAttachmentsChangeRef.current?.(cell, files);
          },
          onViewCellHistory: (cell: string) => {
            onViewCellHistoryRef.current?.(cell);
          },
          onViewDataTrace: (cell: string) => {
            onViewDataTraceRef.current?.(cell);
          },
          onDrillDown: () => {
            const ok = treeCollapseApiRef.current?.drillDown();
            if (!ok) {
              message.info('当前行无可下钻分组');
            }
          },
          onDrillUp: () => {
            const ok = treeCollapseApiRef.current?.drillUp();
            if (!ok) {
              message.info('当前行无可上钻分组');
            }
          },
          onQuickSearch: () => {
            if (!openQuickSearch(univerAPI)) {
              message.warning('快速搜索不可用');
            }
          },
          onUndo: async () => {
            try {
              const ok = await univerAPI?.undo?.();
              message[ok ? 'success' : 'info'](ok ? '已撤销' : '没有可撤销的操作');
            } catch {
              message.warning('撤销失败');
            }
          },
          onRedo: async () => {
            try {
              const ok = await univerAPI?.redo?.();
              message[ok ? 'success' : 'info'](ok ? '已重做' : '没有可重做的操作');
            } catch {
              message.warning('重做失败');
            }
          },
        };
        if (enableContextMenu && contextMenuItems && contextMenuItems.length) {
          try {
            customizeContextMenu(univerAPI, worksheet, contextMenuItems, menuExtras);
            if (containerRef.current) {
              disposeCommentContextMenuGuard = setupCommentContextMenuGuard(
                univerAPI,
                containerRef.current,
              );
            }
          } catch (error) {
            console.warn('[Table] register context menu failed', error);
          }
        } else if (containerRef.current) {
          try {
            disableContextMenu(univerAPI);
            disposeContextMenuBlock = setupContextMenuBlock(containerRef.current);
          } catch (error) {
            console.warn('[Table] disable context menu failed', error);
          }
        }
      };

      if (isAsyncRender || isLargeData) {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(setupSecondaryFeatures, { timeout: 500 });
        } else {
          window.setTimeout(setupSecondaryFeatures, 0);
        }
      } else {
        setupSecondaryFeatures();
      }
    };

    void finishInit();

    // 15. 销毁
    return () => {
      cancelled = true;
      try {
        disposeVirtualLoader?.();
      } catch (error) {
        console.warn('[Table] dispose virtual loader failed', error);
      }
      try {
        disposeReadonly?.();
      } catch (error) {
        console.warn('[Table] dispose readonly failed', error);
      }
      try {
        disposeTreeCollapse?.();
      } catch (error) {
        console.warn('[Table] dispose tree collapse failed', error);
      }
      try {
        historyApi?.dispose();
        cellHistoryApiRef.current = null;
      } catch (error) {
        console.warn('[Table] dispose cell history failed', error);
      }
      try {
        disposeCommentContextMenuGuard?.();
      } catch (error) {
        console.warn('[Table] dispose comment context menu guard failed', error);
      }
      try {
        disposeContextMenuBlock?.();
      } catch (error) {
        console.warn('[Table] dispose context menu block failed', error);
      }
      try {
        disposeFindDialogConstraint?.();
      } catch (error) {
        console.warn('[Table] dispose find dialog constraint failed', error);
      }
      try {
        univerAPI.dispose();
      } catch (error) {
        console.warn('[Table] dispose failed', error);
      }
      univerAPIRef.current = null;
      workbookRef.current = null;
      worksheetRef.current = null;
      logicalRowResolverRef.current = null;
    };
  }, [needsFlatten, flattenPreparing, flattened]);

  // 注册 icon 图标（与右键菜单注册分离，避免关闭菜单后仍被二次注册）
  useEffect(() => {
    const univerAPI = univerAPIRef.current;
    if (univerAPI) {
      registerAllIcons(univerAPI);
    }
  }, [needsFlatten, flattenPreparing, flattened]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {flattenPreparing && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.85)',
            color: '#666',
            fontSize: 13,
          }}
        >
          展平数据中…
        </div>
      )}
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      />
    </div>
  );
});

Table.displayName = 'Table';

export { flattenTreeData, buildTreeColumns, buildTreeColumnGroups } from './tree';
export { applyGroupStatistics, computeGrandTotalValues } from './groupStatistics';
export type {
  ETableProps,
  ETableRef,
  ETableTreeNode,
  ETableTreeConfig,
  ETableTreeAttribute,
  ETableTreeColumnGroup,
  ETableFlattenResult,
  ETableColumnGroup,
  ETableAttachment,
  ETableAttachmentFile,
  ETableComment,
  ETableCellChangeRecord,
  ETableDataTraceNode,
  ETableGroupStatistics,
  ETableGroupStatisticField,
} from './types';

export default Table;
