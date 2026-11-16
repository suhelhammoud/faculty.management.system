import { sql } from 'drizzle-orm';
import { date, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { user } from '../auth/users.js';

export const hrEmployees = pgTable(
  'hr_employees',
  {
    employeeId: uuid('employee_id').defaultRandom().primaryKey(),
    employeeNumber: text('employee_number').notNull(),
    userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
    firstNameAr: text('first_name_ar').notNull(),
    middleNameAr: text('middle_name_ar'),
    lastNameAr: text('last_name_ar').notNull(),
    firstNameEn: text('first_name_en'),
    middleNameEn: text('middle_name_en'),
    lastNameEn: text('last_name_en'),
    birthDate: date('birth_date', { mode: 'string' }),
    nationality: text('nationality'),
    civilRegistryNumber: text('civil_registry_number'),
    phoneNumber: text('phone_number'),
    mobileNumber: text('mobile_number'),
    email: text('email'),
    address: text('address'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql`now()`),
  },
  (table) => [
    unique('hr_employees_employee_number_unique').on(table.employeeNumber),
    unique('hr_employees_user_id_unique').on(table.userId),
    index('hr_employees_name_idx').on(table.lastNameAr, table.firstNameAr),
  ],
);
