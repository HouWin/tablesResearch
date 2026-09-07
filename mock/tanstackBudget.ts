import { dispatchBudgetRequest } from '../server/budget-api';
import { BudgetError } from '../server/budget-service';

type MockRequest = {
  headers: Record<string, string | string[] | undefined>;
  body: Record<string, unknown>;
};
type MockResponse = {
  status: (status: number) => MockResponse;
  json: (value: unknown) => void;
};
const actions = [
  'project',
  'page',
  'position',
  'search',
  'locate',
  'write',
  'replay',
  'statistics',
  'range',
];
export default Object.fromEntries(
  actions.map((action) => [
    `POST /api/tanstack-budget/${action}`,
    (req: MockRequest, res: MockResponse) => {
      try {
        const data = dispatchBudgetRequest(
          String(req.headers['x-budget-session'] ?? ''),
          action,
          req.body ?? {},
        );
        res.json({ data });
      } catch (error) {
        res.status(error instanceof BudgetError ? error.status : 500).json({
          error: error instanceof Error ? error.message : '预算数据服务异常。',
        });
      }
    },
  ]),
);
