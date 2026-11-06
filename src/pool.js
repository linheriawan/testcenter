// Talent pool: adults opt in to be found by organizations.
//
// Rules: opt-in only; the candidate picks which fields employers see; employers see an anonymous
// profile (alias, never name, email, phone, school or company names); every contact request is
// accepted or declined by the candidate, and contact details are shared only on acceptance;
// candidates can leave at any time; under-18s and users without a date of birth are excluded.

import { HttpError, json, readJson, str, now } from './http.js';
import { randomId, decryptJson, decryptText } from './crypto.js';
import { latestResults } from './results.js';
import { getBirthDate, ageOn, ADULT_AGE } from './guardian.js';
import { orgAccess } from './org.js';

const DEFAULT_SHOW = { education: true, skills: true, experience: true, personality: false, kraepelin: false, disc: false };
const DAILY_REQUEST_LIMIT = 30;
const ALIAS_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newAlias() {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return [...b].map((x) => ALIAS_CHARS[x % ALIAS_CHARS.length]).join('');
}

function cleanShow(s) {
  const out = {};
  for (const k of Object.keys(DEFAULT_SHOW)) out[k] = !!(s && s[k]);
  return out;
}

async function eligibility(env, userId) {
  const bd = await getBirthDate(env, userId);
  if (!bd) return { eligible: false, reason: 'birthdate' };
  if (ageOn(bd) < ADULT_AGE) return { eligible: false, reason: 'minor' };
  return { eligible: true };
}

const LEVEL_EN = ['', 'Very low', 'Low', 'Average', 'High', 'Very high'];

function years(start, end) {
  const a = parseInt(start, 10);
  const b = /now|sekarang|present/i.test(end || '') ? new Date().getFullYear() : parseInt(end, 10);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a : null;
}

// What an employer sees. Only fields the candidate chose; never identity or organization names.
async function candidateCard(env, tp) {
  const show = JSON.parse(tp.show);
  const card = {
    alias: `TC-${tp.alias}`,
    headline: tp.headline || '',
    city: tp.city || '',
    desired_roles: tp.desired_roles || '',
    updated_at: tp.updated_at
  };
  const prof = await env.DB.prepare('SELECT education_level, field, skills, cv_enc FROM profiles WHERE user_id = ?').bind(tp.user_id).first();
  if (show.education && prof) card.education = [prof.education_level, prof.field].filter(Boolean).join(' · ');
  if (show.skills && prof && prof.skills) card.skills = prof.skills.split('|');
  if (show.experience && prof && prof.cv_enc) {
    const cv = (await decryptJson(prof.cv_enc, env.ENCRYPTION_KEY)) || {};
    card.experience = (cv.experience || []).slice(0, 6).map((e) => ({ title: e.title, years: years(e.start, e.end) })).filter((e) => e.title);
    card.experienceYears = card.experience.reduce((a, e) => a + (e.years || 0), 0);
  }
  if (show.personality || show.kraepelin || show.disc) {
    const r = await latestResults(env, tp.user_id);
    if (show.personality) {
      if (r.type16) card.type16 = r.type16.code;
      if (r.bigfive) card.bigfive = r.bigfive.traits.map((t) => ({ name: t.name, level: t.level }));
    }
    if (show.kraepelin && r.kraepelin) {
      card.kraepelin = Object.fromEntries(Object.entries(r.kraepelin.levels).map(([k, v]) => [k, LEVEL_EN[v]]));
    }
    if (show.disc && r.disc) card.disc = r.disc.code;
  }
  return card;
}

