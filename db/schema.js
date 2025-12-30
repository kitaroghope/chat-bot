import { sqliteTable } from 'drizzle-orm/sqlite-core';
import { pgTable, serial, text, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// SQLite schema
export const sqliteVectors = sqliteTable('vectors', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    text: text('text').notNull(),
    vector: text('vector').notNull(),
});

// PostgreSQL schema
export const pgVectors = pgTable('vectors', {
    id: serial('id').primaryKey(),
    text: text('text').notNull(),
    vector: text('vector').notNull(),
    createdAt: integer('created_at').default(sql`EXTRACT(EPOCH FROM NOW())`),
});
