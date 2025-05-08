CREATE TABLE `exercise_muscles` (
	`exercise_id` text NOT NULL,
	`muscle_id` integer NOT NULL,
	`tension_ratio` real NOT NULL,
	PRIMARY KEY(`exercise_id`, `muscle_id`),
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`muscle_id`) REFERENCES `muscles`(`id`) ON UPDATE no action ON DELETE no action
);
