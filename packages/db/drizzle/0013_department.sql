ALTER TABLE student_affairs_departments ADD COLUMN active boolean NOT NULL DEFAULT true;
--> statement-breakpoint
INSERT INTO student_affairs_departments (code, name)
SELECT DISTINCT department_code,
  CASE department_code
    WHEN 'software-engineering' THEN 'Software Engineering'
    WHEN 'artificial-intelligence' THEN 'Artificial Intelligence'
    WHEN 'network-systems' THEN 'Network Systems'
    ELSE department_code
  END
FROM faculty_positions WHERE department_code IS NOT NULL
ON CONFLICT (code) DO NOTHING;
--> statement-breakpoint
ALTER TABLE faculty_positions ADD CONSTRAINT faculty_positions_department_code_student_affairs_departments_code_fk
FOREIGN KEY (department_code) REFERENCES student_affairs_departments(code) ON DELETE RESTRICT;
--> statement-breakpoint
CREATE INDEX students_department_idx ON students(department_id);
--> statement-breakpoint
CREATE TABLE curriculum_families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES student_affairs_departments(id) ON DELETE RESTRICT,
  name text NOT NULL,
  CONSTRAINT curriculum_families_department_id_name_unique UNIQUE (department_id, name)
);
--> statement-breakpoint
INSERT INTO curriculum_families (department_id, name)
SELECT DISTINCT department_id, name FROM curriculum_plans;
--> statement-breakpoint
ALTER TABLE curriculum_plans ADD COLUMN family_id uuid REFERENCES curriculum_families(id) ON DELETE RESTRICT,
  ADD COLUMN revision integer NOT NULL DEFAULT 1, ADD COLUMN published_at timestamptz;
--> statement-breakpoint
UPDATE curriculum_plans p SET family_id = f.id, published_at = p.created_at
FROM curriculum_families f WHERE f.department_id = p.department_id AND f.name = p.name;
--> statement-breakpoint
ALTER TABLE curriculum_plans ALTER COLUMN family_id SET NOT NULL, ALTER COLUMN version DROP DEFAULT,
  ADD CONSTRAINT curriculum_plans_family_id_version_unique UNIQUE (family_id, version),
  DROP COLUMN department_id;
--> statement-breakpoint
ALTER TABLE student_curriculum_assignments ADD COLUMN assigned_by text;
--> statement-breakpoint
ALTER TABLE student_affairs_departments RENAME CONSTRAINT student_affairs_departments_code_key TO student_affairs_departments_code_unique;
--> statement-breakpoint
ALTER TABLE students RENAME CONSTRAINT students_department_id_fkey TO students_department_id_student_affairs_departments_id_fk;
--> statement-breakpoint
ALTER TABLE curriculum_families RENAME CONSTRAINT curriculum_families_department_id_fkey TO curriculum_families_department_id_student_affairs_departments_id_fk;
--> statement-breakpoint
ALTER TABLE curriculum_plans RENAME CONSTRAINT curriculum_plans_family_id_fkey TO curriculum_plans_family_id_curriculum_families_id_fk;
--> statement-breakpoint
ALTER TABLE curriculum_modules RENAME CONSTRAINT curriculum_modules_plan_id_fkey TO curriculum_modules_plan_id_curriculum_plans_id_fk;
--> statement-breakpoint
ALTER TABLE curriculum_modules RENAME CONSTRAINT curriculum_modules_study_year_check TO curriculum_module_year_check;
--> statement-breakpoint
ALTER TABLE curriculum_modules RENAME CONSTRAINT curriculum_modules_semester_check TO curriculum_module_semester_check;
--> statement-breakpoint
ALTER TABLE curriculum_modules RENAME CONSTRAINT curriculum_modules_requirement_check TO curriculum_module_requirement_check;
--> statement-breakpoint
ALTER TABLE curriculum_modules
  ADD CONSTRAINT curriculum_module_hours_check CHECK (theory_hours >= 0 AND lab_hours >= 0 AND credits >= 0),
  DROP CONSTRAINT curriculum_modules_theory_hours_check,
  DROP CONSTRAINT curriculum_modules_lab_hours_check,
  DROP CONSTRAINT curriculum_modules_credits_check;
--> statement-breakpoint
ALTER TABLE student_curriculum_assignments RENAME CONSTRAINT student_curriculum_assignments_student_id_fkey TO student_curriculum_assignments_student_id_students_student_id_fk;
--> statement-breakpoint
ALTER TABLE student_curriculum_assignments RENAME CONSTRAINT student_curriculum_assignments_plan_id_fkey TO student_curriculum_assignments_plan_id_curriculum_plans_id_fk;
