/** 单个附件的产品限制：5 MiB。 */
export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024;

/** 超大选区统计的同步扫描上限，避免长时间占用主线程。 */
export const MAX_SELECTION_INSPECTION_CELLS = 200_000;
