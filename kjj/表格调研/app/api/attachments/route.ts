import { ensureSchema, getBindings } from "../../../db/runtime";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const cellKey = String(formData.get("cellKey") ?? "").trim();
    if (!(file instanceof File) || !cellKey) return Response.json({ error: "file and cellKey are required" }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) return Response.json({ error: "文件大小不能超过 8 MB" }, { status: 413 });

    const { DB, ATTACHMENTS } = getBindings();
    await ensureSchema(DB);
    const id = crypto.randomUUID();
    const objectKey = `cell-attachments/${cellKey.replace(/[^a-zA-Z0-9_-]/g, "_")}/${id}`;
    const createdAt = Date.now();

    await ATTACHMENTS.put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { filename: file.name, cellKey },
    });
    await DB.prepare("INSERT INTO attachments (id, cell_key, filename, content_type, size, object_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, cellKey, file.name, file.type || "application/octet-stream", file.size, objectKey, createdAt)
      .run();

    return Response.json({ attachment: { id, filename: file.name, contentType: file.type, size: file.size, createdAt } }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to upload attachment" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  try {
    const { DB, ATTACHMENTS } = getBindings();
    await ensureSchema(DB);
    const metadata = await DB.prepare("SELECT filename, content_type AS contentType, object_key AS objectKey FROM attachments WHERE id = ?")
      .bind(id)
      .first<{ filename: string; contentType: string; objectKey: string }>();
    if (!metadata) return Response.json({ error: "Attachment not found" }, { status: 404 });
    const object = await ATTACHMENTS.get(metadata.objectKey);
    if (!object) return Response.json({ error: "Attachment bytes not found" }, { status: 404 });

    return new Response(object.body, {
      headers: {
        "content-type": metadata.contentType,
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(metadata.filename)}`,
        "cache-control": "private, max-age=60",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to download attachment" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim();
  if (!id) return Response.json({ error: "id is required" }, { status: 400 });

  try {
    const { DB, ATTACHMENTS } = getBindings();
    await ensureSchema(DB);
    const metadata = await DB.prepare("SELECT object_key AS objectKey FROM attachments WHERE id = ?")
      .bind(id)
      .first<{ objectKey: string }>();
    if (!metadata) return Response.json({ error: "Attachment not found" }, { status: 404 });
    await ATTACHMENTS.delete(metadata.objectKey);
    await DB.prepare("DELETE FROM attachments WHERE id = ?").bind(id).run();
    return Response.json({ deleted: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete attachment" }, { status: 500 });
  }
}
