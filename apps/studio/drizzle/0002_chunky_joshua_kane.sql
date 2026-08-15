ALTER TABLE `documents` ADD `google_doc_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `drive_revision` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `drive_synced_body` text DEFAULT '' NOT NULL;