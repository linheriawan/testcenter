CREATE TABLE IF NOT EXISTS user_meta (
  user_id TEXT PRIMARY KEY,
  birth_date TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS guardian_consents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  guardian_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  method TEXT NOT NULL,
  form_date TEXT,
  note TEXT,
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_guardian_user ON guardian_consents (user_id, org_id);
