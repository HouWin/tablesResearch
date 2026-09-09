import type { BudgetGateway, BudgetRow, Manifest, Page } from './types';

export const CACHE_PAGES = 10;
export const PAGE_CONCURRENCY = 3;
type Priority = 'required' | 'viewport' | 'prefetch';
type PendingPage = {
  offset: number;
  priority: Priority;
  controller: AbortController;
  started: boolean;
  promise: Promise<BudgetRow[]>;
  resolve: (rows: BudgetRow[]) => void;
  reject: (error: unknown) => void;
};
const priorities: Record<Priority, number> = {
  required: 0,
  viewport: 1,
  prefetch: 2,
};
const cancelled = () => new DOMException('分页请求已取消', 'AbortError');

/** One projection owns its cache, queue and failures; no React or renderer state. */
export class BudgetPageCache {
  private pages = new Map<number, BudgetRow[]>();
  private pending = new Map<number, PendingPage>();
  private failures = new Map<number, Error>();
  private running = 0;

  constructor(
    readonly manifest: Manifest,
    private fetchPage: BudgetGateway['page'],
    private onChange: () => void,
  ) {}

  get error() {
    const first = this.failures.entries().next().value;
    return first
      ? `第 ${first[0] + 1}–${Math.min(
          first[0] + this.manifest.pageSize,
          this.manifest.totalRows,
        )} 行加载失败：${first[1].message}`
      : '';
  }

  get cachedRows() {
    let count = 0;
    for (const page of this.pages.values()) count += page.length;
    return count;
  }

  rowAt(index: number) {
    const size = this.manifest.pageSize;
    return this.pages.get(Math.floor(index / size) * size)?.[index % size];
  }

  load(index: number, priority: Priority = 'required'): Promise<BudgetRow[]> {
    if (index < 0 || index >= this.manifest.totalRows)
      return Promise.resolve([]);
    const offset =
      Math.floor(index / this.manifest.pageSize) * this.manifest.pageSize;
    const cached = this.pages.get(offset);
    if (cached) {
      this.pages.delete(offset);
      this.pages.set(offset, cached);
      return Promise.resolve(cached);
    }
    const pending = this.pending.get(offset);
    if (pending) {
      if (priorities[priority] < priorities[pending.priority])
        pending.priority = priority;
      return pending.promise;
    }
    // A different page succeeding must never retry a failed page in a render loop.
    const failure = this.failures.get(offset);
    if (failure) return Promise.reject(failure);
    let resolve!: PendingPage['resolve'];
    let reject!: PendingPage['reject'];
    const promise = new Promise<BudgetRow[]>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    this.pending.set(offset, {
      offset,
      priority,
      controller: new AbortController(),
      started: false,
      promise,
      resolve,
      reject,
    });
    this.pump();
    return promise;
  }

  /** Drop obsolete scroll work. Explicit reads for editing/selection retain priority. */
  loadViewport(first: number, last: number) {
    const { pageSize, totalRows } = this.manifest;
    if (!totalRows) return;
    const start = Math.floor(Math.max(0, first) / pageSize) * pageSize;
    const end = Math.floor(Math.min(totalRows - 1, last) / pageSize) * pageSize;
    const wanted = new Set<number>();
    for (let offset = start; offset <= end + pageSize; offset += pageSize)
      if (offset < totalRows) wanted.add(offset);
    for (const request of this.pending.values())
      if (request.priority !== 'required' && !wanted.has(request.offset))
        this.cancel(request);
    for (const offset of wanted)
      void this.load(offset, offset > end ? 'prefetch' : 'viewport').catch(
        () => {},
      );
    this.pump();
  }

  retry() {
    this.failures.clear();
    this.onChange();
  }

  cancelPending() {
    for (const request of this.pending.values()) this.cancel(request);
  }

  clear() {
    this.cancelPending();
    this.pages.clear();
    this.failures.clear();
    this.onChange();
  }

  private cancel(request: PendingPage) {
    this.pending.delete(request.offset);
    request.controller.abort();
    request.reject(cancelled());
  }

  private validate(page: Page, offset: number) {
    if (
      page.projectionId !== this.manifest.id ||
      page.offset !== offset ||
      !Array.isArray(page.rows) ||
      page.rows.length !==
        Math.min(this.manifest.pageSize, this.manifest.totalRows - offset)
    )
      throw new Error('分页响应不完整或视图已过期，请重试。');
  }

  private pump() {
    while (this.running < PAGE_CONCURRENCY) {
      let next: PendingPage | undefined;
      for (const request of this.pending.values())
        if (
          !request.started &&
          (!next || priorities[request.priority] < priorities[next.priority])
        )
          next = request;
      if (!next) break;
      next.started = true;
      this.running++;
      void this.run(next);
    }
  }

  private async run(request: PendingPage) {
    const { offset, controller } = request;
    try {
      const page = await this.fetchPage(
        this.manifest.id,
        offset,
        controller.signal,
      );
      controller.signal.throwIfAborted();
      this.validate(page, offset);
      this.pages.set(offset, page.rows);
      while (this.pages.size > CACHE_PAGES)
        this.pages.delete(this.pages.keys().next().value!);
      this.failures.delete(offset);
      this.onChange();
      request.resolve(page.rows);
    } catch (cause) {
      if (!controller.signal.aborted) {
        this.failures.set(
          offset,
          cause instanceof Error ? cause : new Error('该页加载失败，请重试。'),
        );
        this.onChange();
      }
      request.reject(cause);
    } finally {
      if (this.pending.get(offset) === request) this.pending.delete(offset);
      this.running--;
      this.pump();
    }
  }
}
