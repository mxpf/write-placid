CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`path` text NOT NULL,
	`type` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`date` text DEFAULT '' NOT NULL,
	`status` text NOT NULL,
	`published_at` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`source_label` text DEFAULT '' NOT NULL,
	`source_href` text DEFAULT '' NOT NULL,
	`remote_sha` text DEFAULT '' NOT NULL,
	`published_source` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_path_unique` ON `documents` (`path`);