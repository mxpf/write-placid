CREATE TABLE IF NOT EXISTS `deleted_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`document_json` text NOT NULL,
	`deleted_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `public_updated_at` text DEFAULT '' NOT NULL;
