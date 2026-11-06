import { SCHEMA } from './schema.js';
import { HttpError, json, readJson, str, now } from './http.js';
import { handleOrg, userHasOrg } from './org.js';
import { latestResults } from './results.js';
import { handleParticipant, myAssignments } from './participant.js';
import { handleSchedule } from './schedule.js';
import { handlePsych } from './psych.js';
import { handleAdmin } from './admin.js';
import { handlePool } from './pool.js';
import { isPlatformAdmin } from './org.js';
import { deleteUserData } from './userdata.js';
import { validBirthDate, setBirthDate, getBirthDate, consentSummary, saveMyBirthDate } from './guardian.js';
import { TESTS, COMING_SOON, publicTest, validateAnswers } from './tests.js';
import {
  hashPassword,
  verifyPassword,
  signJwt,
  verifyJwt,
  encryptText,
  encryptJson,
  decryptJson,
  randomId
} from './crypto.js';

const SESSION_COOKIE = 'tc_session';
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

// ---------------- helpers ----------------

function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

function sessionCookie(token, maxAge) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

function requireSecrets(env) {
  if (!env.JWT_SECRET || !env.ENCRYPTION_KEY) {
    throw new HttpError(500, 'Server is missing JWT_SECRET or ENCRYPTION_KEY');
  }
  if (!env.DB) throw new HttpError(500, 'Server is missing the DB (D1) binding');
}

let schemaReady = null;
function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch(SCHEMA.map((sql) => env.DB.prepare(sql))).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

async function currentUser(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) return null;
  return env.DB.prepare('SELECT id, email, name, role FROM users WHERE id = ?').bind(payload.sub).first();
}

async function requireUser(request, env) {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, 'Please log in');
  return user;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------- auth ----------------

async function register(request, env) {
  const body = await readJson(request);
  const name = str(body.name, 120);
  const email = str(body.email, 200).toLowerCase();
  const phone = str(body.phone, 30);
  const password = String(body.password || '');
  if (!name) throw new HttpError(400, 'Please enter your name');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Please enter a valid email');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');
  if (body.consent !== true) throw new HttpError(400, 'Please agree to the Terms and Privacy Policy');
  const birthDate = validBirthDate(body.birth_date);

  const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (exists) throw new HttpError(409, 'An account with this email already exists');

  const id = randomId();
  const ts = now();
  await env.DB.prepare(
    'INSERT INTO users (id, email, name, phone_enc, password_hash, role, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  )
    .bind(id, email, name, phone ? await encryptText(phone, env.ENCRYPTION_KEY) : null, await hashPassword(password), 'user', ts, ts)
    .run();
  await setBirthDate(env, id, birthDate);

  const token = await signJwt({ sub: id }, env.JWT_SECRET, SESSION_TTL);
  return json({ user: { id, email, name, role: 'user' } }, 201, { 'set-cookie': sessionCookie(token, SESSION_TTL) });
}

async function login(request, env) {
  const body = await readJson(request);
  const email = str(body.email, 200).toLowerCase();
  const password = String(body.password || '');
  const row = await env.DB.prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ?').bind(email).first();
  const ok = row ? await verifyPassword(password, row.password_hash) : false;
  if (!ok) throw new HttpError(401, 'Email or password is incorrect');
  const token = await signJwt({ sub: row.id }, env.JWT_SECRET, SESSION_TTL);
  return json(
    { user: { id: row.id, email: row.email, name: row.name, role: row.role } },
    200,
    { 'set-cookie': sessionCookie(token, SESSION_TTL) }
  );
}

function logout() {
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
}

async function me(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ user: null });
  const profile = await env.DB.prepare('SELECT segment FROM profiles WHERE user_id = ?').bind(user.id).first();
  return json({
    user,
    birthDate: await getBirthDate(env, user.id),
    ...(await consentSummary(env, user.id)),
    hasProfile: !!(profile && profile.segment),
    hasOrg: await userHasOrg(env, user),
    isAdmin: isPlatformAdmin(env, user),
    isPsychologist: user.role === 'psychologist'
  });
}

async function deleteAccount(request, env) {
  const user = await requireUser(request, env);
  await deleteUserData(env, user.id);
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
}

// ---------------- profile & CV ----------------

function cleanList(list, fields, maxItems = 10) {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, maxItems)
    .map((item) => {
      const out = {};
      for (const [f, max] of Object.entries(fields)) out[f] = str(item && item[f], max);
      return out;
    })
    .filter((item) => Object.values(item).some((v) => v));
}

