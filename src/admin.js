// Platform admin: app users, roles, account deletion, partnership inquiries and overview numbers.
// Admins see account and activity data, not psychological test results (those are for psychologists).

import { HttpError, json, readJson, str, now } from './http.js';
import { isPlatformAdmin } from './org.js';
import { deleteUserData } from './userdata.js';
import { DEFAULT_AVAILABILITY } from './schedule.js';

function requireAdmin(env, user) {
  if (!isPlatformAdmin(env, user)) throw new HttpError(403, 'Halaman ini khusus admin platform');
}

async function stats(env) {
  const one = async (sql) => (await env.DB.prepare(sql).first()).n;
  const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16);
  return json({
    users: await one('SELECT COUNT(*) AS n FROM users'),
    newUsers7d: await one(`SELECT COUNT(*) AS n FROM users WHERE created_at >= '${new Date(Date.now() - 7 * 864e5).toISOString()}'`),
    psychologists: await one("SELECT COUNT(*) AS n FROM users WHERE role = 'psychologist'"),
    orgs: await one('SELECT COUNT(*) AS n FROM organizations'),
    inquiriesNew: await one("SELECT COUNT(*) AS n FROM inquiries WHERE status = 'new'"),
    upcoming: await one(`SELECT COUNT(*) AS n FROM appointments WHERE status IN ('requested','confirmed') AND start_at >= '${today}'`),
    requested: await one("SELECT COUNT(*) AS n FROM appointments WHERE status = 'requested'"),
    testsDone: await one('SELECT COUNT(*) AS n FROM test_results')
  });
}

async function listUsers(request, env) {
  const url = new URL(request.url);
  const q = str(url.searchParams.get('q'), 80).toLowerCase();
  const role = url.searchParams.get('role');
  const segment = url.searchParams.get('segment');
  const where = [];
  const args = [];
  if (q) {
    where.push('(lower(u.name) LIKE ? OR lower(u.email) LIKE ?)');
    args.push(`%${q}%`, `%${q}%`);
  }
  if (role) {
    where.push('u.role = ?');
    args.push(role);
  }
  if (segment) {
    where.push(segment === 'none' ? 'p.segment IS NULL' : 'p.segment = ?');
    if (segment !== 'none') args.push(segment);
  }
  const { results } = await env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.role, u.created_at, p.segment,
       (SELECT COUNT(DISTINCT test_id) FROM test_results t WHERE t.user_id = u.id) AS tests_done,
       (SELECT COUNT(*) FROM appointments a WHERE a.user_id = u.id) AS sessions,
       (SELECT COUNT(*) FROM org_participants o WHERE o.user_id = u.id) AS orgs
     FROM users u LEFT JOIN profiles p ON p.user_id = u.id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY u.created_at DESC LIMIT 1000`
  )
    .bind(...args)
    .all();
  return json({ users: results || [] });
}

async function getUser(env, id) {
  const u = await env.DB.prepare('SELECT id, name, email, role, created_at, consent_at FROM users WHERE id = ?').bind(id).first();
  if (!u) throw new HttpError(404, 'Pengguna tidak ditemukan');
  const prof = await env.DB.prepare('SELECT segment, education_level, field, school, updated_at FROM profiles WHERE user_id = ?').bind(id).first();
  const { results: tests } = await env.DB.prepare(
    'SELECT test_id, COUNT(*) AS times, MAX(created_at) AS last FROM test_results WHERE user_id = ? GROUP BY test_id'
  )
    .bind(id)
    .all();
  const { results: orgs } = await env.DB.prepare(
    `SELECT o.name AS org, i.name AS invite, p.created_at FROM org_participants p JOIN organizations o ON o.id = p.org_id JOIN org_invites i ON i.id = p.invite_id
     WHERE p.user_id = ? ORDER BY p.created_at DESC`
  )
    .bind(id)
    .all();
  const { results: memberOf } = await env.DB.prepare(
    'SELECT o.name AS org, m.role FROM org_members m JOIN organizations o ON o.id = m.org_id WHERE m.user_id = ?'
  )
    .bind(id)
    .all();
  const { results: sessions } = await env.DB.prepare(
    `SELECT a.title, a.kind, a.start_at, a.status, p.display_name AS psychologist
     FROM appointments a LEFT JOIN psychologists p ON p.user_id = a.psychologist_id WHERE a.user_id = ? ORDER BY a.start_at DESC LIMIT 30`
  )
    .bind(id)
    .all();
  return json({ user: { ...u, profile: prof, tests: tests || [], orgs: orgs || [], memberOf: memberOf || [], sessions: sessions || [] } });
}

async function setRole(request, env, actor, id) {
  const b = await readJson(request);
  const role = ['user', 'psychologist'].includes(b.role) ? b.role : null;
  if (!role) throw new HttpError(400, 'Peran tidak dikenal');
  const u = await env.DB.prepare('SELECT id, name FROM users WHERE id = ?').bind(id).first();
  if (!u) throw new HttpError(404, 'Pengguna tidak ditemukan');
  const stmts = [env.DB.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, id)];
  if (role === 'psychologist') {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO psychologists (user_id, display_name, availability, active, updated_at) VALUES (?, ?, ?, 1, ?)
         ON CONFLICT(user_id) DO UPDATE SET active = 1`
      ).bind(id, u.name, JSON.stringify(DEFAULT_AVAILABILITY), now())
    );
  } else {
    stmts.push(env.DB.prepare('UPDATE psychologists SET active = 0 WHERE user_id = ?').bind(id));
  }
  await env.DB.batch(stmts);
  return json({ ok: true });
}

async function removeUser(env, actor, id) {
  if (id === actor.id) throw new HttpError(400, 'Anda tidak bisa menghapus akun Anda sendiri dari sini');
  await deleteUserData(env, id);
  return json({ ok: true });
}

async function listInquiries(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, org_type, org_name, contact_name, position, phone, email, size, message, status, created_at FROM inquiries ORDER BY created_at DESC LIMIT 500'
  ).all();
  return json({ inquiries: results || [] });
}

async function setInquiry(request, env, id) {
  const b = await readJson(request);
  const status = ['new', 'contacted', 'won', 'closed'].includes(b.status) ? b.status : null;
  if (!status) throw new HttpError(400, 'Status tidak dikenal');
  await env.DB.prepare('UPDATE inquiries SET status = ? WHERE id = ?').bind(status, id).run();
  return json({ ok: true });
}

export async function handleAdmin(request, env, path, m, user) {
  if (!path.startsWith('/api/admin/') || path === '/api/admin/orgs') return null;
  requireAdmin(env, user);
  if (path === '/api/admin/stats' && m === 'GET') return stats(env);
  if (path === '/api/admin/users' && m === 'GET') return listUsers(request, env);
  if (path === '/api/admin/inquiries' && m === 'GET') return listInquiries(env);
  const u = path.match(/^\/api\/admin\/users\/([0-9a-f-]{36})$/);
  if (u && m === 'GET') return getUser(env, u[1]);
  if (u && m === 'PUT') return setRole(request, env, user, u[1]);
  if (u && m === 'DELETE') return removeUser(env, user, u[1]);
  const i = path.match(/^\/api\/admin\/inquiries\/([0-9a-f-]{36})$/);
  if (i && m === 'PUT') return setInquiry(request, env, i[1]);
  return null;
}
