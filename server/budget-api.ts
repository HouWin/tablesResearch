import { BudgetError, BudgetService } from './budget-service';
import type {
  BudgetQuery,
  CellRange,
  CellWrite,
  Transaction,
} from '../src/pages/TanStackBudget/core/types';
import type { BusinessCellDimension } from '../src/pages/SpreadJSDemo/spreadsheet/business-cell-coordinate';

const sessions = new Map<string, { service: BudgetService; touched: number }>();
export function dispatchBudgetRequest(
  sessionId: string,
  action: string,
  body: Record<string, unknown>,
) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new BudgetError('请求体必须是对象。');
  if (!/^[\w-]{8,80}$/.test(sessionId))
    throw new BudgetError('缺少有效的会话标识。');
  let session = sessions.get(sessionId);
  if (!session) {
    for (const [id, item] of sessions)
      if (Date.now() - item.touched > 2 * 60 * 60 * 1000) sessions.delete(id);
    if (sessions.size >= 100)
      throw new BudgetError('演示服务繁忙，请稍后再试。', 503);
    session = { service: new BudgetService(), touched: Date.now() };
    sessions.set(sessionId, session);
  }
  session.touched = Date.now();
  const service = session.service;
  const mode = body.mode as BudgetQuery['mode'];
  if (
    ['search', 'locate', 'replay'].includes(action) &&
    !['regular', 'stress'].includes(mode)
  )
    throw new BudgetError('数据模式无效。');
  switch (action) {
    case 'project':
      return service.project(body.query as BudgetQuery);
    case 'page':
      return service.page(String(body.id), Number(body.offset));
    case 'position':
      return service.position(String(body.id), String(body.recordId));
    case 'search':
      return service.search(
        mode,
        String(body.query ?? ''),
        Number(body.index) || 0,
      );
    case 'locate':
      return service.locate(mode, body.dimension as BusinessCellDimension);
    case 'write':
      return service.write(
        String(body.id),
        body.writes as CellWrite[],
        String(body.source ?? '编辑'),
      );
    case 'replay': {
      if (body.direction !== 'undo' && body.direction !== 'redo')
        throw new BudgetError('无效的历史操作。');
      return service.replay(
        mode,
        body.transaction as Transaction,
        body.direction,
      );
    }
    case 'statistics':
      return service.statistics(
        String(body.id),
        body.range as CellRange,
        body.columns as number[],
      );
    case 'range':
      return service.range(
        String(body.id),
        body.range as CellRange,
        body.columns as number[],
        Number(body.offset),
      );
    default:
      throw new BudgetError('接口不存在。', 404);
  }
}
