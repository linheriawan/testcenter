CREATE TABLE IF NOT EXISTS inquiries (
  id TEXT PRIMARY KEY,
  org_type TEXT NOT NULL,
  org_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  position TEXT,
  phone TEXT,
  email TEXT NOT NULL,
  size TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries (created_at);
