import { useEffect, useRef, useState } from 'react';
import type { CellAttachment } from '../../SpreadJSDemo/spreadsheet/model';
import {
  isAcceptedAttachment,
  MAX_ATTACHMENTS_PER_CELL,
  MAX_ATTACHMENT_SIZE,
} from '../../SpreadJSDemo/spreadsheet/attachments';

/** Session annotations use business keys and own their object URL lifecycle. */
export function useCellAnnotations(
  selectedKey: string,
  notify: (message: string, error?: boolean) => void,
) {
  const [comments, setComments] = useState(new Map<string, string>());
  const [attachments, setAttachments] = useState(
    new Map<string, CellAttachment[]>(),
  );
  const attachmentRef = useRef(attachments);
  attachmentRef.current = attachments;
  useEffect(
    () => () => {
      attachmentRef.current.forEach((files) =>
        files.forEach((file) => URL.revokeObjectURL(file.objectUrl)),
      );
    },
    [],
  );
  const saveComment = (text: string) => {
    if (!selectedKey) return;
    setComments((current) => {
      const next = new Map(current);
      if (text.trim()) next.set(selectedKey, text.trim());
      else next.delete(selectedKey);
      return next;
    });
    notify(text.trim() ? '批注已保存。' : '批注已删除。');
  };
  const addAttachments = (files: File[]) => {
    if (!selectedKey) return;
    const previous = attachments.get(selectedKey) ?? [];
    const accepted: CellAttachment[] = [];
    const signatures = new Set(
      previous.map((file) => `${file.name}/${file.size}/${file.lastModified}`),
    );
    const rejected: string[] = [];
    for (const file of files) {
      const signature = `${file.name}/${file.size}/${file.lastModified}`;
      if (
        !isAcceptedAttachment(file) ||
        file.size > MAX_ATTACHMENT_SIZE ||
        previous.length + accepted.length >= MAX_ATTACHMENTS_PER_CELL ||
        signatures.has(signature)
      ) {
        rejected.push(file.name);
        continue;
      }
      signatures.add(signature);
      accepted.push({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        mimeType: file.type,
        objectUrl: URL.createObjectURL(file),
        lastModified: file.lastModified,
        createdAt: Date.now(),
      });
    }
    setAttachments((current) =>
      new Map(current).set(selectedKey, [...previous, ...accepted]),
    );
    notify(
      rejected.length
        ? `已添加 ${accepted.length} 个附件；${rejected.length} 个因类型、大小、数量限制或重复被跳过。`
        : `已添加 ${accepted.length} 个附件。`,
      Boolean(rejected.length),
    );
  };
  const removeAttachment = (id: string) => {
    const files = attachments.get(selectedKey) ?? [];
    const removed = files.find((file) => file.id === id);
    if (removed) URL.revokeObjectURL(removed.objectUrl);
    setAttachments((current) =>
      new Map(current).set(
        selectedKey,
        files.filter((file) => file.id !== id),
      ),
    );
  };
  return {
    comments,
    attachments,
    saveComment,
    addAttachments,
    removeAttachment,
  };
}
