CREATE TABLE `game_data` (
	`kind` text NOT NULL,
	`id` integer NOT NULL,
	`name` text,
	`data` text NOT NULL,
	CONSTRAINT `game_data_pk` PRIMARY KEY(`kind`, `id`)
);
--> statement-breakpoint
CREATE TABLE `game_data_emojis` (
	`name` text PRIMARY KEY,
	`url` text NOT NULL
);
