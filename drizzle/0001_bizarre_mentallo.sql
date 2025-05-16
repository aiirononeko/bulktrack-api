DROP TABLE `workout_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_workout_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`reps` integer,
	`weight` real,
	`notes` text,
	`performed_at` text NOT NULL,
	`rpe` real,
	`rest_sec` integer,
	`volume` real GENERATED ALWAYS AS ((weight * reps)) VIRTUAL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_workout_sets`("id", "user_id", "exercise_id", "set_number", "reps", "weight", "notes", "performed_at", "rpe", "rest_sec", "created_at", "updated_at") SELECT "id", "user_id", "exercise_id", "set_number", "reps", "weight", "notes", "performed_at", "rpe", "rest_sec", "created_at", "updated_at" FROM `workout_sets`;--> statement-breakpoint
DROP TABLE `workout_sets`;--> statement-breakpoint
ALTER TABLE `__new_workout_sets` RENAME TO `workout_sets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_sets_exercise_rec` ON `workout_sets` (`user_id`,`exercise_id`,`created_at`);