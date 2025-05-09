PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_progress_metrics` (
	`user_id` text NOT NULL,
	`metric_key` text NOT NULL,
	`period_identifier` text NOT NULL,
	`metric_value` text NOT NULL,
	`metric_type` text,
	`calculated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `metric_key`, `period_identifier`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_progress_metrics`("user_id", "metric_key", "period_identifier", "metric_value", "metric_type", "calculated_at") SELECT "user_id", "metric_key", "period_identifier", "metric_value", "metric_type", "calculated_at" FROM `user_progress_metrics`;--> statement-breakpoint
DROP TABLE `user_progress_metrics`;--> statement-breakpoint
ALTER TABLE `__new_user_progress_metrics` RENAME TO `user_progress_metrics`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_user_progress_metrics_user_period` ON `user_progress_metrics` (`user_id`,`metric_key`,`period_identifier`);--> statement-breakpoint
CREATE INDEX `idx_weekly_user_activity_user_week` ON `weekly_user_activity` (`user_id`,`week_identifier`);