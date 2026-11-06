// Corporate module: organizations, job standards, talent assessments and dashboard.

import { HttpError, json, readJson, str, now } from './http.js';
import { encryptJson, decryptJson, randomId } from './crypto.js';
import {
  ASPECTS,
  RECOMMENDATIONS,
  LEADERSHIP_STYLES,
  evaluate,
  isValidScores
} from '../public/shared/talent.js';
import { suggestScores } from '../public/shared/suggest.js';
import { latestResults } from './results.js';
import { INVITE_TESTS } from './participant.js';

const ROLE_RANK = { viewer: 1, assessor: 2, admin: 3 };
const ROLES = Object.keys(ROLE_RANK);
const ORG_TYPES = ['perusahaan', 'sekolah', 'kampus', 'biro', 'lainnya'];
const MAX_IMPORT = 500;

// Made-up starting standards. Each organization edits these to match its own job levels.
const DEFAULT_STANDARDS = [
  { code: 'L1', name: 'Manajemen Puncak', scores: [4, 4, 4, 4, 4, 4, 3, 3, 4, 4, 4, 4, 4, 4, 3, 3, 3, 4] },
  { code: 'L2', name: 'Manajer', scores: [3, 4, 4, 4, 4, 3, 3, 3, 3, 3, 4, 3, 3, 3, 3, 3, 3, 4] },
  { code: 'L3', name: 'Supervisor', scores: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3] },
  { code: 'L4', name: 'Staf', scores: [3, 2, 2, 2, 3, 3, 4, 4, 3, 3, 4, 3, 3, 3, 4, 3, 3, 2] }
];

// ---------------- access ----------------

