import { createElement } from 'react';
import type { ETableAttachment, ETableAttachmentFile } from './types';
import { Modal, message } from 'antd';

/** 写入单元格 customMetaData 的 key */
export const ATTACHMENT_META_KEY = 'etableAttachments';

/**
 * 选择本地文件。
 */
export const pickFiles = (multiple = true, accept?: string): Promise<File[]> => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    if (accept) {
      input.accept = accept;
    }
    input.style.display = 'none';
    document.body.appendChild(input);
    input.onchange = () => {
      const files = Array.from(input.files || []);
      document.body.removeChild(input);
      resolve(files);
    };
    input.oncancel = () => {
      document.body.removeChild(input);
      resolve([]);
    };
    input.click();
  });
};

/**
 * 生成附件 ID。
 */
export const createAttachmentId = () => {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

/**
 * 默认上传：生成本地 blob URL（仅演示）。
 * 业务应通过 onUploadAttachment 换成真实上传。
 */
export const defaultUploadAttachment = async (file: File): Promise<ETableAttachmentFile> => {
  return {
    id: createAttachmentId(),
    name: file.name,
    url: URL.createObjectURL(file),
    size: file.size,
    mimeType: file.type || undefined,
    uploadedAt: new Date().toISOString(),
  };
};

/**
 * 读取单元格上的附件列表。
 */
export const getCellAttachments = (range: any): ETableAttachmentFile[] => {
  if (!range?.getCustomMetaData) {
    return [];
  }
  try {
    const meta = range.getCustomMetaData() || {};
    const list = meta[ATTACHMENT_META_KEY];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

/**
 * 用 Univer Note 角标展示附件摘要（有 note API 时才生效）。
 */
export const syncAttachmentNote = (range: any, files: ETableAttachmentFile[]) => {
  try {
    if (!files.length) {
      if (typeof range.deleteNote === 'function') {
        const note = range.getNote?.();
        const text =
          typeof note === 'string'
            ? note
            : note?.note;
        if (typeof text === 'string' && text.startsWith('📎')) {
          range.deleteNote();
        }
      }
      return;
    }

    if (typeof range.createOrUpdateNote === 'function') {
      range.createOrUpdateNote({
        note: files.map((file) => `📎 ${file.name}`).join('\n'),
        width: 240,
        height: Math.min(40 + files.length * 22, 160),
        show: false,
      });
    }
  } catch (error) {
    console.warn('[ETable] sync attachment note failed', error);
  }
};

/**
 * 写入单元格附件列表到 customMetaData，并同步备注角标。
 */
export const setCellAttachments = (
  range: any,
  files: ETableAttachmentFile[],
) => {
  if (!range?.setCustomMetaData) {
    console.warn('[ETable] setCustomMetaData unavailable');
    return;
  }

  const prev = range.getCustomMetaData?.() || {};
  range.setCustomMetaData({
    ...prev,
    [ATTACHMENT_META_KEY]: files,
  });

  syncAttachmentNote(range, files);
};

/**
 * 向单元格追加附件。
 */
export const appendCellAttachments = (
  range: any,
  incoming: ETableAttachmentFile[],
): ETableAttachmentFile[] => {
  const current = getCellAttachments(range);
  const next = [...current, ...incoming];
  setCellAttachments(range, next);
  return next;
};

/**
 * 删除单元格全部附件。
 */
export const clearCellAttachments = (range: any) => {
  setCellAttachments(range, []);
};

/**
 * 按 id 删除单个附件。
 */
export const removeCellAttachment = (range: any, attachmentId: string) => {
  const next = getCellAttachments(range).filter((item) => item.id !== attachmentId);
  setCellAttachments(range, next);
  return next;
};

/**
 * 格式化文件大小。
 */
export const formatFileSize = (size?: number) => {
  if (size === undefined || size === null || Number.isNaN(size)) {
    return '';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

/**
 * 弹窗查看单元格附件。
 */
export const showAttachmentsModal = (cell: string, files: ETableAttachmentFile[]) => {
  if (!files.length) {
    message.info(`单元格 ${cell} 暂无附件`);
    return;
  }

  Modal.info({
    title: `单元格附件（${cell}）`,
    width: 480,
    okText: '关闭',
    content: createElement(
      'div',
      { style: { maxHeight: 360, overflow: 'auto' } },
      files.map((file) =>
        createElement(
          'div',
          {
            key: file.id,
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '8px 0',
              borderBottom: '1px solid #f0f0f0',
            },
          },
          createElement(
            'div',
            { style: { minWidth: 0 } },
            createElement(
              'div',
              { style: { fontWeight: 500, wordBreak: 'break-all' } },
              `📎 ${file.name}`,
            ),
            createElement(
              'div',
              { style: { color: '#8c8c8c', fontSize: 12 } },
              [formatFileSize(file.size), file.mimeType].filter(Boolean).join(' · '),
            ),
          ),
          createElement(
            'a',
            { href: file.url, target: '_blank', rel: 'noreferrer', download: file.name },
            '下载',
          ),
        ),
      ),
    ),
  });
};

/**
 * 交互式：选文件 → 上传 → 挂到单元格。
 */
export const uploadAndAttachToCell = async (params: {
  range: any;
  cell: string;
  onUpload?: (file: File, cell: string) => Promise<ETableAttachmentFile | ETableAttachmentFile[]>;
  accept?: string;
  multiple?: boolean;
}): Promise<ETableAttachmentFile[]> => {
  const { range, cell, onUpload, accept, multiple = true } = params;
  if (!range) {
    return [];
  }

  const picked = await pickFiles(multiple, accept);
  if (!picked.length) {
    return getCellAttachments(range);
  }

  const uploaded: ETableAttachmentFile[] = [];
  for (const file of picked) {
    try {
      if (onUpload) {
        const result = await onUpload(file, cell);
        if (Array.isArray(result)) {
          uploaded.push(...result);
        } else if (result) {
          uploaded.push(result);
        }
      } else {
        uploaded.push(await defaultUploadAttachment(file));
      }
    } catch (error) {
      console.error('[ETable] upload attachment failed', error);
      message.error(`上传失败：${file.name}`);
    }
  }

  if (!uploaded.length) {
    return getCellAttachments(range);
  }

  const next = appendCellAttachments(range, uploaded);
  message.success(`已添加 ${uploaded.length} 个附件到 ${cell}`);
  return next;
};

/**
 * 初始化 props.attachments 到工作表。
 */
export const applyInitialAttachments = (
  worksheet: any,
  attachments: ETableAttachment[] = [],
) => {
  if (!worksheet || !attachments.length) {
    return;
  }

  attachments.forEach((item) => {
    if (!item?.cell || !item.files?.length) {
      return;
    }
    try {
      const range = worksheet.getRange(item.cell);
      setCellAttachments(range, item.files);
    } catch (error) {
      console.warn('[ETable] apply attachment failed', item, error);
    }
  });
};
