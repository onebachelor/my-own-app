-- 学习模块：科目、学习计划与学习记录
-- learning_subjects 科目；learning_plans 学习计划（内容+时间安排+进度）；
-- learning_sessions 每次学习时长记录，用于进度跟踪。

CREATE TABLE IF NOT EXISTS learning_subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS learning_plans (
  id TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES learning_subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  plan_date TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL DEFAULT '',
  estimated_minutes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'todo',
  progress INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS learning_sessions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES learning_plans(id) ON DELETE CASCADE,
  session_date TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_learning_plans_subject
  ON learning_plans(subject_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_learning_sessions_plan
  ON learning_sessions(plan_id, session_date) WHERE deleted_at IS NULL;
