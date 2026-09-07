import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { dispatchBudgetRequest } from './budget-api';
import { BudgetError } from './budget-service';

const directory = resolve(process.cwd(), 'dist');
const port = Number(process.env.BUDGET_PORT || 8010);
const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    if (url.pathname.startsWith('/api/tanstack-budget/')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      if (req.method !== 'POST') {
        res.writeHead(405);
        res.end(JSON.stringify({ error: '请使用 POST 请求。' }));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > 8 * 1024 * 1024)
          throw new BudgetError('请求超过 8 MiB 限制。', 413);
        chunks.push(bytes);
      }
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
      } catch {
        throw new BudgetError('请求不是有效 JSON。');
      }
      const data = dispatchBudgetRequest(
        String(req.headers['x-budget-session'] || ''),
        url.pathname.split('/').at(-1)!,
        body,
      );
      res.end(JSON.stringify({ data }));
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end();
      return;
    }
    let path = resolve(directory, `.${decodeURIComponent(url.pathname)}`);
    if (path !== directory && !path.startsWith(directory + sep))
      throw new BudgetError('路径无效。', 403);
    try {
      if (!(await stat(path)).isFile()) path = resolve(directory, 'index.html');
    } catch {
      if (extname(path)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      path = resolve(directory, 'index.html');
    }
    const data = await readFile(path);
    res.setHeader(
      'Content-Type',
      contentTypes[extname(path)] || 'application/octet-stream',
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    res.statusCode = error instanceof BudgetError ? error.status : 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.message : '服务暂时不可用。',
      }),
    );
  }
}).listen(port, '127.0.0.1', () =>
  console.log(`Budget server: http://127.0.0.1:${port}/tanstack-budget`),
);