function searchText(card) {
  return [card.headline, card.desired_roles, card.city, card.education, ...(card.skills || []), ...(card.experience || []).map((e) => e.title), card.disc, card.type16]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

// ---------------- candidate side ----------------

async function myTalent(env, user) {
  const elig = await eligibility(env, user.id);
  const tp = await env.DB.prepare('SELECT * FROM talent_profiles WHERE user_id = ?').bind(user.id).first();
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.message, r.status, r.created_at, r.responded_at, o.name AS org, o.type AS org_type
     FROM talent_requests r JOIN organizations o ON o.id = r.org_id WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 50`
  )
    .bind(user.id)
    .all();
  return json({
    ...elig,
    profile: tp
      ? { visible: !!tp.visible, alias: `TC-${tp.alias}`, headline: tp.headline, city: tp.city, desired_roles: tp.desired_roles, show: JSON.parse(tp.show) }
      : { visible: false, alias: null, headline: '', city: '', desired_roles: '', show: DEFAULT_SHOW },
    preview: tp ? await candidateCard(env, tp) : null,
    requests: results || []
  });
}

async function saveMyTalent(request, env, user) {
  const b = await readJson(request);
  const visible = b.visible === true;
  if (visible) {
    const elig = await eligibility(env, user.id);
    if (!elig.eligible) {
      throw new HttpError(403, elig.reason === 'minor' ? 'The talent pool is only for users aged 18 and over.' : 'Please add your date of birth first.');
    }
  }
  const ts = now();
  const existing = await env.DB.prepare('SELECT alias FROM talent_profiles WHERE user_id = ?').bind(user.id).first();
  const show = JSON.stringify(cleanShow(b.show));
  if (existing) {
    await env.DB.prepare('UPDATE talent_profiles SET visible = ?, headline = ?, city = ?, desired_roles = ?, show = ?, updated_at = ? WHERE user_id = ?')
      .bind(visible ? 1 : 0, str(b.headline, 140), str(b.city, 80), str(b.desired_roles, 200), show, ts, user.id)
      .run();
  } else {
    await env.DB.prepare(
      'INSERT INTO talent_profiles (user_id, alias, visible, headline, city, desired_roles, show, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(user.id, newAlias(), visible ? 1 : 0, str(b.headline, 140), str(b.city, 80), str(b.desired_roles, 200), show, ts, ts)
      .run();
  }
  if (!visible) {
    // Leaving the pool withdraws pending requests; accepted contacts stay with the organization.
    await env.DB.prepare("UPDATE talent_requests SET status = 'withdrawn', responded_at = ? WHERE user_id = ? AND status = 'pending'").bind(ts, user.id).run();
  }
  return myTalent(env, user);
}

async function respond(env, user, id, accept) {
  const r = await env.DB.prepare("SELECT id FROM talent_requests WHERE id = ? AND user_id = ? AND status = 'pending'").bind(id, user.id).first();
  if (!r) throw new HttpError(404, 'This request is no longer open.');
  await env.DB.prepare('UPDATE talent_requests SET status = ?, responded_at = ? WHERE id = ?').bind(accept ? 'accepted' : 'declined', now(), id).run();
  return json({ ok: true });
}

// ---------------- organization side ----------------

async function search(request, env, user, orgId) {
  await orgAccess(env, user, orgId, 'viewer');
  const url = new URL(request.url);
  const q = str(url.searchParams.get('q'), 100).toLowerCase();
  const edu = str(url.searchParams.get('edu'), 40).toLowerCase();
  const city = str(url.searchParams.get('city'), 80).toLowerCase();
  const need = url.searchParams.get('test');
  const { results } = await env.DB.prepare('SELECT * FROM talent_profiles WHERE visible = 1 ORDER BY updated_at DESC LIMIT 500').all();
  const { results: reqs } = await env.DB.prepare('SELECT user_id, status FROM talent_requests WHERE org_id = ? ORDER BY created_at DESC').bind(orgId).all();
  const reqStatus = {};
  for (const r of reqs || []) if (!reqStatus[r.user_id]) reqStatus[r.user_id] = r.status;
  const cards = [];
  for (const tp of results || []) {
    if (!(await eligibility(env, tp.user_id)).eligible) continue;
    const card = await candidateCard(env, tp);
    const text = searchText(card);
    if (q && !q.split(/\s+/).every((w) => text.includes(w))) continue;
    if (edu && !(card.education || '').toLowerCase().includes(edu)) continue;
    if (city && !(card.city || '').toLowerCase().includes(city)) continue;
    if (need === 'disc' && !card.disc) continue;
    if (need === 'kraepelin' && !card.kraepelin) continue;
    if (need === 'personality' && !card.bigfive && !card.type16) continue;
    card.request = reqStatus[tp.user_id] || null;
    cards.push(card);
  }
  return json({ candidates: cards });
}

async function createRequest(request, env, user, orgId) {
  await orgAccess(env, user, orgId, 'assessor');
  const b = await readJson(request);
  const alias = str(b.alias, 20).replace(/^TC-/, '');
  const tp = await env.DB.prepare('SELECT user_id FROM talent_profiles WHERE alias = ? AND visible = 1').bind(alias).first();
  if (!tp || !(await eligibility(env, tp.user_id)).eligible) throw new HttpError(404, 'Kandidat tidak tersedia');
  const open = await env.DB.prepare("SELECT status FROM talent_requests WHERE org_id = ? AND user_id = ? AND status IN ('pending', 'accepted')")
    .bind(orgId, tp.user_id)
    .first();
  if (open) throw new HttpError(409, open.status === 'accepted' ? 'Kandidat ini sudah menerima permintaan Anda' : 'Permintaan Anda masih menunggu jawaban kandidat');
  const since = new Date(Date.now() - 864e5).toISOString();
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM talent_requests WHERE org_id = ? AND created_at > ?').bind(orgId, since).first()).n;
  if (n >= DAILY_REQUEST_LIMIT) throw new HttpError(429, `Batas ${DAILY_REQUEST_LIMIT} permintaan per hari tercapai`);
  const message = str(b.message, 600);
  if (message.length < 20) throw new HttpError(400, 'Tulis pesan singkat untuk kandidat (minimal 20 karakter): posisi apa dan mengapa Anda tertarik');
  await env.DB.prepare("INSERT INTO talent_requests (id, org_id, user_id, requested_by, message, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', ?)")
    .bind(randomId(), orgId, tp.user_id, user.id, message, now())
    .run();
  return json({ ok: true }, 201);
}

async function listRequests(env, user, orgId) {
  await orgAccess(env, user, orgId, 'viewer');
  const { results } = await env.DB.prepare(
    `SELECT r.id, r.user_id, r.message, r.status, r.created_at, r.responded_at, t.alias, u.name, u.email, u.phone_enc
     FROM talent_requests r LEFT JOIN talent_profiles t ON t.user_id = r.user_id LEFT JOIN users u ON u.id = r.user_id
     WHERE r.org_id = ? ORDER BY r.created_at DESC LIMIT 300`
  )
    .bind(orgId)
    .all();
  const out = [];
  for (const r of results || []) {
    const item = { id: r.id, alias: r.alias ? `TC-${r.alias}` : '(dihapus)', message: r.message, status: r.status, created_at: r.created_at, responded_at: r.responded_at };
    if (r.status === 'accepted' && r.email) {
      item.contact = { name: r.name, email: r.email, phone: r.phone_enc ? await decryptText(r.phone_enc, env.ENCRYPTION_KEY) : '' };
    }
    out.push(item);
  }
  return json({ requests: out });
}

// ---------------- router ----------------

export async function handlePool(request, env, path, m, getUser) {
  if (path === '/api/talent/me' && m === 'GET') return myTalent(env, await getUser());
  if (path === '/api/talent/me' && m === 'PUT') return saveMyTalent(request, env, await getUser());
  const a = path.match(/^\/api\/talent\/requests\/([0-9a-f-]{36})\/(accept|decline)$/);
  if (a && m === 'POST') return respond(env, await getUser(), a[1], a[2] === 'accept');
  const o = path.match(/^\/api\/org\/([0-9a-f-]{36})\/talent(\/requests)?$/);
  if (o) {
    const user = await getUser();
    if (!o[2] && m === 'GET') return search(request, env, user, o[1]);
    if (o[2] && m === 'GET') return listRequests(env, user, o[1]);
    if (o[2] && m === 'POST') return createRequest(request, env, user, o[1]);
  }
  return null;
}

export async function poolCount(env) {
  return (await env.DB.prepare('SELECT COUNT(*) AS n FROM talent_profiles WHERE visible = 1').first()).n;
}