export function isPlatformAdmin(env, user) {
  // Tolerant of quotes, spaces, semicolons and line breaks in the secret's value.
  const list = String(env.ADMIN_EMAILS || '')
    .split(/[\s,;]+/)
    .map((e) => e.replace(/["'<>]/g, '').trim().toLowerCase())
    .filter(Boolean);
  return !!user && list.includes(String(user.email).toLowerCase());
}

async function orgAccess(env, user, orgId, minRole) {
  const org = await env.DB.prepare('SELECT id, name, type, settings, created_at FROM organizations WHERE id = ?').bind(orgId).first();
  if (!org) throw new HttpError(404, 'Organisasi tidak ditemukan');
  let role = null;
  if (isPlatformAdmin(env, user)) role = 'admin';
  else {
    const m = await env.DB.prepare('SELECT role FROM org_members WHERE org_id = ? AND user_id = ?').bind(orgId, user.id).first();
    role = m ? m.role : null;
  }
  if (!role) throw new HttpError(403, 'Anda tidak memiliki akses ke organisasi ini');
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) throw new HttpError(403, 'Peran Anda tidak mengizinkan tindakan ini');
  return { org: { ...org, settings: org.settings ? JSON.parse(org.settings) : {} }, role };
}

export async function userHasOrg(env, user) {
  if (isPlatformAdmin(env, user)) return true;
  const m = await env.DB.prepare('SELECT 1 AS x FROM org_members WHERE user_id = ? LIMIT 1').bind(user.id).first();
  return !!m;
}

// ---------------- organizations ----------------

async function myOrgs(env, user) {
  const admin = isPlatformAdmin(env, user);
  let rows;
  if (admin) {
    rows = (await env.DB.prepare("SELECT id, name, type, 'admin' AS role FROM organizations ORDER BY name").all()).results;
  } else {
    rows = (
      await env.DB.prepare(
        'SELECT o.id, o.name, o.type, m.role FROM org_members m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = ? ORDER BY o.name'
      )
        .bind(user.id)
        .all()
    ).results;
  }
  return json({ isAdmin: admin, user: { name: user.name, email: user.email }, orgs: rows || [] });
}

async function createOrg(request, env, user) {
  if (!isPlatformAdmin(env, user)) throw new HttpError(403, 'Hanya admin platform yang dapat membuat organisasi');
  const body = await readJson(request);
  const name = str(body.name, 160);
  const type = ORG_TYPES.includes(body.type) ? body.type : 'perusahaan';
  if (!name) throw new HttpError(400, 'Nama organisasi wajib diisi');
  const id = randomId();
  const ts = now();
  const stmts = [
    env.DB.prepare('INSERT INTO organizations (id, name, type, settings, created_at) VALUES (?, ?, ?, ?, ?)').bind(id, name, type, '{}', ts),
    env.DB.prepare('INSERT INTO org_members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)').bind(id, user.id, 'admin', ts),
    ...DEFAULT_STANDARDS.map((s) =>
      env.DB.prepare('INSERT INTO job_standards (id, org_id, code, name, scores, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
        randomId(),
        id,
        s.code,
        s.name,
        JSON.stringify(s.scores),
        ts,
        ts
      )
    )
  ];
  await env.DB.batch(stmts);
  return json({ org: { id, name, type, role: 'admin' } }, 201);
}

const SETTING_FIELDS = {
  psychologist_name: 160,
  psychologist_sipp: 80,
  validator_name: 160,
  validator_title: 120,
  approver_name: 160,
  approver_title: 120,
  report_note: 300
};

async function getOrg(env, user, orgId) {
  const { org, role } = await orgAccess(env, user, orgId, 'viewer');
  return json({ org: { ...org, role } });
}

async function saveSettings(request, env, user, orgId) {
  const { org } = await orgAccess(env, user, orgId, 'admin');
  const body = await readJson(request);
  const settings = { ...org.settings };
  for (const [k, max] of Object.entries(SETTING_FIELDS)) if (k in body) settings[k] = str(body[k], max);
  const name = str(body.name, 160) || org.name;
  await env.DB.prepare('UPDATE organizations SET name = ?, settings = ? WHERE id = ?').bind(name, JSON.stringify(settings), orgId).run();
  return json({ ok: true });
}

// ---------------- members ----------------

async function listMembers(env, user, orgId) {
  await orgAccess(env, user, orgId, 'admin');
  const { results } = await env.DB.prepare(
    'SELECT u.id, u.name, u.email, m.role, m.created_at FROM org_members m JOIN users u ON u.id = m.user_id WHERE m.org_id = ? ORDER BY u.name'
  )
    .bind(orgId)
    .all();
  return json({ members: results || [] });
}

async function addMember(request, env, user, orgId) {
  await orgAccess(env, user, orgId, 'admin');
  const body = await readJson(request);
  const email = str(body.email, 200).toLowerCase();
  const role = ROLES.includes(body.role) ? body.role : null;
  if (!role) throw new HttpError(400, 'Pilih peran anggota');
  const target = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (!target) throw new HttpError(404, 'Email ini belum terdaftar. Minta orang tersebut membuat akun di aplikasi terlebih dulu.');
  await env.DB.prepare(
    `INSERT INTO org_members (org_id, user_id, role, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(org_id, user_id) DO UPDATE SET role = excluded.role`
  )
    .bind(orgId, target.id, role, now())
    .run();
  return json({ ok: true }, 201);
}

async function removeMember(env, user, orgId, memberId) {
  await orgAccess(env, user, orgId, 'admin');
  if (memberId === user.id) throw new HttpError(400, 'Anda tidak bisa menghapus diri sendiri');
  await env.DB.prepare('DELETE FROM org_members WHERE org_id = ? AND user_id = ?').bind(orgId, memberId).run();
  return json({ ok: true });
}

// ---------------- job standards ----------------

async function loadStandards(env, orgId) {
  const { results } = await env.DB.prepare('SELECT id, code, name, scores, updated_at FROM job_standards WHERE org_id = ? ORDER BY code')
    .bind(orgId)
    .all();
  return (results || []).map((s) => ({ ...s, scores: JSON.parse(s.scores) }));
}

async function listStandards(env, user, orgId) {
  await orgAccess(env, user, orgId, 'viewer');
  return json({ standards: await loadStandards(env, orgId) });
}

function cleanStandard(body) {
  const code = str(body.code, 30).toUpperCase().replace(/\s+/g, '-');
  const name = str(body.name, 120);
  const scores = Array.isArray(body.scores) ? body.scores.map((x) => Number(x)) : null;
  if (!code) throw new HttpError(400, 'Kode standar wajib diisi');
  if (!name) throw new HttpError(400, 'Nama standar wajib diisi');
  if (!isValidScores(scores)) throw new HttpError(400, 'Setiap aspek harus bernilai 1 sampai 5');
  return { code, name, scores };
}

async function saveStandard(request, env, user, orgId, standardId) {
  await orgAccess(env, user, orgId, 'admin');
  const s = cleanStandard(await readJson(request));
  const dup = await env.DB.prepare('SELECT id FROM job_standards WHERE org_id = ? AND code = ?').bind(orgId, s.code).first();
  if (dup && dup.id !== standardId) throw new HttpError(409, `Kode ${s.code} sudah dipakai`);
  const ts = now();
  if (standardId) {
    const r = await env.DB.prepare('UPDATE job_standards SET code = ?, name = ?, scores = ?, updated_at = ? WHERE id = ? AND org_id = ?')
      .bind(s.code, s.name, JSON.stringify(s.scores), ts, standardId, orgId)
      .run();
    if (!r.meta.changes) throw new HttpError(404, 'Standar tidak ditemukan');
    return json({ ok: true });
  }
  const id = randomId();
  await env.DB.prepare('INSERT INTO job_standards (id, org_id, code, name, scores, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, orgId, s.code, s.name, JSON.stringify(s.scores), ts, ts)
    .run();
  return json({ id }, 201);
}

async function deleteStandard(env, user, orgId, standardId) {
  await orgAccess(env, user, orgId, 'admin');
  await env.DB.prepare('DELETE FROM job_standards WHERE id = ? AND org_id = ?').bind(standardId, orgId).run();
  return json({ ok: true });
}

// ---------------- assessments ----------------

const LEADERSHIP_KEYS = LEADERSHIP_STYLES.map((l) => l.key);
const NARRATIVE_FIELDS = ['work_style', 'strengths', 'development', 'conclusion', 'notes'];

function cleanDate(v) {
  const s = str(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function intOrNull(v, min, max) {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function normalizeAssessment(body, standardsByCode) {
  const name = str(body.name, 120);
  if (!name) throw new Error('Nama peserta wajib diisi');
  const code = str(body.standard_code, 30).toUpperCase();
  const standard = standardsByCode[code];
  if (!standard) throw new Error(`Standar jabatan "${code || '-'}" tidak ditemukan`);
  const scores = Array.isArray(body.scores) ? body.scores.map((x) => Number(x)) : null;
  if (!isValidScores(scores)) throw new Error('Nilai 18 aspek harus lengkap, masing-masing 1 sampai 5');
  const result = evaluate(scores, standard.scores);
  const finalRec = RECOMMENDATIONS[body.final_recommendation] ? body.final_recommendation : result.recommendation;
  const narrative = {};
  for (const f of NARRATIVE_FIELDS) narrative[f] = str(body[f], 3000);
  return {
    nik: str(body.nik, 40),
    name,
    gender: str(body.gender, 20),
    age: intOrNull(body.age, 15, 90),
    education: str(body.education, 40),
    position: str(body.position, 160),
    division: str(body.division, 120),
    location: str(body.location, 120),
    employment: str(body.employment, 40),
    standard_code: standard.code,
    standard_scores: JSON.stringify(standard.scores),
    assess_date: cleanDate(body.assess_date),
    purpose: str(body.purpose, 120),
    target_position: str(body.target_position, 160),
    scores: JSON.stringify(scores),
    iq: intOrNull(body.iq, 40, 200),
    disc: str(body.disc, 20).toUpperCase(),
    leadership: LEADERSHIP_KEYS.includes(body.leadership) ? body.leadership : '',
    gap: result.gap,
    match_count: result.match,
    talent: result.talent,
    fit: result.fit,
    potential: result.potential,
    box: result.box,
    recommendation: result.recommendation,
    final_recommendation: finalRec,
    narrative
  };
}

const COLS = [
  'nik', 'name', 'gender', 'age', 'education', 'position', 'division', 'location', 'employment', 'standard_code',
  'standard_scores', 'assess_date', 'purpose', 'target_position', 'scores', 'iq', 'disc', 'leadership', 'gap',
  'match_count', 'talent', 'fit', 'potential', 'box', 'recommendation', 'final_recommendation'
];

async function insertStatement(env, orgId, userId, rec, id = randomId()) {
  const ts = now();
  const narrativeEnc = await encryptJson(rec.narrative, env.ENCRYPTION_KEY);
  const cols = ['id', 'org_id', ...COLS, 'narrative_enc', 'created_by', 'created_at', 'updated_at'];
  const vals = [id, orgId, ...COLS.map((c) => rec[c]), narrativeEnc, userId, ts, ts];
  return env.DB.prepare(`INSERT INTO assessments (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).bind(...vals);
}

async function standardsMap(env, orgId) {
  const map = {};
  for (const s of await loadStandards(env, orgId)) map[s.code] = s;
  return map;
}

function filterSql(url) {
  const where = ['org_id = ?'];
  const args = [];
  const p = url.searchParams;
  const eq = { standard: 'standard_code', division: 'division', box: 'box', recommendation: 'final_recommendation', fit: 'fit', potential: 'potential' };
  for (const [param, col] of Object.entries(eq)) {
    const v = p.get(param);
    if (v) {
      where.push(`${col} = ?`);
      args.push(v);
    }
  }
  const q = str(p.get('q'), 80);
  if (q) {
    where.push('(name LIKE ? OR nik LIKE ? OR position LIKE ?)');
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  return { where: where.join(' AND '), args };
}

async function listAssessments(request, env, user, orgId) {
  await orgAccess(env, user, orgId, 'viewer');
  const url = new URL(request.url);
  const { where, args } = filterSql(url);
  const { results } = await env.DB.prepare(
    `SELECT id, nik, name, position, division, location, standard_code, assess_date, purpose, target_position, iq, disc, leadership,
            scores, gap, match_count, talent, fit, potential, box, recommendation, final_recommendation, updated_at
     FROM assessments WHERE ${where} ORDER BY name LIMIT 5000`
  )
    .bind(orgId, ...args)
    .all();
  return json({ assessments: (results || []).map((r) => ({ ...r, scores: JSON.parse(r.scores) })) });
}

async function getAssessment(env, user, orgId, id) {
  await orgAccess(env, user, orgId, 'viewer');
  const r = await env.DB.prepare('SELECT * FROM assessments WHERE id = ? AND org_id = ?').bind(id, orgId).first();
  if (!r) throw new HttpError(404, 'Data asesmen tidak ditemukan');
  const narrative = (await decryptJson(r.narrative_enc, env.ENCRYPTION_KEY)) || {};
  const { narrative_enc, ...rest } = r;
  let kraepelin = null;
  const link = await env.DB.prepare('SELECT user_id FROM org_participants WHERE assessment_id = ? AND org_id = ?').bind(id, orgId).first();
  if (link) {
    const k = (await latestResults(env, link.user_id)).kraepelin;
    if (k) kraepelin = { speed: k.speed, errorRate: k.errorRate, variation: k.variation, endurance: k.endurance, levels: k.levels, completedAt: k.completedAt };
  }
  return json({
    assessment: { ...rest, ...narrative, scores: JSON.parse(r.scores), standard_scores: JSON.parse(r.standard_scores), kraepelin }
  });
}

async function createAssessment(request, env, user, orgId) {
  await orgAccess(env, user, orgId, 'assessor');
  let rec;
  const body = await readJson(request);
  try {
    rec = normalizeAssessment(body, await standardsMap(env, orgId));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, err.message);
  }
  const id = randomId();
  await (await insertStatement(env, orgId, user.id, rec, id)).run();
  if (body.participant_id) {
    await env.DB.prepare('UPDATE org_participants SET assessment_id = ? WHERE id = ? AND org_id = ?').bind(id, str(body.participant_id, 40), orgId).run();
  }
  return json({ id }, 201);
}

async function updateAssessment(request, env, user, orgId, id) {
  await orgAccess(env, user, orgId, 'assessor');
  const existing = await env.DB.prepare('SELECT id FROM assessments WHERE id = ? AND org_id = ?').bind(id, orgId).first();
  if (!existing) throw new HttpError(404, 'Data asesmen tidak ditemukan');
  let rec;
  try {
    rec = normalizeAssessment(await readJson(request), await standardsMap(env, orgId));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, err.message);
  }
  const narrativeEnc = await encryptJson(rec.narrative, env.ENCRYPTION_KEY);
  await env.DB.prepare(
    `UPDATE assessments SET ${COLS.map((c) => `${c} = ?`).join(', ')}, narrative_enc = ?, updated_at = ? WHERE id = ? AND org_id = ?`
  )
    .bind(...COLS.map((c) => rec[c]), narrativeEnc, now(), id, orgId)
    .run();
  return json({ id });
}

async function deleteAssessment(env, user, orgId, id) {
  await orgAccess(env, user, orgId, 'admin');
  await env.DB.prepare('DELETE FROM assessments WHERE id = ? AND org_id = ?').bind(id, orgId).run();
  return json({ ok: true });
}

async function importAssessments(request, env, user, orgId) {
  await orgAccess(env, user, orgId, 'assessor');
  const body = await readJson(request, 2_000_000);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) throw new HttpError(400, 'Tidak ada baris untuk diimpor');
  if (rows.length > MAX_IMPORT) throw new HttpError(400, `Maksimal ${MAX_IMPORT} baris per impor`);
  const standards = await standardsMap(env, orgId);
  const errors = [];
  const stmts = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      stmts.push(await insertStatement(env, orgId, user.id, normalizeAssessment(rows[i] || {}, standards)));
    } catch (err) {
      errors.push({ row: i + 1, error: err.message });
    }
  }
  if (errors.length && !body.skipInvalid) return json({ created: 0, errors }, 400);
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return json({ created: stmts.length, errors });
}

// ---------------- invites & participants ----------------

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

async function listInvites(env, user, orgId) {
  await orgAccess(env, user, orgId, 'viewer');
  const { results } = await env.DB.prepare(
    `SELECT i.*, (SELECT COUNT(*) FROM org_participants p WHERE p.invite_id = i.id) AS joined
     FROM org_invites i WHERE i.org_id = ? ORDER BY i.created_at DESC`
  )
    .bind(orgId)
    .all();
  return json({ invites: (results || []).map((i) => ({ ...i, tests: JSON.parse(i.tests), active: !!i.active })) });
}

async function createInvite(request, env, user, orgId) {
  await orgAccess(env, user, orgId, 'assessor');
  const body = await readJson(request);
  const name = str(body.name, 120);
  if (!name) throw new HttpError(400, 'Nama gelombang asesmen wajib diisi');
  const tests = (Array.isArray(body.tests) ? body.tests : []).filter((t) => INVITE_TESTS[t]);
  if (!tests.length) throw new HttpError(400, 'Pilih minimal satu tes');
  const id = randomId();
  let code = newCode();
  for (let i = 0; i < 3; i++) {
    const dup = await env.DB.prepare('SELECT 1 AS x FROM org_invites WHERE code = ?').bind(code).first();
    if (!dup) break;
    code = newCode();
  }
  await env.DB.prepare(
    'INSERT INTO org_invites (id, org_id, code, name, standard_code, purpose, tests, active, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
  )
    .bind(id, orgId, code, name, str(body.standard_code, 30).toUpperCase(), str(body.purpose, 120), JSON.stringify(tests), user.id, now())
    .run();
  return json({ id, code }, 201);
}

async function updateInvite(request, env, user, orgId, inviteId) {
  await orgAccess(env, user, orgId, 'assessor');
  const body = await readJson(request);
  await env.DB.prepare('UPDATE org_invites SET active = ? WHERE id = ? AND org_id = ?').bind(body.active ? 1 : 0, inviteId, orgId).run();
  return json({ ok: true });
}

function testStatus(done, joinedAt, tests) {
  const out = {};
  for (const t of tests) out[t] = done[t] && done[t].completedAt >= joinedAt ? done[t].completedAt : null;
  return out;
}

async function listParticipants(request, env, user, orgId) {
  await orgAccess(env, user, orgId, 'viewer');
  const url = new URL(request.url);
  const inviteId = url.searchParams.get('invite');
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.invite_id, p.user_id, p.nik, p.position, p.division, p.assessment_id, p.created_at,
            u.name, u.email, i.tests, i.name AS invite_name
     FROM org_participants p JOIN users u ON u.id = p.user_id JOIN org_invites i ON i.id = p.invite_id
     WHERE p.org_id = ? ${inviteId ? 'AND p.invite_id = ?' : ''} ORDER BY p.created_at DESC LIMIT 2000`
  )
    .bind(...(inviteId ? [orgId, inviteId] : [orgId]))
    .all();
  const rows = results || [];
  // One query for all completed tests of these users.
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const done = {};
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const res = await env.DB.prepare(
      `SELECT user_id, test_id, MAX(created_at) AS completedAt FROM test_results WHERE user_id IN (${chunk.map(() => '?').join(',')}) GROUP BY user_id, test_id`
    )
      .bind(...chunk)
      .all();
    for (const r of res.results || []) (done[r.user_id] = done[r.user_id] || {})[r.test_id] = { completedAt: r.completedAt };
  }
  return json({
    participants: rows.map((r) => {
      const tests = JSON.parse(r.tests);
      return {
        id: r.id,
        invite_id: r.invite_id,
        invite_name: r.invite_name,
        name: r.name,
        email: r.email,
        nik: r.nik,
        position: r.position,
        division: r.division,
        assessment_id: r.assessment_id,
        joined_at: r.created_at,
        tests: testStatus(done[r.user_id] || {}, r.created_at, tests)
      };
    })
  });
}

async function getParticipant(env, user, orgId, pid) {
  const { role } = await orgAccess(env, user, orgId, 'viewer');
  const p = await env.DB.prepare(
    `SELECT p.*, u.name, u.email, i.tests, i.name AS invite_name, i.standard_code, i.purpose
     FROM org_participants p JOIN users u ON u.id = p.user_id JOIN org_invites i ON i.id = p.invite_id
     WHERE p.id = ? AND p.org_id = ?`
  )
    .bind(pid, orgId)
    .first();
  if (!p) throw new HttpError(404, 'Peserta tidak ditemukan');
  const tests = JSON.parse(p.tests);
  const all = await latestResults(env, p.user_id);
  const status = testStatus(all, p.created_at, tests);
  const base = {
    id: p.id,
    name: p.name,
    email: p.email,
    nik: p.nik,
    position: p.position,
    division: p.division,
    invite_name: p.invite_name,
    standard_code: p.standard_code,
    purpose: p.purpose,
    assessment_id: p.assessment_id,
    joined_at: p.created_at,
    consent_at: p.consent_at,
    tests: status
  };
  // Raw psychological test results are for the psychologist and assessors, not HR viewers.
  if (ROLE_RANK[role] < ROLE_RANK.assessor) return json({ participant: base, restricted: true });
  const results = {};
  for (const t of tests) if (status[t]) results[t] = all[t];
  return json({ participant: { ...base, results, suggestions: suggestScores(results) } });
}

async function updateParticipant(request, env, user, orgId, pid) {
  await orgAccess(env, user, orgId, 'assessor');
  const body = await readJson(request);
  const r = await env.DB.prepare('UPDATE org_participants SET nik = ?, position = ?, division = ? WHERE id = ? AND org_id = ?')
    .bind(str(body.nik, 40), str(body.position, 160), str(body.division, 120), pid, orgId)
    .run();
  if (!r.meta.changes) throw new HttpError(404, 'Peserta tidak ditemukan');
  return json({ ok: true });
}

// Removes the employee from this organization. Their own account and test results stay theirs;
// an assessment (psikogram) already made from their results stays in the Peserta list.
async function removeParticipant(env, user, orgId, pid) {
  await orgAccess(env, user, orgId, 'admin');
  await env.DB.prepare('DELETE FROM org_participants WHERE id = ? AND org_id = ?').bind(pid, orgId).run();
  return json({ ok: true });
}

// ---------------- dashboard ----------------

async function dashboard(request, env, user, orgId) {
  await orgAccess(env, user, orgId, 'viewer');
  const url = new URL(request.url);
  const { where, args } = filterSql(url);
  const { results } = await env.DB.prepare(
    `SELECT standard_code, division, scores, standard_scores, fit, potential, box, final_recommendation FROM assessments WHERE ${where}`
  )
    .bind(orgId, ...args)
    .all();
  const rows = results || [];

  const count = (key) => rows.reduce((acc, r) => ((acc[r[key]] = (acc[r[key]] || 0) + 1), acc), {});
  const aspectGap = ASPECTS.map(() => 0);
  const aspectSum = ASPECTS.map(() => 0);
  const byStandard = {};
  const byDivision = {};
  for (const r of rows) {
    const s = JSON.parse(r.scores);
    const req = JSON.parse(r.standard_scores);
    s.forEach((v, i) => {
      aspectSum[i] += v;
      if (v < req[i]) aspectGap[i]++;
    });
    for (const [bucket, key] of [[byStandard, r.standard_code], [byDivision, r.division || '(tanpa divisi)']]) {
      bucket[key] = bucket[key] || { total: 0, disarankan: 0, dipertimbangkan: 0, catatan: 0, tidak: 0 };
      bucket[key].total++;
      bucket[key][r.final_recommendation]++;
    }
  }

  const all = await env.DB.prepare(
    "SELECT DISTINCT division FROM assessments WHERE org_id = ? AND division IS NOT NULL AND division != '' ORDER BY division"
  )
    .bind(orgId)
    .all();

  return json({
    total: rows.length,
    boxes: count('box'),
    recommendations: count('final_recommendation'),
    fit: count('fit'),
    potential: count('potential'),
    aspects: ASPECTS.map((a, i) => ({
      key: a.key,
      name: a.name,
      group: a.group,
      below: aspectGap[i],
      average: rows.length ? Math.round((aspectSum[i] / rows.length) * 100) / 100 : null
    })),
    byStandard,
    byDivision,
    divisions: (all.results || []).map((d) => d.division)
  });
}

// ---------------- demo data ----------------

const FIRST = ['Adi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hendra', 'Indah', 'Joko', 'Kartika', 'Lukman', 'Maya', 'Nanda', 'Oki', 'Putri', 'Rizky', 'Sari', 'Taufik', 'Utami', 'Wahyu', 'Yuni', 'Zaki', 'Agus', 'Bayu', 'Dian', 'Fitri', 'Galih', 'Hesti', 'Irfan'];
const LAST = ['Pratama', 'Santoso', 'Wijaya', 'Saputra', 'Lestari', 'Hidayat', 'Kusuma', 'Nugroho', 'Purnama', 'Setiawan', 'Rahmawati', 'Siregar', 'Hasibuan', 'Wibowo', 'Gunawan', 'Halim', 'Permana', 'Utomo', 'Susanti', 'Firmansyah'];
const DIVISIONS = ['Operasional', 'Keuangan', 'SDM', 'Teknologi Informasi', 'Komersial', 'Pengadaan', 'HSE'];
const POSITIONS = { L1: ['Kepala Divisi'], L2: ['Manajer'], L3: ['Supervisor', 'Koordinator'], L4: ['Staf', 'Analis', 'Officer'] };
const DISC = ['D', 'I', 'S', 'C', 'D-I', 'I-S', 'S-C', 'C-D', 'C-S', 'D-C', 'I-D', 'S-I'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedDemo(env, user, orgId) {
  if (!isPlatformAdmin(env, user)) throw new HttpError(403, 'Hanya admin platform yang dapat membuat data contoh');
  await orgAccess(env, user, orgId, 'admin');
  const standards = await standardsMap(env, orgId);
  const codes = Object.keys(standards);
  if (!codes.length) throw new HttpError(400, 'Buat standar jabatan terlebih dulu');
  const weights = { L1: 1, L2: 2, L3: 4, L4: 8 };
  const pool = codes.flatMap((c) => Array(weights[c] || 3).fill(c));
  const stmts = [];
  for (let i = 0; i < 120; i++) {
    const code = pick(pool);
    const req = standards[code].scores;
    // Tuned so demo data spreads over all nine boxes, roughly like real assessment results.
    const bias = pick([-0.3, -0.15, 0, 0, 0.15, 0.3]);
    const scores = req.map((r) => Math.max(1, Math.min(5, Math.round(r + bias + pick([-1, -1, 0, 0, 0, 1, 1, 1]) * 0.7))));
    const above = ASPECTS.filter((_, k) => scores[k] > req[k]).map((a) => a.name);
    const below = ASPECTS.filter((_, k) => scores[k] < req[k]).map((a) => a.name);
    const d = new Date(Date.now() - Math.floor(Math.random() * 300) * 86400000).toISOString().slice(0, 10);
    const body = {
      nik: String(10000 + i),
      name: `${pick(FIRST)} ${pick(LAST)}`,
      gender: pick(['Laki-laki', 'Perempuan']),
      age: 23 + Math.floor(Math.random() * 30),
      education: pick(['D3', 'S1', 'S1', 'S2']),
      position: pick(POSITIONS[code] || ['Staf']),
      division: pick(DIVISIONS),
      location: pick(['Kantor Pusat', 'Kantor Pusat', 'Regional Barat', 'Regional Timur']),
      employment: pick(['PKWTT', 'PKWTT', 'PKWT']),
      standard_code: code,
      assess_date: d,
      purpose: pick(['Talent Assessment', 'Talent Assessment', 'Promosi', 'Rotasi']),
      scores,
      iq: 85 + Math.floor(Math.random() * 40),
      disc: pick(DISC),
      leadership: pick(LEADERSHIP_KEYS),
      strengths: above.length ? `Menonjol pada aspek ${above.slice(0, 4).join(', ')}.` : '',
      development: below.length ? `Perlu pengembangan pada aspek ${below.slice(0, 4).join(', ')}.` : '',
      conclusion: '',
      notes: 'Data contoh untuk demonstrasi.'
    };
    stmts.push(await insertStatement(env, orgId, user.id, normalizeAssessment(body, standards)));
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return json({ created: stmts.length }, 201);
}

async function clearAll(env, user, orgId) {
  await orgAccess(env, user, orgId, 'admin');
  await env.DB.prepare('DELETE FROM assessments WHERE org_id = ?').bind(orgId).run();
  return json({ ok: true });
}

// ---------------- router ----------------

export async function handleOrg(request, env, path, m, user) {
  if (path === '/api/org/mine' && m === 'GET') return myOrgs(env, user);
  if (path === '/api/admin/orgs' && m === 'POST') return createOrg(request, env, user);

  const r = path.match(/^\/api\/org\/([0-9a-f-]{36})(?:\/([a-z]+)(?:\/([0-9a-f-]{36}|import))?)?$/);
  if (!r) return null;
  const [, orgId, section, sub] = r;

  if (!section && m === 'GET') return getOrg(env, user, orgId);
  if (section === 'settings' && m === 'PUT') return saveSettings(request, env, user, orgId);
  if (section === 'dashboard' && m === 'GET') return dashboard(request, env, user, orgId);
  if (section === 'demo' && m === 'POST') return seedDemo(env, user, orgId);

  if (section === 'invites') {
    if (!sub && m === 'GET') return listInvites(env, user, orgId);
    if (!sub && m === 'POST') return createInvite(request, env, user, orgId);
    if (sub && m === 'PUT') return updateInvite(request, env, user, orgId, sub);
  }
  if (section === 'participants') {
    if (!sub && m === 'GET') return listParticipants(request, env, user, orgId);
    if (sub && m === 'GET') return getParticipant(env, user, orgId, sub);
    if (sub && m === 'PUT') return updateParticipant(request, env, user, orgId, sub);
    if (sub && m === 'DELETE') return removeParticipant(env, user, orgId, sub);
  }
  if (section === 'members') {
    if (!sub && m === 'GET') return listMembers(env, user, orgId);
    if (!sub && m === 'POST') return addMember(request, env, user, orgId);
    if (sub && m === 'DELETE') return removeMember(env, user, orgId, sub);
  }
  if (section === 'standards') {
    if (!sub && m === 'GET') return listStandards(env, user, orgId);
    if (!sub && m === 'POST') return saveStandard(request, env, user, orgId, null);
    if (sub && m === 'PUT') return saveStandard(request, env, user, orgId, sub);
    if (sub && m === 'DELETE') return deleteStandard(env, user, orgId, sub);
  }
  if (section === 'assessments') {
    if (!sub && m === 'GET') return listAssessments(request, env, user, orgId);
    if (!sub && m === 'POST') return createAssessment(request, env, user, orgId);
    if (!sub && m === 'DELETE') return clearAll(env, user, orgId);
    if (sub === 'import' && m === 'POST') return importAssessments(request, env, user, orgId);
    if (sub && sub !== 'import' && m === 'GET') return getAssessment(env, user, orgId, sub);
    if (sub && sub !== 'import' && m === 'PUT') return updateAssessment(request, env, user, orgId, sub);
    if (sub && sub !== 'import' && m === 'DELETE') return deleteAssessment(env, user, orgId, sub);
  }
  return null;
}

