import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './User.table.js';

export const Drizzle = drizzle(
  new Database('database.db'),
  { schema }
);
