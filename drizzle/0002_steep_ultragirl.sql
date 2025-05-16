PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_exercise_usage` (
	`user_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`last_used_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `exercise_id`, `last_used_at`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_exercise_usage`("user_id", "exercise_id", "last_used_at") SELECT "user_id", "exercise_id", "last_used_at" FROM `exercise_usage`;--> statement-breakpoint
DROP TABLE `exercise_usage`;--> statement-breakpoint
ALTER TABLE `__new_exercise_usage` RENAME TO `exercise_usage`;--> statement-breakpoint
PRAGMA foreign_keys=ON;