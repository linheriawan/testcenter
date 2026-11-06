// Psychologist workspace: profile, working hours, calendar, appointments and client results.

import { HttpError, json, readJson, str, now } from './http.js';
import { randomId, encryptText, decryptText } from './crypto.js';
import { isPlatformAdmin } from './org.js';
import { latestResults } from './results.js';
import { SESSION_TYPES, DEFAULT_AVAILABILITY, parseAvailability, busyIntervals, nowWib, toMin, fromMin, isStamp } from './schedule.js';

const KINDS = { consult: 'Konsultasi', assessment: 'Asesmen' };

async function requirePsych(env, user) {
  if (user.role !== 'psychologist' && !isPlatformAdmin(env, user)) throw new HttpError(403, 'Halaman ini khusus psikolog');
  let p = await env.DB.prepare('SELECT * FROM psychologists WHERE user_id = ?').bind(user.id).first();
  if (!p) {
    await env.DB.prepare('INSERT INTO psychologists (user_id, display_name, availability, active, updated_at) VALUES (?, ?, ?, 1, ?)')
      .bind(user.id, user.name, JSON.stringify(DEFAULT_AVAILABILITY), now())
      .run();
    p = await env.DB.prepare('SELECT * FROM psychologists WHERE user_id = ?').bind(user.id).first();
  }
  return { ...p, availability: parseAvailability(p.availability) };
}

function cleanAvailability(a) {
  const time = (t, d) => (/^\d{2}:\d{2}$/.test(t || '') ? t : d);
  const days = (Array.isArray(a && a.days) ? a.days : DEFAULT_AVAILABILITY.days).map(Number).filter((d) => d >= 1 && d <= 7);
  const slot = [30, 45, 60, 90].includes(Number(a && a.slot)) ? Number(a.slot) : 60;
  const start = time(a && a.start, '09:00');
  const end = time(a && a.end, '16:00');
  if (end <= start) throw new HttpError(400, 'Jam selesai harus setelah jam mulai');
  const blocked = (Array.isArray(a && a.blocked) ? a.blocked : []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 200);
  return { days: [...new Set(days)].sort(), start, end, slot, blocked };
}

async function getMe(env, user) {
  const p = await requirePsych(env, user);
  const pending = await env.DB.prepare("SELECT COUNT(*) AS n FROM appointments WHERE psychologist_id = ? AND status = 'requested'").bind(user.id).first();
  return json({ profile: p, user: { name: user.name, email: user.email, isAdmin: isPlatformAdmin(env, user) }, pending: pending.n, now: nowWib() });
}

async function saveMe(request, env, user) {
  await requirePsych(env, user);
  const b = await readJson(request);
  const name = str(b.display_name, 160);
  if (!name) throw new HttpError(400, 'Nama tampilan wajib diisi');
  await env.DB.prepare('UPDATE psychologists SET display_name = ?, title = ?, sipp = ?, bio = ?, availability = ?, active = ?, updated_at = ? WHERE user_id = ?')
    .bind(name, str(b.title, 160), str(b.sipp, 80), str(b.bio, 1000), JSON.stringify(cleanAvailability(b.availability)), b.active === false ? 0 : 1, now(), user.id)
    .run();
  return json({ ok: true });
}

