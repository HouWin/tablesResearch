import { forwardRef, useEffect, useImperativeHandle, useRef, } from 'react';
import { createUniver, LocaleType, mergeLocales, } from '@univerjs/presets';
import { UniverSheetsAdvancedPreset } from '@univerjs/preset-sheets-advanced';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import { UniverSheetsThreadCommentPreset } from '@univerjs/preset-sheets-thread-comment';
import { UniverSheetsNotePreset } from '@univerjs/preset-sheets-note';
import { createColumnOutlines, createRowOutlines, getColumnOutlines, getRowOutlines, setOutlineCollapsed, } from './outline';
import { renderColumnWidths, renderData, renderHeader, renderMerges, renderRowHeights } from './renderer';
import { flattenTreeData } from './tree';
import { customizeContextMenu, defaultContextMenuItems, NATIVE_CONTEXT_MENU_HIDE_CONFIG } from './contextMenu';
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
import type { ETableAttachmentFile, ETableProps, ETableRef } from './types';
import UniverPresetSheetsThreadCommentZhCN from '@univerjs/preset-sheets-thread-comment/locales/zh-CN';
import UniverPresetSheetsAdvancedZhCN from '@univerjs/preset-sheets-advanced/locales/zh-CN';
import UniverPresetSheetsCoreZhCN from '@univerjs/preset-sheets-core/locales/zh-CN';
import UniverPresetSheetsNoteZhCN from '@univerjs/preset-sheets-note/locales/zh-CN';
import '@univerjs/preset-sheets-advanced/lib/index.css';
import '@univerjs/preset-sheets-core/lib/index.css';
import '@univerjs/preset-sheets-thread-comment/lib/index.css';
import '@univerjs/preset-sheets-note/lib/index.css';


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
    options = {},
    comments = [],
    attachments = [],
    onUploadAttachment,
    onAttachmentsChange,
    onReady,
  } = props;

  const onUploadAttachmentRef = useRef(onUploadAttachment);
  const onAttachmentsChangeRef = useRef(onAttachmentsChange);
  onUploadAttachmentRef.current = onUploadAttachment;
  onAttachmentsChangeRef.current = onAttachmentsChange;

  /**
   * 优先使用 treeData 自动展平；
   * 否则回退到外部传入的 columns / rows / merges / rowGroups / columnGroups。
   */
  const flattened = treeData && treeConfig ? flattenTreeData(treeData, treeConfig) : null;
  const columns = flattened?.columns ?? propsColumns;
  const rows = flattened?.rows ?? propsRows;
  const merges = flattened?.merges ?? propsMerges;
  const rowGroups = flattened?.rowGroups ?? propsRowGroups;
  const columnGroups = flattened?.columnGroups?.length
    ? flattened.columnGroups
    : propsColumnGroups;
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
        ),
      },
      // Preset
      presets: [
        // Core：顺带预隐藏一批常见原生右键命令（自定义菜单注册后还会再扫一遍）
        UniverSheetsCorePreset({
          container: containerRef.current,
          menu: NATIVE_CONTEXT_MENU_HIDE_CONFIG,
        }),
        // Advanced
        UniverSheetsAdvancedPreset(),
        // Thread Comment
        UniverSheetsThreadCommentPreset(),
        // Note（附件角标）
        UniverSheetsNotePreset(),
      ],
    });
    // 保存 Univer API
    univerAPIRef.current = univerAPI;
    // 创建 Workbook
    const workbook = univerAPI.createWorkbook({ name });
    workbookRef.current = workbook;
    // 获取 Worksheet
    const worksheet = workbook.getActiveSheet();
    if (!worksheet) {
      return;
    }
    worksheetRef.current = worksheet;
    // 1. 网格线
    worksheet.setHiddenGridlines(!showGridLines);
    // 2. 渲染业务多级表头
    const { leafColumns, maxDepth } = renderHeader(worksheet, columns);
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
    renderData(worksheet, rows, leafColumns, maxDepth);
    // 7. 设置数据行高
    if (rows.length) {
      renderRowHeights(worksheet, maxDepth, rows.length, defaultRowHeight);
    }
    // 8. 自定义合并（row 相对于数据区，需加上表头深度）
    renderMerges(worksheet, merges, maxDepth);
    // 9. 行分组
    createRowOutlines(worksheet, rowGroups, maxDepth);
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
    // 13.5 注册自定义右键菜单
    if (enableContextMenu && contextMenuItems && contextMenuItems.length) {
      try {
        customizeContextMenu(univerAPI, worksheet, contextMenuItems, {
          onUploadAttachment: async (file, cell) => {
            if (onUploadAttachmentRef.current) {
              return onUploadAttachmentRef.current(file, cell);
            }
            return defaultUploadAttachment(file);
          },
          onAttachmentsChange: (cell, files) => {
            onAttachmentsChangeRef.current?.(cell, files);
          },
        });
      } catch (error) {
        console.warn('[Table] register context menu failed', error);
      }
    }
    // 14. 初始化完成
    onReady?.({ univerAPI, workbook, worksheet });

    // 15. 销毁
    return () => {
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
      });
    }
  }, [univerAPIRef.current, worksheetRef.current]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 600 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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
} from './types';

export default Table;
