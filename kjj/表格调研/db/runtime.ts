import { env } from "cloudflare:workers";

type AppBindings = {
  DB: D1Database;
  ATTACHMENTS: R2Bucket;
};

export function getBindings() {
  const bindings = env as unknown as AppBindings;
  if (!bindings.DB) throw new Error("D1 binding DB is unavailable");
  if (!bindings.ATTACHMENTS) throw new Error("R2 binding ATTACHMENTS is unavailable");
  return bindings;
}

export async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS cell_comments (
      cell_key TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS cell_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cell_key TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_cell_history_cell_key_created_at
      ON cell_history(cell_key, created_at)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      cell_key TEXT NOT NULL,
      filename TEXT NOT NULL,
      content_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      object_key TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_attachments_cell_key_created_at
      ON attachments(cell_key, created_at)`),
  ]);
}
