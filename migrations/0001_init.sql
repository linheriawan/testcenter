CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone_enc TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  consent_at TEXT NOT NULL,
  created_at TEXT NOT NULL
  );

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  segment TEXT,
  education_level TEXT,
  field TEXT,
  school TEXT,
  skills TEXT,
  cv_enc TEXT,
  updated_at TEXT
  );

CREATE TABLE IF NOT EXISTS test_results (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  test_id TEXT NOT NULL,
  answers_enc TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_results_user ON test_results (user_id, test_id, created_at);

CREATE TABLE IF NOT EXISTS insights (
  user_id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL
  );

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_type TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TEXT NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings (user_id, created_at);