async function getProfile(request, env) {
  const user = await requireUser(request, env);
  const row = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(user.id).first();
  if (!row) return json({ profile: null });
  const cv = (await decryptJson(row.cv_enc, env.ENCRYPTION_KEY)) || {};
  return json({
    profile: {
      segment: row.segment,
      education_level: row.education_level,
      field: row.field,
      school: row.school,
      skills: row.skills ? row.skills.split('|') : [],
      education: cv.education || [],
      experience: cv.experience || [],
      certifications: cv.certifications || [],
      summary: cv.summary || ''
    }
  });
}

async function saveProfile(request, env) {
  const user = await requireUser(request, env);
  const body = await readJson(request);
  const segment = body.segment === 'student' ? 'student' : body.segment === 'jobseeker' ? 'jobseeker' : null;
  if (!segment) throw new HttpError(400, 'Please choose Student or Jobseeker');

  const skills = (Array.isArray(body.skills) ? body.skills : String(body.skills || '').split(','))
    .map((s) => str(s, 60).replace(/\|/g, ' '))
    .filter(Boolean)
    .slice(0, 40);

  const cv = {
    summary: str(body.summary, 1000),
    education: cleanList(body.education, { institution: 120, degree: 80, major: 120, start: 10, end: 10 }),
    experience: cleanList(body.experience, { title: 120, company: 120, start: 10, end: 10, description: 1000 }),
    certifications: cleanList(body.certifications, { name: 160, issuer: 120, year: 10 })
  };

  await env.DB.prepare(
    `INSERT INTO profiles (user_id, segment, education_level, field, school, skills, cv_enc, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET segment = excluded.segment, education_level = excluded.education_level,
       field = excluded.field, school = excluded.school, skills = excluded.skills, cv_enc = excluded.cv_enc,
       updated_at = excluded.updated_at`
  )
    .bind(
      user.id,
      segment,
      str(body.education_level, 80),
      str(body.field, 120),
      str(body.school, 160),
      skills.join('|'),
      await encryptJson(cv, env.ENCRYPTION_KEY),
      now()
    )
    .run();
  // Profile changed, so old AI career matches are stale.
  await env.DB.prepare('DELETE FROM insights WHERE user_id = ?').bind(user.id).run();
  return json({ ok: true });
}

// ---------------- tests ----------------

async function listTests(request, env) {
  const user = await requireUser(request, env);
  const done = await latestResults(env, user.id);
  const tests = Object.values(TESTS).map((t) => ({
    id: t.id,
    code: t.code,
    name: t.name,
    minutes: t.minutes,
    count: t.questions.length,
    status: done[t.id] ? 'done' : 'todo'
  }));
  tests.push({
    id: 'kraepelin',
    code: 'KR',
    name: 'Work attitude (Kraepelin)',
    minutes: 12,
    count: null,
    status: done.kraepelin ? 'done' : 'todo'
  });
  const assignments = await myAssignments(env, user, done);
  const required = new Set(assignments.flatMap((a) => a.tests.filter((t) => !t.done).map((t) => t.id)));
  for (const t of tests) t.required = required.has(t.id);
  const soon = COMING_SOON.map((t) => ({ ...t, status: 'soon' }));
  return json({ tests: [...tests, ...soon], assignments });
}

async function getTest(request, env, id) {
  await requireUser(request, env);
  const test = TESTS[id];
  if (!test) throw new HttpError(404, 'Test not found');
  return json({ test: publicTest(test) });
}

async function submitTest(request, env, id) {
  const user = await requireUser(request, env);
  const test = TESTS[id];
  if (!test) throw new HttpError(404, 'Test not found');
  const body = await readJson(request);
  if (!validateAnswers(test, body.answers)) throw new HttpError(400, 'Please answer every question');
  const result = test.score(body.answers);
  await env.DB.prepare('INSERT INTO test_results (id, user_id, test_id, answers_enc, result, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(randomId(), user.id, id, await encryptJson(body.answers, env.ENCRYPTION_KEY), JSON.stringify(result), now())
    .run();
  await env.DB.prepare('DELETE FROM insights WHERE user_id = ?').bind(user.id).run();
  return json({ result });
}

async function getResults(request, env) {
  const user = await requireUser(request, env);
  const results = await latestResults(env, user.id);
  const row = await env.DB.prepare('SELECT content, created_at FROM insights WHERE user_id = ?').bind(user.id).first();
  return json({ results, insights: row ? { ...JSON.parse(row.content), createdAt: row.created_at } : null });
}

// ---------------- AI career / major matching (Workers AI) ----------------

function extractJson(text) {
  if (text && typeof text === 'object') return text;
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}

const INSIGHT_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, why: { type: 'string' }, fit: { type: 'string' } },
        required: ['title', 'why', 'fit']
      }
    },
    strengths: { type: 'array', items: { type: 'string' } },
    growth: { type: 'array', items: { type: 'string' } }
  },
  required: ['summary', 'matches', 'strengths', 'growth']
};

