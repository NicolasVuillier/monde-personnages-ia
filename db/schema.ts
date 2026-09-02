import { sql } from "drizzle-orm";
import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  subtitle: text("subtitle").notNull(),
  category: text("category").notNull(),
  location: text("location").notNull(),
  era: text("era").notNull(),
  lng: real("lng").notNull(),
  lat: real("lat").notNull(),
  color: text("color").notNull(),
  avatar: text("avatar").notNull(),
  popularity: real("popularity").notNull().default(0.7),
  description: text("description").notNull(),
  greeting: text("greeting").notNull(),
  reply: text("reply").notNull(),
  relations: text("relations").notNull().default("[]"),
  relationStrengths: text("relation_strengths").notNull().default("{}"),
  responseLength: text("response_length").notNull().default("standard"),
  status: text("status").notNull().default("draft"),
  ownerEmail: text("owner_email").notNull(),
  avatarPrompt: text("avatar_prompt"),
  avatarProvider: text("avatar_provider"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const dailyChatUsage = sqliteTable("daily_chat_usage", {
  identityHash: text("identity_hash").notNull(),
  usageDate: text("usage_date").notNull(),
  messageCount: integer("message_count").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.identityHash, table.usageDate] }),
]);
