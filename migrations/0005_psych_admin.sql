CREATE TABLE IF NOT EXISTS psychologists (
  user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  title TEXT,
  sipp TEXT,
  bio TEXT,
  availability TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY,
  psychologist_id TEXT NOT NULL,
  user_id TEXT,
  kind TEXT NOT NULL,
  session_type TEXT,
  title TEXT,
  org_id TEXT,
  participant_id TEXT,
  start_at TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  status TEXT NOT NULL,
  meeting_link TEXT,
  user_note TEXT,
  psych_note_enc TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_appt_psych ON appointments (psychologist_id, start_at);

CREATE INDEX IF NOT EXISTS idx_appt_user ON appointments (user_id, start_at);

CREATE TABLE IF NOT EXISTS org_invite_emails (
  id TEXT PRIMARY KEY,
  invite_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  responded_at TEXT,
  UNIQUE (invite_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invite_emails_email ON org_invite_emails (email, status);
