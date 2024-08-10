import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: "./src/Databases/Tables/*.ts",
  out: './drizzle',
  dialect: "sqlite", // 'postgresql' | 'mysql' | 'sqlite'
  dbCredentials: {
    url: "./database.db"
  },
});
