import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cellComments = sqliteTable("cell_comments", {
  cellKey: text("cell_key").primaryKey(),
  content: text("content").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const cellHistory = sqliteTable(
  "cell_history",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cellKey: text("cell_key").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("idx_cell_history_cell_key_created_at").on(table.cellKey, table.createdAt)],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    cellKey: text("cell_key").notNull(),
    filename: text("filename").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    objectKey: text("object_key").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("idx_attachments_cell_key_created_at").on(table.cellKey, table.createdAt)],
);
