// Consultation scheduling for app users: psychologists, free slots, bookings, and org invitations.
// All times are Western Indonesia Time (WIB, UTC+7, no daylight saving) stored as 'YYYY-MM-DDTHH:MM'.

import { HttpError, json, readJson, str, now } from './http.js';
import { randomId } from './crypto.js';
import { INVITE_TESTS } from './participant.js';

export const SESSION_TYPES = {
  review: { label: 'Result review', minutes: 30 },
  coaching: { label: 'Career coaching', minutes: 60 }
};

export const DEFAULT_AVAILABILITY = { days: [1, 2, 3, 4, 5], start: '09:00', end: '16:00', slot: 60, blocked: [] };
const LEAD_MINUTES = 120; // earliest bookable slot is 2 hours from now
const ACTIVE = ['requested', 'confirmed'];

export function nowWib() {
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16);
}

export function toMin(s) {
  return Date.parse(`${s}:00Z`) / 60000;
}

export function fromMin(m) {
  return new Date(m * 60000).toISOString().slice(0, 16);
}

export function isStamp(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) && Number.isFinite(toMin(s));
}

function weekday(date) {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d; // Monday = 1 … Sunday = 7
}

export function parseAvailability(text) {
  try {
    return { ...DEFAULT_AVAILABILITY, ...(JSON.parse(text) || {}) };
  } catch {
    return { ...DEFAULT_AVAILABILITY };
  }
}

export async function busyIntervals(env, psychId, fromStamp, toStamp, exceptId = null) {
  const { results } = await env.DB.prepare(
    `SELECT id, start_at, duration_min FROM appointments
     WHERE psychologist_id = ? AND status IN ('requested', 'confirmed') AND start_at >= ? AND start_at < ?`
  )
    .bind(psychId, fromMin(toMin(fromStamp) - 24 * 60), toStamp)
    .all();
  return (results || []).filter((r) => r.id !== exceptId).map((r) => [toMin(r.start_at), toMin(r.start_at) + r.duration_min]);
}

function overlaps(busy, start, end) {
  return busy.some(([s, e]) => start < e && end > s);
}

function daySlots(avail, date, busy, minStart) {
  if (!avail.days.includes(weekday(date)) || (avail.blocked || []).includes(date)) return [];
  const out = [];
  const startM = toMin(`${date}T${avail.start}`);
  const endM = toMin(`${date}T${avail.end}`);
  for (let m = startM; m + avail.slot <= endM; m += avail.slot) {
    if (m < minStart) continue;
    if (!overlaps(busy, m, m + avail.slot)) out.push(fromMin(m).slice(11));
  }
  return out;
}

async function getPsych(env, id) {
  const p = await env.DB.prepare(
    "SELECT p.*, u.email FROM psychologists p JOIN users u ON u.id = p.user_id WHERE p.user_id = ? AND p.active = 1 AND u.role = 'psychologist'"
  )
    .bind(id)
    .first();
  if (!p) throw new HttpError(404, 'This psychologist is not available.');
  return { ...p, availability: parseAvailability(p.availability) };
}

async function listPsychologists(env) {
  const { results } = await env.DB.prepare(
    "SELECT p.user_id AS id, p.display_name AS name, p.title, p.sipp, p.bio FROM psychologists p JOIN users u ON u.id = p.user_id WHERE p.active = 1 AND u.role = 'psychologist' ORDER BY p.display_name"
  ).all();
  return json({ psychologists: results || [] });
}

async function slots(request, env) {
  const url = new URL(request.url);
  const psych = await getPsych(env, str(url.searchParams.get('psychologist'), 40));
  const days = Math.min(21, Math.max(1, Number(url.searchParams.get('days')) || 10));
  const today = nowWib().slice(0, 10);
  const minStart = toMin(nowWib()) + LEAD_MINUTES;
  const last = fromMin(toMin(`${today}T00:00`) + days * 1440);
  const busy = await busyIntervals(env, psych.user_id, `${today}T00:00`, last);
  const out = [];
  for (let i = 0; i < days; i++) {
    const date = fromMin(toMin(`${today}T00:00`) + i * 1440).slice(0, 10);
    out.push({ date, slots: daySlots(psych.availability, date, busy, minStart) });
  }
  return json({ days: out });
}

