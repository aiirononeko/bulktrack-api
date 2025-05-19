CREATE TABLE `exercise_modifier_values` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`exercise_id` text NOT NULL,
	`modifier_id` integer NOT NULL,
	`value_num` real,
	`value_text` text,
	`value_key` text GENERATED ALWAYS AS (COALESCE(CAST(value_num AS TEXT), value_text)) VIRTUAL NOT NULL,
	`rel_share_multiplier` real DEFAULT 1 NOT NULL,
	`peak_emg_offset` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`modifier_id`) REFERENCES `modifiers`(`id`) ON UPDATE cascade ON DELETE cascade,
	CONSTRAINT "ck_rel_share_multiplier" CHECK("exercise_modifier_values"."rel_share_multiplier" >= 0 AND "exercise_modifier_values"."rel_share_multiplier" <= 2)
);
--> statement-breakpoint
CREATE INDEX `idx_mod_exercise` ON `exercise_modifier_values` (`exercise_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `unq_emv_eid_mid_vkey` ON `exercise_modifier_values` (`exercise_id`,`modifier_id`,`value_key`);
--> statement-breakpoint
CREATE TABLE `exercise_muscles` (
	`exercise_id` text NOT NULL,
	`muscle_id` integer NOT NULL,
	`relative_share` integer NOT NULL,
	`peak_emg_pct` real,
	`source_id` text,
	`notes` text,
	PRIMARY KEY(`exercise_id`, `muscle_id`),
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`muscle_id`) REFERENCES `muscles`(`id`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `exercise_sources`(`id`) ON UPDATE cascade ON DELETE set null,
	CONSTRAINT "ck_relative_share" CHECK("exercise_muscles"."relative_share" >= 0 AND "exercise_muscles"."relative_share" <= 1000)
);
--> statement-breakpoint
CREATE INDEX `idx_exercise_muscles_muscle` ON `exercise_muscles` (`muscle_id`);
--> statement-breakpoint
CREATE INDEX `idx_muscles_exercise` ON `exercise_muscles` (`exercise_id`);
--> statement-breakpoint
CREATE TABLE `exercise_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`citation` text,
	`url` text,
	`retrieved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exercise_translations` (
	`exercise_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	`aliases` text,
	PRIMARY KEY(`exercise_id`, `locale`),
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exercise_usage` (
	`user_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`last_used_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `exercise_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE cascade ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`canonical_name` text NOT NULL,
	`default_muscle_id` integer,
	`is_compound` integer DEFAULT false NOT NULL,
	`is_official` integer DEFAULT false NOT NULL,
	`author_user_id` text,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`default_muscle_id`) REFERENCES `muscles`(`id`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `menu_exercises` (
	`menu_id` text NOT NULL,
	`position` integer NOT NULL,
	`exercise_id` text NOT NULL,
	`default_weight` real,
	`default_reps` text,
	PRIMARY KEY(`menu_id`, `position`),
	FOREIGN KEY (`menu_id`) REFERENCES `menus`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE cascade ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `menus` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `modifiers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`unit` text,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `modifiers_key_unique` ON `modifiers` (`key`);
--> statement-breakpoint
CREATE TABLE `muscle_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `muscle_groups_name_unique` ON `muscle_groups` (`name`);
--> statement-breakpoint
CREATE TABLE `muscles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`muscle_group_id` integer NOT NULL,
	`tension_factor` real DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups`(`id`) ON UPDATE cascade ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `muscles_name_unique` ON `muscles` (`name`);
--> statement-breakpoint
CREATE TABLE `user_devices` (
	`device_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text,
	`linked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_wum_user_week_metric` ON `weekly_user_metrics` (`user_id`,`week_start`);
--> statement-breakpoint
CREATE TABLE `weekly_user_muscle_volumes` (
	`user_id` text NOT NULL,
	`week_start` text NOT NULL,
	`muscle_id` integer NOT NULL,
	`volume` real NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `week_start`, `muscle_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`muscle_id`) REFERENCES `muscles`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_weekly_umv` ON `weekly_user_muscle_volumes` (`user_id`,`week_start`);
--> statement-breakpoint
CREATE TABLE `weekly_user_volumes` (
	`user_id` text NOT NULL,
	`week_start` text NOT NULL,
	`total_volume` real NOT NULL,
	`avg_set_volume` real NOT NULL,
	`e1rm_avg` real,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `week_start`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_weekly_uv_user_week` ON `weekly_user_volumes` (`user_id`,`week_start`);
--> statement-breakpoint
CREATE TABLE `workout_sets` (
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
	`volume` real GENERATED ALWAYS AS ((COALESCE(weight, 0) * COALESCE(reps, 0))) VIRTUAL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE cascade ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE cascade ON DELETE no action,
	CONSTRAINT "ck_rpe_range" CHECK("workout_sets"."rpe" >= 1 AND "workout_sets"."rpe" <= 10)
);
--> statement-breakpoint
CREATE INDEX `idx_sets_exercise_rec` ON `workout_sets` (`user_id`,`exercise_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_sets_user_performed_at` ON `workout_sets` (`user_id`,`performed_at`);
--> statement-breakpoint
CREATE VIRTUAL TABLE exercises_fts
USING fts5(
  exercise_id UNINDEXED,
  locale UNINDEXED,
  text,
  text_normalized,
  tokenize = 'unicode61 remove_diacritics 2',
  prefix = '2 3 4'
);
--> statement-breakpoint
CREATE TABLE `set_modifiers` (
	`set_id` text NOT NULL,
	`exercise_modifier_value_id` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`set_id`, `exercise_modifier_value_id`),
	FOREIGN KEY (`set_id`) REFERENCES `workout_sets`(`id`) ON UPDATE cascade ON DELETE cascade,
	FOREIGN KEY (`exercise_modifier_value_id`) REFERENCES `exercise_modifier_values`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_set_modifiers_set_id` ON `set_modifiers` (`set_id`);
--> statement-breakpoint
CREATE INDEX `idx_set_modifiers_emv_id` ON `set_modifiers` (`exercise_modifier_value_id`);
--> statement-breakpoint
ALTER TABLE `weekly_user_muscle_volumes` ADD `set_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `weekly_user_muscle_volumes` ADD `e1rm_sum` real DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `weekly_user_muscle_volumes` ADD `e1rm_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE VIEW v_weekly_user_group_volumes AS
    SELECT
      w.user_id,
      w.week_start,
      mg.id AS muscle_group_id,
      mg.name AS muscle_group_name,
      SUM(w.volume) AS group_volume,
      SUM(w.set_count) AS group_set_count
    FROM weekly_user_muscle_volumes w
    JOIN muscles m ON m.id = w.muscle_id
    JOIN muscle_groups mg ON mg.id = m.muscle_group_id
    GROUP BY
      w.user_id,
      w.week_start,
      mg.id,
      mg.name;
