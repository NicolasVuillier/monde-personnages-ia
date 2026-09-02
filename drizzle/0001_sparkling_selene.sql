ALTER TABLE `characters` ADD `relation_strengths` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `characters` ADD `response_length` text DEFAULT 'standard' NOT NULL;