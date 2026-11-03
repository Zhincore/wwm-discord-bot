CREATE TABLE `codes` (
	`guildId` text PRIMARY KEY,
	`channel` text NOT NULL,
	`pingRole` text
);
--> statement-breakpoint
CREATE TABLE `app_state` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
