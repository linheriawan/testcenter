CREATE TABLE IF NOT EXISTS talent_profiles (
  user_id TEXT PRIMARY KEY,
  alias TEXT NOT NULL UNIQUE,
  visible INTEGER NOT NULL DEFAULT 0,
  headline TEXT,
  city TEXT,
  desired_roles TEXT,
  show TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS talent_requests (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  responded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_talent_req_user ON talent_requests (user_id, status);

CREATE INDEX IF NOT EXISTS idx_talent_req_org ON talent_requests (org_id, created_at);
