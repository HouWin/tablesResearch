import { forwardRef, useEffect, useImperativeHandle, useRef, } from 'react';
import { createUniver, LocaleType, mergeLocales, } from '@univerjs/presets';
import { UniverSheetsAdvancedPreset } from '@univerjs/preset-sheets-advanced';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import { UniverSheetsThreadCommentPreset } from '@univerjs/preset-sheets-thread-comment';
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import { UniverSheetsDataValidationPreset } from '@univerjs/preset-sheets-data-validation';
import { UniverSheetsFindReplacePreset } from '@univerjs/preset-sheets-find-replace';
import { createColumnOutlines, createRowOutlines, getColumnOutlines, getRowOutlines, setOutlineCollapsed, } from './outline';
import { ensureSheetCapacity, flattenColumns, renderColumnWidths, renderData, renderHeader, renderMerges, renderRowHeights } from './renderer';
import { buildHeaderLayout } from './layout';
import { flattenGroupedData } from './groupData';
import { flattenTreeData } from './tree';
import { setupTreeCellCollapse } from './treeCollapse';
import type { ETableTreeCollapseApi } from './treeCollapse';
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
  NATIVE_CONTEXT_MENU_HIDE_CONFIG,
  setupCommentContextMenuGuard,
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
import UniverPresetSheetsDataValidationZhCN from '@univerjs/preset-sheets-data-validation/lib/es/locales/zh-CN';
import UniverPresetSheetsFindReplaceZhCN from '@univerjs/preset-sheets-find-replace/lib/es/locales/zh-CN';
import '@univerjs/preset-sheets-advanced/lib/index.css';
import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-thread-comment/lib/index.css';
import '@univerjs/preset-sheets-note/lib/index.css';
import '@univerjs/preset-sheets-data-validation/lib/index.css';
import '@univerjs/preset-sheets-find-replace/lib/index.css';