async function listAppointments(request, env, user) {
  await requirePsych(env, user);
  const url = new URL(request.url);
  const from = str(url.searchParams.get('from'), 16) || '0000';
  const to = str(url.searchParams.get('to'), 16) || '9999';
  const status = url.searchParams.get('status');
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.kind, a.session_type, a.title, a.start_at, a.duration_min, a.status, a.meeting_link, a.user_note,
            a.user_id, a.org_id, a.participant_id, u.name AS user_name, u.email AS user_email, o.name AS org_name
     FROM appointments a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN organizations o ON o.id = a.org_id
     WHERE a.psychologist_id = ? AND a.start_at >= ? AND a.start_at < ? ${status ? 'AND a.status = ?' : ''}
     ORDER BY a.start_at LIMIT 500`
  )
    .bind(...[user.id, from, to, ...(status ? [status] : [])])
    .all();
  return json({ appointments: results || [], now: nowWib() });
}

async function getAppointment(env, user, id) {
  await requirePsych(env, user);
  const a = await env.DB.prepare(
    `SELECT a.*, u.name AS user_name, u.email AS user_email, o.name AS org_name
     FROM appointments a LEFT JOIN users u ON u.id = a.user_id LEFT JOIN organizations o ON o.id = a.org_id
     WHERE a.id = ? AND a.psychologist_id = ?`
  )
    .bind(id, user.id)
    .first();
  if (!a) throw new HttpError(404, 'Jadwal tidak ditemukan');
  const { psych_note_enc, ...rest } = a;
  return json({ appointment: { ...rest, psych_note: (await decryptText(psych_note_enc, env.ENCRYPTION_KEY)) || '' } });
}

async function orgsOfPsych(env, user) {
  if (isPlatformAdmin(env, user)) return null; // all
  const { results } = await env.DB.prepare('SELECT org_id FROM org_members WHERE user_id = ?').bind(user.id).all();
  return (results || []).map((r) => r.org_id);
}

async function searchPeople(request, env, user) {
  await requirePsych(env, user);
  const q = str(new URL(request.url).searchParams.get('q'), 80).toLowerCase();
  if (q.length < 2) return json({ people: [] });
  const like = `%${q}%`;
  const orgs = await orgsOfPsych(env, user);
  const parts = [];
  if (orgs === null || orgs.length) {
    const { results } = await env.DB.prepare(
      `SELECT p.id AS participant_id, p.org_id, u.id AS user_id, u.name, u.email, o.name AS org_name, i.name AS invite_name
       FROM org_participants p JOIN users u ON u.id = p.user_id JOIN organizations o ON o.id = p.org_id JOIN org_invites i ON i.id = p.invite_id
       WHERE (lower(u.name) LIKE ? OR lower(u.email) LIKE ? OR lower(p.nik) LIKE ?) ${orgs === null ? '' : `AND p.org_id IN (${orgs.map(() => '?').join(',')})`}
       LIMIT 20`
    )
      .bind(like, like, like, ...(orgs || []))
      .all();
    parts.push(...(results || []));
  }
  const exact = await env.DB.prepare('SELECT id AS user_id, name, email FROM users WHERE lower(email) = ?').bind(q).first();
  if (exact && !parts.some((p) => p.user_id === exact.user_id)) parts.push(exact);
  return json({ people: parts });
}

async function assertNoClash(env, psychId, start, minutes, exceptId) {
  const busy = await busyIntervals(env, psychId, start.slice(0, 10) + 'T00:00', fromMin(toMin(start) + 1440), exceptId);
  const s = toMin(start);
  if (busy.some(([a, b]) => s < b && s + minutes > a)) throw new HttpError(409, 'Bentrok dengan jadwal lain di kalender Anda');
}

async function createAppointment(request, env, user) {
  await requirePsych(env, user);
  const b = await readJson(request);
  const kind = KINDS[b.kind] ? b.kind : 'consult';
  const start = str(b.start_at, 16);
  if (!isStamp(start)) throw new HttpError(400, 'Tanggal dan jam wajib diisi');
  const minutes = Math.min(480, Math.max(15, Math.round(Number(b.duration_min) || 60)));
  let userId = null;
  let orgId = null;
  let participantId = null;
  if (b.participant_id) {
    const p = await env.DB.prepare('SELECT id, org_id, user_id FROM org_participants WHERE id = ?').bind(str(b.participant_id, 40)).first();
    const orgs = await orgsOfPsych(env, user);
    if (!p || (orgs !== null && !orgs.includes(p.org_id))) throw new HttpError(403, 'Peserta ini bukan dari organisasi Anda');
    userId = p.user_id;
    orgId = p.org_id;
    participantId = p.id;
  } else if (b.user_id) {
    const u = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(str(b.user_id, 40)).first();
    if (!u) throw new HttpError(404, 'Pengguna tidak ditemukan');
    userId = u.id;
  }
  const title = str(b.title, 160) || (kind === 'assessment' ? 'Asesmen' : 'Konsultasi');
  await assertNoClash(env, user.id, start, minutes, null);
  const id = randomId();
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO appointments (id, psychologist_id, user_id, kind, session_type, title, org_id, participant_id, start_at, duration_min, status, meeting_link, psych_note_enc, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)`
  )
    .bind(id, user.id, userId, kind, str(b.session_type, 30), title, orgId, participantId, start, minutes, str(b.meeting_link, 300),
      await encryptText(str(b.psych_note, 3000), env.ENCRYPTION_KEY), user.id, ts, ts)
    .run();
  return json({ id }, 201);
}

