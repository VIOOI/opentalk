import { sqliteTable, text } from "drizzle-orm/sqlite-core";
import { v4 as uuidv4 } from "uuid";

export const ads = sqliteTable("ads", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => uuidv4()),
  type: text("type", { enum: ["small", "large", "forwared"] }),
  content: text("content"),
  age: text("age"),
  gender: text("gender", { enum: ["men", "women", "any"] }),
  tags: text("tags"),
});

export type NewAds = typeof ads.$inferInsert;
