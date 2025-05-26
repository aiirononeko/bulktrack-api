CREATE TABLE `muscle_group_translations` (
	`muscle_group_id` integer NOT NULL,
	`locale` text NOT NULL,
	`name` text NOT NULL,
	PRIMARY KEY(`muscle_group_id`, `locale`),
	FOREIGN KEY (`muscle_group_id`) REFERENCES `muscle_groups`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_muscle_group_translations_locale` ON `muscle_group_translations` (`locale`);
--> statement-breakpoint
-- Insert default English translations from existing muscle_groups table
INSERT INTO muscle_group_translations (muscle_group_id, locale, name)
SELECT id, 'en', name FROM muscle_groups;
