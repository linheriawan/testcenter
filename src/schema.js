// D1 schema. Applied automatically (idempotent) on the first API request of each
// Worker instance, so no manual migration step is needed for a fresh database.
// The same SQL lives in migrations/0001_init.sql for use with `wrangler d1 migrations`.

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    phone_enc TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    consent_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    segment TEXT,
    education_level TEXT,
    field TEXT,
    school TEXT,
    skills TEXT,
    cv_enc TEXT,
    updated_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    test_id TEXT NOT NULL,
    answers_enc TEXT NOT NULL,
    result TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_results_user ON test_results (user_id, test_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS insights (
    user_id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    model TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_type TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'requested',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings (user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS inquiries (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries (created_at)`,
  `CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'perusahaan',
    settings TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS org_members (
    org_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (org_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members (user_id)`,
  `CREATE TABLE IF NOT EXISTS job_standards (
    id TEXT PRIMARY KEY,
    org_id TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    scores TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (org_id, code)
  )`,
  `CREATE TABLE IF NOT EXISTS assessments (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_assessments_org ON assessments (org_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS kraepelin_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    seed INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_kraepelin_user ON kraepelin_sessions (user_id, started_at)`,
  `CREATE TABLE IF NOT EXISTS org_invites (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_invites_org ON org_invites (org_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS org_participants (
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
  )`,
  `CREATE INDEX IF NOT EXISTS idx_participants_org ON org_participants (org_id, invite_id)`,
  `CREATE INDEX IF NOT EXISTS idx_participants_user ON org_participants (user_id)`
];
