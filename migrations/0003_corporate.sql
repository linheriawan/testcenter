CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'perusahaan',
  settings TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members (user_id);

CREATE TABLE IF NOT EXISTS job_standards (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  scores TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, code)
);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  nik TEXT,
  name TEXT NOT NULL,
  gender TEXT,
  age INTEGER,
  education TEXT,
  position TEXT,
  division TEXT,
  location TEXT,
  employment TEXT,
  standard_code TEXT NOT NULL,
  standard_scores TEXT NOT NULL,
  assess_date TEXT,
  purpose TEXT,
  target_position TEXT,
  scores TEXT NOT NULL,
  iq INTEGER,
  disc TEXT,
  leadership TEXT,
  gap INTEGER NOT NULL,
  match_count INTEGER NOT NULL,
  talent INTEGER NOT NULL,
  fit TEXT NOT NULL,
  potential TEXT NOT NULL,
  box TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  final_recommendation TEXT NOT NULL,
  narrative_enc TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_assessments_org ON assessments (org_id, created_at);
