import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { User } from "../../Schemas/User.js";


export const UserTable = sqliteTable('users', {
  id: text('id').primaryKey(),
  chat: text("chat").unique().notNull(),
  gender: text("gender", { enum: ["men", "women", "any"] })
    .$type<User["gender"]>()
    .notNull(),
  name: text("name").notNull(),
  age: text("age").notNull(),
  description: text("description")
    .notNull()
    .default(""),
  raiting: text("raiting")
    .notNull()
    .default("0 0"),
  tags: text("tags")
    .notNull()
    .default("")
});

