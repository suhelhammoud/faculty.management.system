ALTER TABLE "hr_academic_ranks" ADD CONSTRAINT "hr_academic_ranks_order_range_check" CHECK ("hr_academic_ranks"."rank_order" between 1 and 5);--> statement-breakpoint
ALTER TABLE "hr_employment_records" ADD CONSTRAINT "hr_employment_records_is_current_check" CHECK ("hr_employment_records"."is_current" in (0, 1));
--> statement-breakpoint
INSERT INTO "hr_staff_categories" ("category_id", "code", "name_ar", "name_en") VALUES
	('9c958529-2db8-48b2-b54e-8a517a081501', 'teaching_faculty', 'أعضاء الهيئة التدريسية', 'Teaching faculty'),
	('9c958529-2db8-48b2-b54e-8a517a081502', 'lab_teaching_staff', 'العاملون في التدريس المخبري', 'Laboratory teaching staff'),
	('9c958529-2db8-48b2-b54e-8a517a081503', 'technical_staff', 'العاملون الفنيون', 'Technical staff'),
	('9c958529-2db8-48b2-b54e-8a517a081504', 'administrative_support', 'العاملون الإداريون والمساندون', 'Administrative and support staff');
--> statement-breakpoint
INSERT INTO "hr_academic_ranks" ("rank_id", "code", "name_ar", "name_en", "rank_order") VALUES
	('9c958529-2db8-48b2-b54e-8a517a081511', 'lecturer', 'مدرس', 'Lecturer', 1),
	('9c958529-2db8-48b2-b54e-8a517a081512', 'assistant_professor', 'أستاذ مساعد', 'Assistant Professor', 2),
	('9c958529-2db8-48b2-b54e-8a517a081513', 'professor', 'أستاذ', 'Professor', 3);
--> statement-breakpoint
INSERT INTO "hr_positions" ("position_id", "category_id", "code", "name_ar", "name_en", "is_academic") VALUES
	('9c958529-2db8-48b2-b54e-8a517a081521', '9c958529-2db8-48b2-b54e-8a517a081501', 'lecturer', 'مدرس', 'Lecturer', 1),
	('9c958529-2db8-48b2-b54e-8a517a081522', '9c958529-2db8-48b2-b54e-8a517a081501', 'assistant_professor', 'أستاذ مساعد', 'Assistant Professor', 1),
	('9c958529-2db8-48b2-b54e-8a517a081523', '9c958529-2db8-48b2-b54e-8a517a081501', 'professor', 'أستاذ', 'Professor', 1);
