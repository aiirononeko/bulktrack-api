CREATE TABLE `daily_exercise_muscle_volumes` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`exercise_id` text NOT NULL,
	`muscle_id` integer NOT NULL,
	`effective_volume` real NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `date`, `exercise_id`, `muscle_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`muscle_id`) REFERENCES `muscles`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_daily_emv_user_date_exercise` ON `daily_exercise_muscle_volumes` (`user_id`,`date`,`exercise_id`);--> statement-breakpoint
CREATE TABLE `daily_exercise_summaries` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`exercise_id` text NOT NULL,
	`total_volume` real NOT NULL,
	`avg_rm` real,
	`set_count` integer NOT NULL,
	`set_ids` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `date`, `exercise_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_daily_es_user_date` ON `daily_exercise_summaries` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `daily_workout_summaries` (
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`total_volume` real NOT NULL,
	`avg_rm` real,
	`set_count` integer NOT NULL,
	`exercise_count` integer NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `date`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_daily_ws_user_date` ON `daily_workout_summaries` (`user_id`,`date`);--> statement-breakpoint
