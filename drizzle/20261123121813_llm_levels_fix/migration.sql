PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_guild_llm_whitelist` (
	`guildId` text NOT NULL,
	`roleId` text NOT NULL,
	`level` text DEFAULT 'BASIC' NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_guild_llm_whitelist`(`guildId`, `roleId`, `level`) SELECT `guildId`, `roleId`, `level` FROM `guild_llm_whitelist`;--> statement-breakpoint
DROP TABLE `guild_llm_whitelist`;--> statement-breakpoint
ALTER TABLE `__new_guild_llm_whitelist` RENAME TO `guild_llm_whitelist`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `guild_level_index` ON `guild_llm_whitelist` (`guildId`,`level`);