import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

export const ads = sqliteTable("ads", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => uuidv4()),
	type: text("type", { enum: ["small", "large", "forwared"] }),
	content: text("content"),
  chat: text("chat"),
  message: text("message"),
	age: text("age"),
	gender: text("gender", { enum: ["men", "women", "any"] }).default("any"),
	tags: text("tags").default(""),
  probability: integer("probability").default(1.0),
  impressions: integer("impressions").default(1000),
  count: integer("count").default(0),
});

export type NewAds = typeof ads.$inferInsert;
export type DrizzleAds = typeof ads.$inferSelect;
