import type { BudgetGateway } from './types';

export class GatewayError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
export function createHttpBudgetGateway(
  sessionId = crypto.randomUUID(),
): BudgetGateway {
  async function request<T>(
    action: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const response = await fetch(`/api/tanstack-budget/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Budget-Session': sessionId,
      },
      body: JSON.stringify(body),
      signal,
    });
    let result: { error?: string; data: T };
    try {
      result = await response.json();
    } catch {
      throw new GatewayError(
        '预算数据服务未启动，请启动项目服务后重试。',
        response.status,
      );
    }
    if (!response.ok)
      throw new GatewayError(
        result.error ?? '数据请求失败，请重试。',
        response.status,
      );
    return result.data;
  }
  return {
    project: (query, signal) => request('project', { query }, signal),
    page: (id, offset, signal) => request('page', { id, offset }, signal),
    search: (mode, query, index, signal) =>
      request('search', { mode, query, index }, signal),
    locate: (mode, dimension, signal) =>
      request('locate', { mode, dimension }, signal),
    position: (id, recordId, signal) =>
      request('position', { id, recordId }, signal),
    write: (id, writes, source) => request('write', { id, writes, source }),
    replay: (mode, transaction, direction) =>
      request('replay', {
        mode,
        transaction: { id: transaction.id },
        direction,
      }),
    statistics: (id, range, columns, signal) =>
      request('statistics', { id, range, columns }, signal),
    range: (id, range, columns, offset, signal) =>
      request('range', { id, range, columns, offset }, signal),
  };
}
