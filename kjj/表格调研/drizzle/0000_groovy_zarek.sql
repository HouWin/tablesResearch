CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`cell_key` text NOT NULL,
	`filename` text NOT NULL,
	`content_type` text NOT NULL,
	`size` integer NOT NULL,
	`object_key` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attachments_cell_key_created_at` ON `attachments` (`cell_key`,`created_at`);--> statement-breakpoint
CREATE TABLE `cell_comments` (
	`cell_key` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cell_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cell_key` text NOT NULL,
	`old_value` text,
	`new_value` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cell_history_cell_key_created_at` ON `cell_history` (`cell_key`,`created_at`);