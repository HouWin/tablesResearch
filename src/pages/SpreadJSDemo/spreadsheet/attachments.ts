import { MAX_ATTACHMENT_SIZE_BYTES } from './constants';

export const ATTACHMENT_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,.pdf,.doc,.docx,.xls,.xlsx';
export const MAX_ATTACHMENTS_PER_CELL = 10;
export const MAX_ATTACHMENT_SIZE = MAX_ATTACHMENT_SIZE_BYTES;

const ATTACHMENT_EXTENSION_PATTERN =
  /\.(?:gif|jpe?g|png|webp|pdf|docx?|xlsx?)$/i;
const ACCEPTED_ATTACHMENT_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function isAcceptedAttachment(file: File) {
  return (
    ACCEPTED_ATTACHMENT_MIME_TYPES.has(file.type) ||
    ATTACHMENT_EXTENSION_PATTERN.test(file.name)
  );
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function canPreviewAttachment(mimeType: string, name: string) {
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    /\.pdf$/i.test(name)
  );
}

/**
 * SpreadJS CellButton 仅接受图片资源，因此将附件数量徽标封装为内联 SVG。
 * 图标不依赖表格主题，在浅色、汇总色和选中色背景上都保持足够对比度。
 */
export function attachmentIconDataUrl(count: number) {
  const badge =
    count > 1
      ? `<circle cx="18.5" cy="5.5" r="5.5" fill="#ef4444" stroke="#ffffff" stroke-width="1"/>
         <text x="18.5" y="6.2" text-anchor="middle" dominant-baseline="middle" font-size="7.5" font-family="Arial, sans-serif" font-weight="700" fill="#ffffff">${
           count > 9 ? '9+' : count
         }</text>`
      : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <rect x="1" y="1" width="22" height="22" rx="6" fill="#6548c8"/>
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="translate(3,3) scale(0.62)"/>
    ${badge}
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
