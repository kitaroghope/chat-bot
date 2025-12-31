import crypto from 'crypto';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { pgTable, uuid, varchar, text as pgText, integer as pgInteger } from 'drizzle-orm/pg-core';

/* =========================
   SQLite schema (fallback)
   ========================= */

export const sqliteDocuments = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  filename: text('filename').notNull(),
  uploadDate: integer('upload_date').default(Math.floor(Date.now() / 1000)),
  textLength: integer('text_length'),
  chunkCount: integer('chunk_count').default(0),
});

export const sqliteVectorChunks = sqliteTable('vector_chunks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  documentId: integer('document_id').references(() => sqliteDocuments.id),
  chunkText: text('chunk_text').notNull(),
  embedding: text('embedding'),
  chunkIndex: integer('chunk_index'),
  createdAt: integer('created_at').default(Math.floor(Date.now() / 1000)),
  document: text('document'),
});

/* =========================
   PostgreSQL schema (Neon)
   ========================= */

export const pgDocuments = pgTable('documents', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  filename: varchar('filename', { length: 255 }).notNull(),

  uploadDate: pgInteger('upload_date')
    .$defaultFn(() => Math.floor(Date.now() / 1000)),

  textLength: pgInteger('text_length'),

  chunkCount: pgInteger('chunk_count').default(0),
});

export const pgVectorChunks = pgTable('document_chunks', {
  id: uuid('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  documentId: uuid('document_id')
    .references(() => pgDocuments.id, { onDelete: 'cascade' })
    .notNull(),

  chunkText: pgText('chunk_text').notNull(),

  embedding: pgText('embedding'),

  chunkIndex: pgInteger('chunk_index').notNull(),

  createdAt: pgInteger('created_at')
    .$defaultFn(() => Math.floor(Date.now() / 1000)),

  document: varchar('document', { length: 255 }),
});
