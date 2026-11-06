CREATE TABLE IF NOT EXISTS kraepelin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  seed INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_kraepelin_user ON kraepelin_sessions (user_id, started_at);

CREATE TABLE IF NOT EXISTS org_invites (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  standard_code TEXT,
  purpose TEXT,
  tests TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invites_org ON org_invites (org_id, created_at);

CREATE TABLE IF NOT EXISTS org_participants (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  invite_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  nik TEXT,
  position TEXT,
  division TEXT,
  consent_at TEXT NOT NULL,
  assessment_id TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (invite_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_participants_org ON org_participants (org_id, invite_id);

CREATE INDEX IF NOT EXISTS idx_participants_user ON org_participants (user_id);
