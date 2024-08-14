import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
// import { User } from "../../Schemas/User.js";


export const users = sqliteTable(
  'users',
  {
    username: text('username').primaryKey(),        
    chat: text('chat_id').notNull(),            
    name: text('name'),                             
    age: integer('age'),                            
    gender: text('gender', { enum: ["men", "women", "any"] }), 
    description: text('description'),               
    tags: text("tags"),
    rating: text('rating')                          
  }
);
