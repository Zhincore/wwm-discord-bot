CREATE TABLE `game_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`memberId` text UNIQUE,
	`session` text,
	`createdAt` integer DEFAULT (CURRENT_TIMESTAMP)
);
