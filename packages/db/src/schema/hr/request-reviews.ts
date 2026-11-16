import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';
import { timestamps } from './common.js';
import { hrRequests } from './requests.js';

export const hrRequestReviews = pgTable(
  'hr_request_reviews',
  {
    reviewId: uuid('review_id').defaultRandom().primaryKey(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => hrRequests.requestId, { onDelete: 'cascade' }),
    reviewerId: text('reviewer_id').references(() => user.id, { onDelete: 'set null' }),
    stage: text('stage').notNull(),
    outcome: text('outcome').notNull(),
    comments: text('comments'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }).defaultNow().notNull(),
    ...timestamps(),
  },
  (table) => [index('hr_request_reviews_request_idx').on(table.requestId, table.reviewedAt)],
);
