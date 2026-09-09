import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInitialRegionExpansion,
  INITIAL_PRODUCT_EXPANDED,
} from '../../SpreadJSDemo/spreadsheet/model';
import { createHttpBudgetGateway } from './gateway';
import { BudgetPageCache } from './page-cache';
import type { BudgetGateway, BudgetQuery, BudgetRow, Manifest } from './types';

export function initialQuery(mode: BudgetQuery['mode']): BudgetQuery {
  const subjects = [...createInitialRegionExpansion()].flatMap(([org, ids]) =>
    [...ids].map((id) => `${org}/${id.replace(/^subject:/, '')}`),
  );
  return {
    mode,
    drillPath: [],
    organizations: {
      all: mode === 'stress',
      ids: mode === 'regular' ? [...INITIAL_PRODUCT_EXPANDED] : [],
    },
    subjects: {
      all: mode === 'stress',
      ids: mode === 'regular' ? subjects : [],
    },
  };
}
export type QueryViewport = { first: number; last: number };
export function useBudgetData(providedGateway?: BudgetGateway) {
  const [gateway] = useState(
    () => providedGateway ?? createHttpBudgetGateway(),
  );
  const [request, setRequest] = useState<{
    query: BudgetQuery;
    viewport?: QueryViewport;
  }>(() => ({ query: initialQuery('regular') }));
  const { query, viewport } = request;
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [reload, setReload] = useState(0);
  const cache = useRef<BudgetPageCache>();
  const epoch = useRef(0);
  const transitioning = useRef(true);
  const active = useRef(true);
  const refresh = useCallback(() => {
    if (active.current) setVersion((value) => value + 1);
  }, []);
  const cancelPages = useCallback(() => {
    cache.current?.cancelPending();
  }, []);
  const setQuery = useCallback(
    (query: BudgetQuery, viewport?: QueryViewport) => {
      transitioning.current = true;
      cancelPages();
      setLoading(true);
      setError('');
      setRequest({ query, viewport });
    },
    [cancelPages],
  );
  useEffect(() => {
    active.current = true;
    const exit = (event: PageTransitionEvent) => {
      if (!event.persisted) gateway.dispose?.();
    };
    window.addEventListener('pagehide', exit);
    return () => {
      active.current = false;
      epoch.current += 1;
      cancelPages();
      window.removeEventListener('pagehide', exit);
      // StrictMode's effect replay keeps the same gateway alive.
      queueMicrotask(() => {
        if (!active.current) gateway.dispose?.();
      });
    };
  }, [cancelPages, gateway]);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++epoch.current;
    cancelPages();
    // Keep the committed snapshot visible until the replacement viewport is ready.
    // Clearing it here unmounts the grid and paints an empty/loading frame on every fold.
    transitioning.current = true;
    setLoading(true);
    setError('');
    let nextCache: BudgetPageCache | undefined;
    gateway
      .project(query, controller.signal)
      .then(async (result) => {
        controller.signal.throwIfAborted();
        nextCache = new BudgetPageCache(
          result,
          (...args) => gateway.page(...args),
          () => {
            if (cache.current === nextCache) refresh();
          },
        );
        const count = viewport ? viewport.last - viewport.first + 3 : 1;
        const first = viewport
          ? Math.max(0, Math.min(viewport.first, result.totalRows - count))
          : 0;
        const last = Math.min(result.totalRows - 1, first + count - 1);
        const offsets: number[] = [];
        for (
          let offset = Math.floor(first / result.pageSize) * result.pageSize;
          offset <= last;
          offset += result.pageSize
        )
          offsets.push(offset);
        await Promise.all(offsets.map((offset) => nextCache!.load(offset)));
        if (current !== epoch.current || controller.signal.aborted) return;
        cache.current = nextCache;
        transitioning.current = false;
        setManifest(result);
        setLoading(false);
        refresh();
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted || current !== epoch.current) return;
        setError(cause instanceof Error ? cause.message : '预算表加载失败。');
        setLoading(false);
      });
    return () => {
      controller.abort();
      nextCache?.cancelPending();
    };
  }, [query, viewport, reload, gateway, cancelPages, refresh]);

  const ensurePage = useCallback((index: number): Promise<BudgetRow[]> => {
    if (transitioning.current || !cache.current) return Promise.resolve([]);
    return cache.current.load(index);
  }, []);
  const loadViewport = useCallback((first: number, last: number) => {
    if (!transitioning.current) cache.current?.loadViewport(first, last);
  }, []);
  const rowAt = useCallback((index: number) => cache.current?.rowAt(index), []);
  const readRow = useCallback(
    async (index: number) => {
      const snapshot = cache.current;
      const rows = await ensurePage(index);
      if (!snapshot || snapshot !== cache.current || transitioning.current)
        throw new DOMException('已切换视图', 'AbortError');
      // Read from the resolved page even if another completion just evicted it.
      const row = rows[index % snapshot.manifest.pageSize];
      if (!row) throw new Error('该行尚未加载，请重试。');
      return row;
    },
    [ensurePage],
  );
  const invalidate = useCallback(
    async (preferredRow: number) => {
      epoch.current += 1;
      cancelPages();
      cache.current?.clear();
      await ensurePage(preferredRow);
    },
    [cancelPages, ensurePage],
  );
  return {
    gateway,
    query,
    setQuery,
    preserveScroll: Boolean(viewport),
    manifest,
    loading,
    error,
    pageError: cache.current?.error ?? '',
    version,
    rowAt,
    readRow,
    ensurePage,
    loadViewport,
    invalidate,
    cachedRows: cache.current?.cachedRows ?? 0,
    retryPages: () => cache.current?.retry(),
    retry: () => setReload((value) => value + 1),
  };
}
export type BudgetData = ReturnType<typeof useBudgetData>;
