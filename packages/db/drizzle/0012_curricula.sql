CREATE TABLE student_affairs_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE students ADD COLUMN department_id uuid REFERENCES student_affairs_departments(id) ON DELETE RESTRICT;
CREATE TABLE curriculum_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid NOT NULL REFERENCES student_affairs_departments(id) ON DELETE RESTRICT,
  name text NOT NULL, version integer NOT NULL DEFAULT 1 CHECK (version > 0), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, name, version)
);
CREATE TABLE curriculum_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), plan_id uuid NOT NULL REFERENCES curriculum_plans(id) ON DELETE CASCADE,
  study_year smallint NOT NULL CHECK (study_year BETWEEN 1 AND 5), semester smallint NOT NULL CHECK (semester BETWEEN 1 AND 2),
  code text NOT NULL, name text NOT NULL, theory_hours smallint NOT NULL DEFAULT 0 CHECK (theory_hours >= 0),
  lab_hours smallint NOT NULL DEFAULT 0 CHECK (lab_hours >= 0), credits smallint NOT NULL DEFAULT 0 CHECK (credits >= 0),
  requirement text NOT NULL DEFAULT 'required' CHECK (requirement IN ('required','elective'))
);
CREATE INDEX curriculum_modules_plan_term_idx ON curriculum_modules(plan_id, study_year, semester);
CREATE TABLE student_curriculum_assignments (
  student_id uuid PRIMARY KEY REFERENCES students(student_id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES curriculum_plans(id) ON DELETE RESTRICT, assigned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX student_curriculum_assignments_plan_idx ON student_curriculum_assignments(plan_id);
