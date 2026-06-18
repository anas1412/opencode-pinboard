CREATE TABLE `app_cost` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`ticket_id` text,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
