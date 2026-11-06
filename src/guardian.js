// Date of birth and parental (guardian) consent for users under 18.
//
// Under-18 users may take the free tests and see their own results. Sharing results with an
// organization, being scheduled by a psychologist, or booking a consultation requires a guardian's
// consent, recorded by the school (organization) after it receives a signed paper form.

import { HttpError, json, readJson, str, now } from './http.js';
import { randomId } from './crypto.js';

export const ADULT_AGE = 18;

function todayWib() {
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
}

export function ageOn(birthDate, onDate = todayWib()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate || '')) return null;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [ty, tm, td] = onDate.split('-').map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export function validBirthDate(v) {
  const s = str(v, 10);
  const age = ageOn(s);
  if (age === null || Number.isNaN(Date.parse(s))) throw new HttpError(400, 'Please enter your date of birth');
  if (age < 10 || age > 100) throw new HttpError(400, 'Please check your date of birth');
  return s;
}

export async function getBirthDate(env, userId) {
  const r = await env.DB.prepare('SELECT birth_date FROM user_meta WHERE user_id = ?').bind(userId).first();
  return r ? r.birth_date : null;
}

export async function setBirthDate(env, userId, birthDate) {
  await env.DB.prepare(
    `INSERT INTO user_meta (user_id, birth_date, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET birth_date = excluded.birth_date, updated_at = excluded.updated_at`
  )
    .bind(userId, birthDate, now())
    .run();
}

// Unknown birth date (accounts created before this feature) is treated as adult;
// the app asks those users for it, and joining an organization requires it.
export async function isMinor(env, userId) {
  const bd = await getBirthDate(env, userId);
  const age = ageOn(bd);
  return age !== null && age < ADULT_AGE;
}

export async function activeConsent(env, userId, orgId = null) {
  return env.DB.prepare(
    `SELECT id, org_id, guardian_name, relationship, method, form_date, recorded_at FROM guardian_consents
     WHERE user_id = ? AND revoked_at IS NULL ${orgId ? 'AND org_id = ?' : ''} ORDER BY recorded_at DESC LIMIT 1`
  )
    .bind(...(orgId ? [userId, orgId] : [userId]))
    .first();
}

// May this user's data be shared with this organization (or with anyone, if orgId is null)?
export async function canShare(env, userId, orgId = null) {
  if (!(await isMinor(env, userId))) return true;
  return !!(await activeConsent(env, userId, orgId));
}

export async function consentSummary(env, userId) {
  const minor = await isMinor(env, userId);
  const c = minor ? await activeConsent(env, userId) : null;
  return { minor, guardianConsent: !!c };
}

// ---------------- API: user sets their own date of birth ----------------

export async function saveMyBirthDate(request, env, user) {
  const b = await readJson(request);
  const existing = await getBirthDate(env, user.id);
  if (existing) throw new HttpError(409, 'Your date of birth is already saved. Contact support to change it.');
  await setBirthDate(env, user.id, validBirthDate(b.birth_date));
  return json({ ok: true, ...(await consentSummary(env, user.id)) });
}

// ---------------- API: organization records or withdraws a paper consent form ----------------

export async function recordConsent(request, env, user, orgId, participant) {
  const b = await readJson(request);
  const name = str(b.guardian_name, 160);
  const rel = str(b.relationship, 60);
  if (!name) throw new HttpError(400, 'Nama orang tua/wali wajib diisi');
  if (!rel) throw new HttpError(400, 'Hubungan dengan siswa wajib diisi');
  if (b.confirm !== true) throw new HttpError(400, 'Centang konfirmasi bahwa formulir bertanda tangan sudah diterima');
  const formDate = /^\d{4}-\d{2}-\d{2}$/.test(b.form_date || '') ? b.form_date : null;
  await env.DB.prepare(
    `INSERT INTO guardian_consents (id, user_id, org_id, guardian_name, relationship, method, form_date, note, recorded_by, recorded_at)
     VALUES (?, ?, ?, ?, ?, 'paper', ?, ?, ?, ?)`
  )
    .bind(randomId(), participant.user_id, orgId, name, rel, formDate, str(b.note, 500), user.id, now())
    .run();
  return json({ ok: true }, 201);
}

export async function revokeConsent(env, user, orgId, participant) {
  await env.DB.prepare('UPDATE guardian_consents SET revoked_at = ?, revoked_by = ? WHERE user_id = ? AND org_id = ? AND revoked_at IS NULL')
    .bind(now(), user.id, participant.user_id, orgId)
    .run();
  return json({ ok: true });
}
