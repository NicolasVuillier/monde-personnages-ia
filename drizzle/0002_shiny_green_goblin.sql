CREATE TABLE `daily_chat_usage` (
	`identity_hash` text NOT NULL,
	`usage_date` text NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`identity_hash`, `usage_date`)
);
