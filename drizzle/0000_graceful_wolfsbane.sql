CREATE TABLE `cost_record` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`ticket_id` text NOT NULL,
	`repo_id` text NOT NULL,
	`opencode_version` text NOT NULL,
	`model` text NOT NULL,
	`prompt_tokens` integer NOT NULL,
	`completion_tokens` integer NOT NULL,
	`cost_usd` real NOT NULL,
	`recorded_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `repo` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`local_path` text NOT NULL,
	`default_branch` text DEFAULT 'main' NOT NULL,
	`env_vars` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`opencode_version` text NOT NULL,
	`model` text NOT NULL,
	`cwd` text NOT NULL,
	`branch` text NOT NULL,
	`initial_prompt` text NOT NULL,
	`transcript` text DEFAULT '[]' NOT NULL,
	`diff` text DEFAULT '[]' NOT NULL,
	`files_changed` text DEFAULT '[]' NOT NULL,
	`exit_code` integer,
	`exit_reason` text,
	`prompt_tokens` integer DEFAULT 0 NOT NULL,
	`completion_tokens` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`ended_at` integer,
	`duration_ms` integer,
	`approved` integer,
	`revision_note` text
);
--> statement-breakpoint
CREATE TABLE `ticket` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`category` text DEFAULT 'feature' NOT NULL,
	`repo_id` text NOT NULL,
	`branch` text NOT NULL,
	`base_branch` text NOT NULL,
	`session_ids` text DEFAULT '[]' NOT NULL,
	`active_session_id` text,
	`files_changed` text DEFAULT '[]' NOT NULL,
	`total_cost_usd` real DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`tags` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`resolved_at` integer
);
