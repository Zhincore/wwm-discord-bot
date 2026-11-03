import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/**/*.schema.ts',
  schemaFilter: '*.schema.ts',
  out: './drizzle',
  // dbCredentials: { url: '.data/db.sqlite' },
});
