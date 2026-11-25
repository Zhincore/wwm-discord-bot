CREATE TABLE `notifications` (
	`guildId` text NOT NULL,
	`kind` text NOT NULL,
	`channel` text NOT NULL,
	`pingRole` text,
	CONSTRAINT `notifications_pk` PRIMARY KEY(`guildId`, `kind`)
);