async function updateAppointment(request, env, user, id) {
  await requirePsych(env, user);
  const a = await env.DB.prepare('SELECT * FROM appointments WHERE id = ? AND psychologist_id = ?').bind(id, user.id).first();
  if (!a) throw new HttpError(404, 'Jadwal tidak ditemukan');
  const b = await readJson(request);
  const next = {
    status: a.status,
    start_at: a.start_at,
    duration_min: a.duration_min,
    title: a.title,
    meeting_link: a.meeting_link,
    psych_note_enc: a.psych_note_enc
  };
  const transitions = {
    confirm: ['requested'],
    decline: ['requested'],
    done: ['confirmed'],
    cancel: ['requested', 'confirmed'],
    noshow: ['confirmed']
  };
  const target = { confirm: 'confirmed', decline: 'declined', done: 'done', cancel: 'cancelled', noshow: 'no_show' };
  if (b.action) {
    if (!transitions[b.action]) throw new HttpError(400, 'Tindakan tidak dikenal');
    if (!transitions[b.action].includes(a.status)) throw new HttpError(400, 'Status jadwal tidak memungkinkan tindakan ini');
    next.status = target[b.action];
  }
  if (b.start_at !== undefined && b.start_at !== a.start_at) {
    if (!isStamp(b.start_at)) throw new HttpError(400, 'Tanggal dan jam tidak valid');
    next.start_at = b.start_at;
  }
  if (b.duration_min !== undefined) next.duration_min = Math.min(480, Math.max(15, Math.round(Number(b.duration_min) || a.duration_min)));
  if (b.title !== undefined) next.title = str(b.title, 160) || a.title;
  if (b.meeting_link !== undefined) next.meeting_link = str(b.meeting_link, 300);
  if (b.psych_note !== undefined) next.psych_note_enc = await encryptText(str(b.psych_note, 3000), env.ENCRYPTION_KEY);
  if (['requested', 'confirmed'].includes(next.status) && (next.start_at !== a.start_at || next.duration_min !== a.duration_min)) {
    await assertNoClash(env, user.id, next.start_at, next.duration_min, id);
  }
  await env.DB.prepare(
    'UPDATE appointments SET status = ?, start_at = ?, duration_min = ?, title = ?, meeting_link = ?, psych_note_enc = ?, updated_at = ? WHERE id = ?'
  )
    .bind(next.status, next.start_at, next.duration_min, next.title, next.meeting_link, next.psych_note_enc, now(), id)
    .run();
  return json({ ok: true });
}

// Results of one client. Allowed only for people this psychologist has a session with,
// or who joined an organization the psychologist belongs to.
async function getClient(env, user, clientId) {
  await requirePsych(env, user);
  const appt = await env.DB.prepare("SELECT 1 AS x FROM appointments WHERE psychologist_id = ? AND user_id = ? AND status != 'declined' LIMIT 1")
    .bind(user.id, clientId)
    .first();
  let allowed = !!appt || isPlatformAdmin(env, user);
  if (!allowed) {
    const orgs = await orgsOfPsych(env, user);
    if (orgs && orgs.length) {
      const p = await env.DB.prepare(`SELECT 1 AS x FROM org_participants WHERE user_id = ? AND org_id IN (${orgs.map(() => '?').join(',')}) LIMIT 1`)
        .bind(clientId, ...orgs)
        .first();
      allowed = !!p;
    }
  }
  if (!allowed) throw new HttpError(403, 'Anda belum memiliki sesi dengan pengguna ini');
  const u = await env.DB.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?').bind(clientId).first();
  if (!u) throw new HttpError(404, 'Pengguna tidak ditemukan');
  const prof = await env.DB.prepare('SELECT segment, education_level, field, school, skills FROM profiles WHERE user_id = ?').bind(clientId).first();
  const results = await latestResults(env, clientId);
  for (const k of Object.keys(results)) if (results[k].perColumn) delete results[k].wrongPerColumn;
  const ins = await env.DB.prepare('SELECT content FROM insights WHERE user_id = ?').bind(clientId).first();
  const { results: history } = await env.DB.prepare(
    'SELECT id, kind, title, start_at, duration_min, status FROM appointments WHERE psychologist_id = ? AND user_id = ? ORDER BY start_at DESC LIMIT 20'
  )
    .bind(user.id, clientId)
    .all();
  return json({
    client: {
      ...u,
      profile: prof ? { ...prof, skills: prof.skills ? prof.skills.split('|') : [] } : null,
      results,
      insights: ins ? JSON.parse(ins.content) : null,
      history: history || []
    }
  });
}

export async function handlePsych(request, env, path, m, user) {
  if (path === '/api/psych/me' && m === 'GET') return getMe(env, user);
  if (path === '/api/psych/me' && m === 'PUT') return saveMe(request, env, user);
  if (path === '/api/psych/appointments' && m === 'GET') return listAppointments(request, env, user);
  if (path === '/api/psych/appointments' && m === 'POST') return createAppointment(request, env, user);
  if (path === '/api/psych/people' && m === 'GET') return searchPeople(request, env, user);
  const a = path.match(/^\/api\/psych\/appointments\/([0-9a-f-]{36})$/);
  if (a && m === 'GET') return getAppointment(env, user, a[1]);
  if (a && m === 'PUT') return updateAppointment(request, env, user, a[1]);
  const c = path.match(/^\/api\/psych\/clients\/([0-9a-f-]{36})$/);
  if (c && m === 'GET') return getClient(env, user, c[1]);
  return null;
}

export { SESSION_TYPES };
