import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/db/schema.ts', // Lokasi file skema kita nanti
  out: './drizzle', // Folder output migrasi
  dialect: 'sqlite',
  dbCredentials: {
    url: 'educore.db', // File database lokal
  },
});