/**
* Table
*
* 基于 Univer 封装的通用电子表格组件。
*
* =========================================================
* 已有功能
* =========================================================
*
* 1. 多级表头
* 2. 自定义原生列头
* 3. 自定义列宽
* 4. 自定义行高
* 5. 表格数据
* 6. 单元格合并
* 7. 行分组
* 8. 列分组
* 9. 行冻结
* 10. 列冻结
* 11. 网格线控制
* 12. 单元格批注
* 13. Univer API 暴露
* 14. 树形数据 + 属性层折叠（treeData）
* 15. 列分组折叠（columnGroups / treeConfig.columnGroups）
* 16. 单元格附件
* 17. 上钻 / 下钻
* 18. 单元格历史 / 数据追踪
* 19. 快速搜索
* 20. 列类型（number / select 下拉）
*/
const Table = forwardRef<ETableRef, ETableProps>((props, ref) => {
  // 取组件参数
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

  /**
   * 优先 treeData，其次 groupData，否则使用外部 flat props。
   */
  const flattened = treeData && treeConfig
    ? flattenTreeData(treeData, treeConfig)
    : groupData && groupConfig
      ? flattenGroupedData(groupData, groupConfig)
      : null;
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

  // Univer DOM 容器
  const containerRef = useRef<HTMLDivElement>(null);
  // Univer API
  const univerAPIRef = useRef<any>(null);
  // Workbook
  const workbookRef = useRef<any>(null);
  // Worksheet
  const worksheetRef = useRef<any>(null);
  const treeCollapseApiRef = useRef<ETableTreeCollapseApi | null>(null);
  const cellHistoryApiRef = useRef<ETableCellHistoryApi | null>(null);
  const leafColumnsRef = useRef<any[]>([]);
  const headerDepthRef = useRef(0);

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
      const crumb = treeCollapseApiRef.current?.getBreadcrumb(dataRow) || [];
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

  //  对外暴露API
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
        return treeCollapseApiRef.current?.getBreadcrumb(dataRow) || [];
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
  }), []);

  // 初始化 Univer
  useEffect(() => {
    // 没有 DOM 容器，不初始化
    if (!containerRef.current) {
      return;
    }
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
    const sheetRowCount = Math.max(1000, headerDepth + rows.length + 10);
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
    // 6. 渲染数据
    // ≥ VIRTUAL_LAZY_THRESHOLD 且开启虚拟滚动：视口按页懒写入
    // 否则：分片/全量 setValues
    const useLazyVirtual =
      virtualScroll && rows.length >= VIRTUAL_LAZY_THRESHOLD;
    let disposeVirtualLoader: (() => void) | undefined;
    let virtualLoader: VirtualDataLoader | null = null;

    if (useLazyVirtual) {
      // 先铺默认行高，保证滚动条与骨架正确
      if (rows.length) {
        renderRowHeights(worksheet, maxDepth, rows.length, defaultRowHeight);
      }
      virtualLoader = createVirtualDataLoader({
        univerAPI,
        worksheet,
        rows,
        leafColumns,
        dataStartRow: maxDepth,
      });
      disposeVirtualLoader = virtualLoader?.dispose;
      // skipWrite：单元格由 loader 按页写入
      renderData(worksheet, rows, leafColumns, maxDepth, {
        virtualScroll,
        skipWrite: true,
      });
    } else {
      renderData(worksheet, rows, leafColumns, maxDepth, { virtualScroll });
      // 6.5 列类型：Sales 数字 / Profit 下拉等
      applyColumnTypes(univerAPI, worksheet, leafColumns, maxDepth, rows.length);
      // 7. 设置数据行高
      if (rows.length) {
        renderRowHeights(worksheet, maxDepth, rows.length, defaultRowHeight);
      }
    }
    // 8. 自定义合并（row 相对于数据区，需加上表头深度）
    renderMerges(worksheet, merges, maxDepth);
    // 9. 行分组：treeUI 用单元格内折叠（不创建左侧大纲）
    let disposeTreeCollapse: (() => void) | undefined;
    if (treeUI && treeToggles.length) {
      const api = setupTreeCellCollapse(
        univerAPI,
        worksheet,
        rowGroups,
        treeToggles,
        maxDepth,
      );
      treeCollapseApiRef.current = api;
      disposeTreeCollapse = () => {
        api.dispose();
        treeCollapseApiRef.current = null;
      };
    } else {
      treeCollapseApiRef.current = null;
      createRowOutlines(worksheet, rowGroups, maxDepth);
    }
    // 9.5 表头 + 维度/属性列只读（红框区域不可编辑）
    const readonlyColumns = leafColumns
      .map((column, index) => (column.editable === false ? index : -1))
      .filter((index) => index >= 0);
    // treeUI 默认锁定 dimensions + attribute 对应列
    if (treeUI && treeConfig) {
      const lockFields = new Set([
        ...treeConfig.dimensions.map((item) => item.field),
        ...(treeConfig.attribute ? [treeConfig.attribute.field] : []),
      ]);
      leafColumns.forEach((column, index) => {
        if (lockFields.has(column.id) && !readonlyColumns.includes(index)) {
          readonlyColumns.push(index);
        }
      });
    }
    const disposeReadonly = setupReadonlyCells(univerAPI, {
      headerRowCount: maxDepth,
      readonlyColumns,
    });
    // 10. 列分组
    createColumnOutlines(worksheet, columnGroups);
    // 11. 冻结行
    if (typeof freezeRows === 'number') {
      worksheet.setFrozenRows(freezeRows);
    } else if (
      maxDepth > 0
    ) {
      worksheet.setFrozenRows(maxDepth);
    }
    // 12. 冻结列
    if (typeof freezeColumns === 'number') {
      worksheet.setFrozenColumns(freezeColumns);
    }
    // 13. 初始化批注
    if (comments.length) {
      Promise.all(comments.map(async (comment: any) => {
        try {
          const { cell, content, userId = 'current-user', dateTime, id, threadId } = comment;
          // 没有单元格或者内容  直接跳过
          if (!cell || !content) {
            return;
          }
          // 创建富文本
          const richText = univerAPI.newRichText().insertText(content);
          // 创建批注
          let builder = univerAPI.newTheadComment().setContent(richText).setPersonId(userId).setDateTime(dateTime ? new Date(dateTime) : new Date());
          // 设置批注 ID
          if (id) {
            builder = builder.setId(id);
          }
          // 设置 Thread ID
          if (threadId) {
            builder = builder.setThreadId(threadId);
          }
          // 获取单元格
          const range = worksheet.getRange(cell);
          // 添加批注
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
    const historyApi = setupCellHistory(univerAPI, worksheet, {
      onChange: (record) => onCellChangeRef.current?.(record),
      onSelectionChange: (cell, row, column) =>
        onSelectionChangeRef.current?.(cell, row, column),
    });
    cellHistoryApiRef.current = historyApi;

    // 13.6 查找对话框限制在表格容器内（Univer 默认挂 body + 按视口拖拽）
    let disposeFindDialogConstraint: (() => void) | undefined;
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
    let disposeCommentContextMenuGuard: (() => void) | undefined;
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
    }
    // 14. 初始化完成
    const renderMs = Math.round(performance.now() - renderStartedAt);
    onReady?.({ univerAPI, workbook, worksheet, renderMs });

    // 15. 销毁
    return () => {
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
        historyApi.dispose();
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
    };
  }, []);

  // 注册icon图标
  useEffect(() => {
    const univerAPI = univerAPIRef.current;
    const worksheet = worksheetRef.current;
    if (univerAPI && worksheet) {
      registerAllIcons(univerAPI);
      customizeContextMenu(univerAPI, worksheet, defaultContextMenuItems, {
        onUploadAttachment: async (file, cell) => {
          if (onUploadAttachmentRef.current) {
            return onUploadAttachmentRef.current(file, cell);
          }
          return defaultUploadAttachment(file);
        },
        onAttachmentsChange: (cell, files) => {
          onAttachmentsChangeRef.current?.(cell, files);
        },
        onViewCellHistory: (cell) => {
          onViewCellHistoryRef.current?.(cell);
        },
        onViewDataTrace: (cell) => {
          onViewDataTraceRef.current?.(cell);
        },
        onDrillDown: () => {
          treeCollapseApiRef.current?.drillDown();
        },
        onDrillUp: () => {
          treeCollapseApiRef.current?.drillUp();
        },
        onQuickSearch: () => {
          openQuickSearch(univerAPI);
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
      });
    }
  }, [univerAPIRef.current, worksheetRef.current]);

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
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', overflow: 'hidden' }}
      />
    </div>
  );
});

Table.displayName = 'Table';

export { flattenTreeData, buildTreeColumns, buildTreeColumnGroups } from './tree';
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
} from './types';

export default Table;