async function createBooking(request, env, user) {
  const body = await readJson(request);
  const type = SESSION_TYPES[body.session_type] ? body.session_type : null;
  if (!type) throw new HttpError(400, 'Please choose a session type');
  const psych = await getPsych(env, str(body.psychologist_id, 40));
  const start = str(body.start_at, 16);
  if (!isStamp(start)) throw new HttpError(400, 'Please choose a time slot');
  const date = start.slice(0, 10);
  const minStart = toMin(nowWib()) + LEAD_MINUTES;
  const busy = await busyIntervals(env, psych.user_id, `${date}T00:00`, fromMin(toMin(`${date}T00:00`) + 1440));
  if (!daySlots(psych.availability, date, busy, minStart).includes(start.slice(11))) {
    throw new HttpError(409, 'That slot was just taken or is no longer available. Please pick another time.');
  }
  const id = randomId();
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO appointments (id, psychologist_id, user_id, kind, session_type, title, start_at, duration_min, status, user_note, created_by, created_at, updated_at)
     VALUES (?, ?, ?, 'consult', ?, ?, ?, ?, 'requested', ?, ?, ?, ?)`
  )
    .bind(id, psych.user_id, user.id, type, SESSION_TYPES[type].label, start, SESSION_TYPES[type].minutes, str(body.note, 500), user.id, ts, ts)
    .run();
  return json({ id }, 201);
}

async function myBookings(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.kind, a.session_type, a.title, a.start_at, a.duration_min, a.status, a.meeting_link, a.user_note,
            p.display_name AS psychologist, o.name AS org_name
     FROM appointments a LEFT JOIN psychologists p ON p.user_id = a.psychologist_id LEFT JOIN organizations o ON o.id = a.org_id
     WHERE a.user_id = ? ORDER BY a.start_at DESC LIMIT 50`
  )
    .bind(user.id)
    .all();
  return json({ bookings: results || [], now: nowWib() });
}

async function cancelBooking(env, user, id) {
  const a = await env.DB.prepare('SELECT status, start_at FROM appointments WHERE id = ? AND user_id = ?').bind(id, user.id).first();
  if (!a) throw new HttpError(404, 'Booking not found');
  if (!ACTIVE.includes(a.status)) throw new HttpError(400, 'This booking can no longer be cancelled');
  if (a.start_at <= nowWib()) throw new HttpError(400, 'This session has already started');
  await env.DB.prepare("UPDATE appointments SET status = 'cancelled', updated_at = ? WHERE id = ?").bind(now(), id).run();
  return json({ ok: true });
}

// ---------------- invitations sent to a user's email from the organization portal ----------------

async function myInvitations(env, user) {
  const { results } = await env.DB.prepare(
    `SELECT e.id, i.code, i.name, i.tests, o.name AS org_name, e.created_at
     FROM org_invite_emails e JOIN org_invites i ON i.id = e.invite_id JOIN organizations o ON o.id = e.org_id
     WHERE e.email = ? AND e.status = 'pending' AND i.active = 1
       AND NOT EXISTS (SELECT 1 FROM org_participants p WHERE p.invite_id = e.invite_id AND p.user_id = ?)
     ORDER BY e.created_at DESC`
  )
    .bind(user.email.toLowerCase(), user.id)
    .all();
  return json({
    invitations: (results || []).map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      org: r.org_name,
      tests: JSON.parse(r.tests).map((t) => INVITE_TESTS[t] || t)
    }))
  });
}

async function declineInvitation(env, user, id) {
  await env.DB.prepare("UPDATE org_invite_emails SET status = 'declined', responded_at = ? WHERE id = ? AND email = ?")
    .bind(now(), id, user.email.toLowerCase())
    .run();
  return json({ ok: true });
}

export async function handleSchedule(request, env, path, m, getUser) {
  if (path === '/api/psychologists' && m === 'GET') {
    await getUser();
    return listPsychologists(env);
  }
  if (path === '/api/slots' && m === 'GET') {
    await getUser();
    return slots(request, env);
  }
  if (path === '/api/bookings' && m === 'GET') return myBookings(env, await getUser());
  if (path === '/api/bookings' && m === 'POST') return createBooking(request, env, await getUser());
  const c = path.match(/^\/api\/bookings\/([0-9a-f-]{36})\/cancel$/);
  if (c && m === 'POST') return cancelBooking(env, await getUser(), c[1]);
  if (path === '/api/invitations' && m === 'GET') return myInvitations(env, await getUser());
  const d = path.match(/^\/api\/invitations\/([0-9a-f-]{36})\/decline$/);
  if (d && m === 'POST') return declineInvitation(env, await getUser(), d[1]);
  return null;
}