async function generateInsights(request, env) {
  const user = await requireUser(request, env);
  if (!env.AI) throw new HttpError(500, 'Server is missing the AI (Workers AI) binding');

  const results = await latestResults(env, user.id);
  if (!results.type16 && !results.bigfive) throw new HttpError(400, 'Finish at least one test first');

  const prof = await env.DB.prepare('SELECT * FROM profiles WHERE user_id = ?').bind(user.id).first();
  const cv = prof ? (await decryptJson(prof.cv_enc, env.ENCRYPTION_KEY)) || {} : {};
  const student = prof && prof.segment === 'student';

  const lines = [];
  lines.push(`Segment: ${student ? 'student choosing a study major' : 'jobseeker choosing career roles'} in Indonesia`);
  if (prof) {
    lines.push(`Education level: ${prof.education_level || '-'}; field/stream: ${prof.field || '-'}; school: ${prof.school || '-'}`);
    if (prof.skills) lines.push(`Skills: ${prof.skills.split('|').join(', ')}`);
  }
  if (cv.summary) lines.push(`About: ${cv.summary}`);
  for (const e of cv.education || []) lines.push(`Education: ${e.degree} ${e.major} at ${e.institution} (${e.start}-${e.end})`);
  for (const e of cv.experience || []) lines.push(`Experience: ${e.title} at ${e.company} (${e.start}-${e.end}). ${e.description || ''}`);
  for (const c of cv.certifications || []) lines.push(`Certification: ${c.name} ${c.issuer ? 'by ' + c.issuer : ''} ${c.year || ''}`);
  if (results.type16) {
    const t = results.type16;
    lines.push(`16-type result: ${t.code} (${t.dimensions.map((d) => `${d.aName} ${d.aPct}% / ${d.bName} ${d.bPct}%`).join('; ')})`);
  }
  if (results.bigfive) {
    lines.push(`Big Five: ${results.bigfive.traits.map((t) => `${t.name} ${t.pct}% (${t.level})`).join('; ')}`);
  }

  const target = student ? 'university majors (jurusan kuliah)' : 'job roles';
  const system =
    `You are a careful career guidance assistant supporting a licensed psychologist in Indonesia. ` +
    `Based only on the profile given, suggest 5 ${target} that fit the person. ` +
    `Personality results describe preferences, not abilities, so combine them with education, skills and experience. ` +
    `Be specific and practical, avoid stereotypes, and never claim certainty. Write in clear, simple English. ` +
    `Reply with JSON only: {"summary": string (2 sentences), "matches": [{"title": string, "why": string (one sentence linking to their results or CV), "fit": "Strong fit" or "Good fit"}], "strengths": [3 short strings], "growth": [3 short strings]}.`;

  const model = env.AI_MODEL || DEFAULT_MODEL;
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: lines.join('\n') }
  ];

  let raw;
  try {
    raw = await env.AI.run(model, {
      messages,
      max_tokens: 900,
      temperature: 0.4,
      response_format: { type: 'json_schema', json_schema: INSIGHT_SCHEMA }
    });
  } catch (err) {
    // Some models do not support JSON mode; fall back to plain prompting.
    raw = await env.AI.run(model, { messages, max_tokens: 900, temperature: 0.4 });
  }

  const parsed = extractJson(raw && raw.response !== undefined ? raw.response : raw);
  if (!parsed || !Array.isArray(parsed.matches)) throw new HttpError(502, 'The AI did not return a usable answer. Please try again.');

  const content = {
    target: student ? 'majors' : 'careers',
    summary: str(parsed.summary, 600),
    matches: parsed.matches.slice(0, 5).map((m) => ({
      title: str(m.title, 80),
      why: str(m.why, 240),
      fit: /strong/i.test(m.fit) ? 'Strong fit' : 'Good fit'
    })),
    strengths: (parsed.strengths || []).slice(0, 3).map((s) => str(s, 160)),
    growth: (parsed.growth || []).slice(0, 3).map((s) => str(s, 160))
  };
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO insights (user_id, content, model, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET content = excluded.content, model = excluded.model, created_at = excluded.created_at`
  )
    .bind(user.id, JSON.stringify(content), model, ts)
    .run();
  return json({ insights: { ...content, createdAt: ts } });
}

// ---------------- partnership inquiries (public front page) ----------------

const ORG_TYPES = ['sekolah', 'kampus', 'perusahaan', 'biro', 'psikolog', 'lainnya'];

async function ipHash(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + env.JWT_SECRET));
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function createInquiry(request, env) {
  const body = await readJson(request);
  // Honeypot field: real visitors never fill it in.
  if (str(body.website)) return json({ ok: true }, 201);
  const orgType = ORG_TYPES.includes(body.org_type) ? body.org_type : null;
  const orgName = str(body.org_name, 160);
  const contactName = str(body.contact_name, 120);
  const email = str(body.email, 200).toLowerCase();
  if (!orgType) throw new HttpError(400, 'Silakan pilih jenis organisasi');
  if (!orgName) throw new HttpError(400, 'Silakan isi nama organisasi');
  if (!contactName) throw new HttpError(400, 'Silakan isi nama Anda');
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Silakan isi email yang valid');
  if (body.consent !== true) throw new HttpError(400, 'Silakan centang persetujuan penggunaan data');

  const hash = await ipHash(request, env);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE ip_hash = ? AND created_at > ?').bind(hash, since).first();
  if (recent && recent.n >= 5) throw new HttpError(429, 'Terlalu banyak pengiriman. Silakan coba lagi nanti.');

  await env.DB.prepare(
    `INSERT INTO inquiries (id, org_type, org_name, contact_name, position, phone, email, size, message, status, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`
  )
    .bind(randomId(), orgType, orgName, contactName, str(body.position, 120), str(body.phone, 30), email, str(body.size, 40), str(body.message, 2000), hash, now())
    .run();
  return json({ ok: true }, 201);
}

// ---------------- router ----------------

async function handleApi(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '');
  const m = request.method;

  requireSecrets(env);
  await ensureSchema(env);

  if (path === '/api/health') return json({ ok: true });
  {
    const res = await handleParticipant(request, env, path, m, () => requireUser(request, env));
    if (res) return res;
  }
  {
    const res = await handleSchedule(request, env, path, m, () => requireUser(request, env));
    if (res) return res;
  }
  {
    const res = await handlePool(request, env, path, m, () => requireUser(request, env));
    if (res) return res;
  }
  if (path.startsWith('/api/psych/')) {
    const res = await handlePsych(request, env, path, m, await requireUser(request, env));
    if (res) return res;
    throw new HttpError(404, 'Not found');
  }
  if (path.startsWith('/api/org/') || path.startsWith('/api/admin/')) {
    const user = await requireUser(request, env);
    const res = (await handleAdmin(request, env, path, m, user)) || (await handleOrg(request, env, path, m, user));
    if (res) return res;
    throw new HttpError(404, 'Not found');
  }
  if (path === '/api/auth/register' && m === 'POST') return register(request, env);
  if (path === '/api/auth/login' && m === 'POST') return login(request, env);
  if (path === '/api/auth/logout' && m === 'POST') return logout();
  if (path === '/api/me' && m === 'GET') return me(request, env);
  if (path === '/api/me' && m === 'DELETE') return deleteAccount(request, env);
  if (path === '/api/me/birthdate' && m === 'PUT') return saveMyBirthDate(request, env, await requireUser(request, env));
  if (path === '/api/profile' && m === 'GET') return getProfile(request, env);
  if (path === '/api/profile' && m === 'PUT') return saveProfile(request, env);
  if (path === '/api/tests' && m === 'GET') return listTests(request, env);
  if (path === '/api/results' && m === 'GET') return getResults(request, env);
  if (path === '/api/insights' && m === 'POST') return generateInsights(request, env);
  if (path === '/api/inquiries' && m === 'POST') return createInquiry(request, env);

  const testMatch = path.match(/^\/api\/tests\/([a-z0-9]+)(\/submit)?$/);
  if (testMatch && !testMatch[2] && m === 'GET') return getTest(request, env, testMatch[1]);
  if (testMatch && testMatch[2] && m === 'POST') return submitTest(request, env, testMatch[1]);

  throw new HttpError(404, 'Not found');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.CANONICAL_HOST && env.LEGACY_HOST && url.hostname === env.LEGACY_HOST) {
      url.hostname = env.CANONICAL_HOST;
      url.protocol = 'https:';
      url.port = '';
      return Response.redirect(url.toString(), 301);
    }
    if (url.pathname.startsWith('/api/')) {
      // Block cross-site form posts: state-changing API calls must come from this origin.
      if (request.method !== 'GET') {
        const origin = request.headers.get('origin');
        if (origin && origin !== url.origin) return json({ error: 'Cross-origin request blocked' }, 403);
      }
      try {
        return await handleApi(request, env);
      } catch (err) {
        if (err instanceof HttpError) return json({ error: err.message }, err.status);
        console.error(err);
        return json({ error: 'Something went wrong. Please try again.' }, 500);
      }
    }
    return env.ASSETS.fetch(request);
  }
};
