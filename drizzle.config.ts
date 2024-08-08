import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: "./src/Databases/*.table.ts",
  out: './drizzle',
  dialect: "sqlite", // 'postgresql' | 'mysql' | 'sqlite'
  dbCredentials: {
    url: "./database.db"
  },
});
