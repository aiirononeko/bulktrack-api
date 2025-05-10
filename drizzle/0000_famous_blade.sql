CREATE TABLE `exercise_muscles` (
	`exercise_id` text NOT NULL,
	`muscle_id` integer NOT NULL,
	`tension_ratio` real NOT NULL,
	PRIMARY KEY(`exercise_id`, `muscle_id`),
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`muscle_id`) REFERENCES `muscles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercise_translations` (
	`exercise_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	`aliases` text,
	PRIMARY KEY(`exercise_id`, `locale`),
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exercise_usage` (
	`user_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`last_used_at` text NOT NULL,
	`use_count` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`user_id`, `exercise_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_usage_recent` ON `exercise_usage` (`user_id`,`last_used_at`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`default_muscle_id` integer,
	`is_compound` integer DEFAULT false NOT NULL,
	`is_official` integer DEFAULT false NOT NULL,
	`author_user_id` text,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`default_muscle_id`) REFERENCES `muscles`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `menu_exercises` (
	`menu_id` text NOT NULL,
	`position` integer NOT NULL,
	`exercise_id` text NOT NULL,
	`default_weight` real,
	`default_reps` text,
	PRIMARY KEY(`menu_id`, `position`),
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `menus` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `muscles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`tension_factor` real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `muscles_name_unique` ON `muscles` (`name`);--> statement-breakpoint
CREATE TABLE `user_devices` (
	`device_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text,
	`linked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`goal_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_user_metrics` (
	`user_id` text NOT NULL,
	`week_start` text NOT NULL,
	`metric_key` text NOT NULL,
	`metric_value` real NOT NULL,
	`metric_unit` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `week_start`, `metric_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wum_user_week_metric` ON `weekly_user_metrics` (`user_id`,`week_start`);--> statement-breakpoint
CREATE TABLE `weekly_user_muscle_volumes` (
	`user_id` text NOT NULL,
	`week_start` text NOT NULL,
	`muscle_id` integer NOT NULL,
	`volume` real NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `week_start`, `muscle_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`muscle_id`) REFERENCES `muscles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_weekly_umv` ON `weekly_user_muscle_volumes` (`user_id`,`week_start`);--> statement-breakpoint
CREATE TABLE `weekly_user_volumes` (
	`user_id` text NOT NULL,
	`week_start` text NOT NULL,
	`total_volume` real NOT NULL,
	`avg_set_volume` real NOT NULL,
	`e1rm_avg` real,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `week_start`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_weekly_uv_user_week` ON `weekly_user_volumes` (`user_id`,`week_start`);--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`menu_id` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_started` ON `workout_sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE TABLE `workout_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`set_no` integer NOT NULL,
	`reps` integer,
	`weight` real,
	`notes` text,
	`performed_at` text NOT NULL,
	`rpe` real,
	`rest_sec` integer,
	`volume` real GENERATED ALWAYS AS ((weight * reps)) VIRTUAL,
	`device_id` text NOT NULL,
	`created_offline` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sets_session` ON `workout_sets` (`session_id`,`set_no`);--> statement-breakpoint
CREATE INDEX `idx_sets_exercise_rec` ON `workout_sets` (`user_id`,`exercise_id`,`created_at`);