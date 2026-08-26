import { ensureSchema, getBindings } from "../../../db/runtime";

type MutationPayload = {
  action?: "set-comment" | "delete-comment" | "append-history";
  cellKey?: string;
  content?: string;
  oldValue?: unknown;
  newValue?: unknown;
};

function serializeValue(value: unknown) {
  if (value == null) return null;
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const mode = searchParams.get("mode");
  const cellKey = searchParams.get("cellKey")?.trim();
  if (mode === "comment-markers") {
    try {
      const { DB } = getBindings();
      await ensureSchema(DB);
      const result = await DB.prepare("SELECT cell_key AS cellKey, content, updated_at AS updatedAt FROM cell_comments ORDER BY updated_at DESC")
        .all();
      return Response.json({ comments: result.results });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Unable to load comment markers" }, { status: 500 });
    }
  }
  if (!cellKey) return Response.json({ error: "cellKey is required" }, { status: 400 });

  try {
    const { DB } = getBindings();
    await ensureSchema(DB);
    const [comment, historyResult, attachmentResult] = await Promise.all([
      DB.prepare("SELECT cell_key AS cellKey, content, updated_at AS updatedAt FROM cell_comments WHERE cell_key = ?")
        .bind(cellKey)
        .first(),
      DB.prepare("SELECT id, old_value AS oldValue, new_value AS newValue, created_at AS createdAt FROM cell_history WHERE cell_key = ? ORDER BY created_at DESC, id DESC LIMIT 30")
        .bind(cellKey)
        .all(),
      DB.prepare("SELECT id, filename, content_type AS contentType, size, created_at AS createdAt FROM attachments WHERE cell_key = ? ORDER BY created_at DESC")
        .bind(cellKey)
        .all(),
    ]);

    return Response.json({ comment: comment ?? null, history: historyResult.results, attachments: attachmentResult.results });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to load cell state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as MutationPayload;
    const cellKey = payload.cellKey?.trim();
    if (!cellKey || !payload.action) return Response.json({ error: "action and cellKey are required" }, { status: 400 });

    const { DB } = getBindings();
    await ensureSchema(DB);
    const now = Date.now();

    if (payload.action === "set-comment") {
      const content = payload.content?.trim() ?? "";
      if (!content) return Response.json({ error: "content is required" }, { status: 400 });
      await DB.prepare(`INSERT INTO cell_comments (cell_key, content, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(cell_key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`)
        .bind(cellKey, content, now)
        .run();
      return Response.json({ comment: { cellKey, content, updatedAt: now } });
    }

    if (payload.action === "delete-comment") {
      await DB.prepare("DELETE FROM cell_comments WHERE cell_key = ?").bind(cellKey).run();
      return Response.json({ deleted: true });
    }

    await DB.prepare("INSERT INTO cell_history (cell_key, old_value, new_value, created_at) VALUES (?, ?, ?, ?)")
      .bind(cellKey, serializeValue(payload.oldValue), serializeValue(payload.newValue), now)
      .run();
    return Response.json({ history: { cellKey, oldValue: payload.oldValue, newValue: payload.newValue, createdAt: now } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update cell state" }, { status: 500 });
  }
}
