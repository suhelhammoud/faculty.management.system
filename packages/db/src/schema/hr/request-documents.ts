import { pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { hrDocuments } from './documents.js';
import { hrRequests } from './requests.js';

export const hrRequestDocuments = pgTable(
  'hr_request_documents',
  {
    requestId: uuid('request_id')
      .notNull()
      .references(() => hrRequests.requestId, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => hrDocuments.documentId, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('hr_request_documents_request_document_unique').on(table.requestId, table.documentId),
  ],
);
