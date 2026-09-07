import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createInitialRegionExpansion,
  INITIAL_PRODUCT_EXPANDED,
} from '../../SpreadJSDemo/spreadsheet/model';
import { createHttpBudgetGateway } from './gateway';
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
const CACHE_PAGES = 10;
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
  const [pageError, setPageError] = useState('');
  const [version, setVersion] = useState(0);
  const [reload, setReload] = useState(0);
  const pages = useRef(new Map<number, BudgetRow[]>());
  const requests = useRef(
    new Map<
      number,
      { controller: AbortController; promise: Promise<BudgetRow[]> }
    >(),
  );
  const epoch = useRef(0);
  const manifestRef = useRef<Manifest | null>(null);
  const transitioning = useRef(true);
  const active = useRef(true);
  const refresh = useCallback(() => {
    if (active.current) setVersion((value) => value + 1);
  }, []);
  const cancelPages = useCallback(() => {
    requests.current.forEach(({ controller }) => controller.abort());
    requests.current.clear();
  }, []);
  const setQuery = useCallback(
    (query: BudgetQuery, viewport?: QueryViewport) => {
      transitioning.current = true;
      setLoading(true);
      setError('');
      setRequest({ query, viewport });
    },
    [],
  );
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      epoch.current += 1;
      cancelPages();
    };
  }, [cancelPages]);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++epoch.current;
    cancelPages();
    // Keep the committed snapshot visible until the replacement viewport is ready.
    // Clearing it here unmounts the grid and paints an empty/loading frame on every fold.
    transitioning.current = true;
    setLoading(true);
    setError('');
    setPageError('');
    gateway
      .project(query, controller.signal)
      .then(async (result) => {
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
        const nextPages = await Promise.all(
          offsets.map((offset) =>
            gateway.page(result.id, offset, controller.signal),
          ),
        );
        if (current !== epoch.current || controller.signal.aborted) return;
        pages.current = new Map(
          nextPages.map((page) => [page.offset, page.rows]),
        );
        manifestRef.current = result;
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
    return () => controller.abort();
  }, [query, viewport, reload, gateway, cancelPages, refresh]);

  const ensurePage = useCallback(
    (index: number): Promise<BudgetRow[]> => {
      const currentManifest = manifestRef.current;
      if (
        transitioning.current ||
        !currentManifest ||
        index < 0 ||
        index >= currentManifest.totalRows
      )
        return Promise.resolve([]);
      const offset =
        Math.floor(index / currentManifest.pageSize) * currentManifest.pageSize;
      const cached = pages.current.get(offset);
      if (cached) {
        pages.current.delete(offset);
        pages.current.set(offset, cached);
        return Promise.resolve(cached);
      }
      const pending = requests.current.get(offset);
      if (pending) return pending.promise;
      const controller = new AbortController();
      const current = epoch.current;
      const promise = gateway
        .page(currentManifest.id, offset, controller.signal)
        .then((page) => {
          if (
            current !== epoch.current ||
            controller.signal.aborted ||
            manifestRef.current?.id !== page.projectionId
          )
            throw new DOMException('已切换视图', 'AbortError');
          pages.current.set(offset, page.rows);
          while (pages.current.size > CACHE_PAGES)
            pages.current.delete(pages.current.keys().next().value!);
          setPageError('');
          refresh();
          return page.rows;
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted && current === epoch.current)
            setPageError(
              cause instanceof Error ? cause.message : '该页加载失败。',
            );
          throw cause;
        })
        .finally(() => {
          if (requests.current.get(offset)?.controller === controller)
            requests.current.delete(offset);
        });
      requests.current.set(offset, { controller, promise });
      return promise;
    },
    [gateway, refresh],
  );
  const rowAt = useCallback((index: number) => {
    const size = manifestRef.current?.pageSize ?? 200;
    return pages.current.get(Math.floor(index / size) * size)?.[index % size];
  }, []);
  const readRow = useCallback(
    async (index: number) => {
      await ensurePage(index);
      const row = rowAt(index);
      if (!row) throw new Error('该行尚未加载，请重试。');
      return row;
    },
    [ensurePage, rowAt],
  );
  const invalidate = useCallback(
    async (preferredRow: number) => {
      epoch.current += 1;
      cancelPages();
      pages.current.clear();
      refresh();
      await ensurePage(preferredRow);
    },
    [cancelPages, ensurePage, refresh],
  );
  return {
    gateway,
    query,
    setQuery,
    preserveScroll: Boolean(viewport),
    manifest,
    loading,
    error,
    pageError,
    version,
    rowAt,
    readRow,
    ensurePage,
    invalidate,
    cachedRows: [...pages.current.values()].reduce(
      (sum, rows) => sum + rows.length,
      0,
    ),
    retryPages: () => {
      setPageError('');
      refresh();
    },
    retry: () => setReload((value) => value + 1),
  };
}
export type BudgetData = ReturnType<typeof useBudgetData>;
