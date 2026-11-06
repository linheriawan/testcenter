// Participant side: the Kraepelin test and joining an organization through an invite link.

import { HttpError, json, readJson, str, now } from './http.js';
import { encryptJson, randomId } from './crypto.js';
import { KRAEPELIN, scoreKraepelin } from '../public/shared/kraepelin.js';
import { getBirthDate, setBirthDate, validBirthDate, isMinor } from './guardian.js';

export const INVITE_TESTS = {
  kraepelin: 'Work attitude (Kraepelin)',
  bigfive: 'Big Five personality',
  type16: '16-type personality'
};

// KRAEPELIN_TEST=1 (local development only) shortens the test to 3 columns of 5 seconds.
function krConfig(env) {
  return env.KRAEPELIN_TEST === '1' ? { ...KRAEPELIN, columns: 3, seconds: 5 } : KRAEPELIN;
}

// ---------------- Kraepelin ----------------

async function kraepelinStart(env, user) {
  const id = randomId();
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  await env.DB.prepare('INSERT INTO kraepelin_sessions (id, user_id, seed, started_at) VALUES (?, ?, ?, ?)')
    .bind(id, user.id, seed, now())
    .run();
  const cfg = krConfig(env);
  return json({ sessionId: id, seed, columns: cfg.columns, seconds: cfg.seconds, length: cfg.length }, 201);
}

async function kraepelinSubmit(request, env, user) {
  const body = await readJson(request, 200_000);
  const s = await env.DB.prepare('SELECT * FROM kraepelin_sessions WHERE id = ? AND user_id = ?').bind(str(body.sessionId, 40), user.id).first();
  if (!s) throw new HttpError(404, 'Test session not found. Please start the test again.');
  if (s.finished_at) throw new HttpError(409, 'This test session was already submitted.');
  const cfg = krConfig(env);
  const total = cfg.columns * cfg.seconds;
  const elapsed = (Date.now() - Date.parse(s.started_at)) / 1000;
  if (elapsed < total * 0.9) throw new HttpError(400, 'The test was submitted too early. Please take the full test.');
  if (elapsed > total + 30 * 60) throw new HttpError(400, 'This test session has expired. Please start again.');

  const answers = Array.isArray(body.columns) ? body.columns.slice(0, cfg.columns) : [];
  const clean = answers.map((col) =>
    Array.isArray(col) ? col.slice(0, cfg.length).map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 9) : []
  );
  const result = scoreKraepelin(s.seed, clean, cfg);
  result.tabSwitches = Math.max(0, Math.min(999, Number(body.tabSwitches) || 0));
  result.attempt = (
    await env.DB.prepare('SELECT COUNT(*) AS n FROM kraepelin_sessions WHERE user_id = ? AND finished_at IS NOT NULL').bind(user.id).first()
  ).n + 1;

  const ts = now();
  await env.DB.batch([
    env.DB.prepare('UPDATE kraepelin_sessions SET finished_at = ? WHERE id = ?').bind(ts, s.id),
    env.DB.prepare('INSERT INTO test_results (id, user_id, test_id, answers_enc, result, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
      randomId(),
      user.id,
      'kraepelin',
      await encryptJson({ seed: s.seed, columns: clean }, env.ENCRYPTION_KEY),
      JSON.stringify(result),
      ts
    ),
    env.DB.prepare('DELETE FROM insights WHERE user_id = ?').bind(user.id)
  ]);
  return json({ result });
}

// ---------------- invites ----------------

function cleanCode(code) {
  return str(code, 20).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function findInvite(env, code) {
  return env.DB.prepare(
    `SELECT i.id, i.org_id, i.code, i.name, i.tests, i.active, o.name AS org_name
     FROM org_invites i JOIN organizations o ON o.id = i.org_id WHERE i.code = ?`
  )
    .bind(cleanCode(code))
    .first();
}

async function joinInfo(env, code) {
  const inv = await findInvite(env, code);
  if (!inv || !inv.active) throw new HttpError(404, 'This invite link is not valid or has been closed.');
  return json({
    invite: {
      code: inv.code,
      name: inv.name,
      org: inv.org_name,
      tests: JSON.parse(inv.tests).map((id) => ({ id, name: INVITE_TESTS[id] || id }))
    }
  });
}

async function joinOrg(request, env, user) {
  const body = await readJson(request);
  const inv = await findInvite(env, body.code);
  if (!inv || !inv.active) throw new HttpError(404, 'This invite link is not valid or has been closed.');
  if (body.consent !== true) throw new HttpError(400, `Please agree to share your results with ${inv.org_name}.`);
  if (!(await getBirthDate(env, user.id))) await setBirthDate(env, user.id, validBirthDate(body.birth_date));
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO org_participants (id, org_id, invite_id, user_id, nik, position, division, consent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(invite_id, user_id) DO UPDATE SET nik = excluded.nik, position = excluded.position, division = excluded.division, consent_at = excluded.consent_at`
  )
    .bind(randomId(), inv.org_id, inv.id, user.id, str(body.nik, 40), str(body.position, 160), str(body.division, 120), ts, ts)
    .run();
  await env.DB.prepare("UPDATE org_invite_emails SET status = 'accepted', responded_at = ? WHERE invite_id = ? AND email = ?")
    .bind(ts, inv.id, String(user.email).toLowerCase())
    .run();
  return json({ ok: true, org: inv.org_name, needsGuardian: await isMinor(env, user.id) }, 201);
}

export async function myAssignments(env, user, done) {
  const { results } = await env.DB.prepare(
    `SELECT i.name, i.tests, o.name AS org_name, p.created_at
     FROM org_participants p JOIN org_invites i ON i.id = p.invite_id JOIN organizations o ON o.id = p.org_id
     WHERE p.user_id = ? ORDER BY p.created_at DESC`
  )
    .bind(user.id)
    .all();
  return (results || []).map((r) => ({
    org: r.org_name,
    name: r.name,
    tests: JSON.parse(r.tests).map((id) => ({ id, name: INVITE_TESTS[id] || id, done: !!(done[id] && done[id].completedAt >= r.created_at) }))
  }));
}

// ---------------- router ----------------

export async function handleParticipant(request, env, path, m, getUser) {
  if (path === '/api/kraepelin/start' && m === 'POST') return kraepelinStart(env, await getUser());
  if (path === '/api/kraepelin/submit' && m === 'POST') return kraepelinSubmit(request, env, await getUser());
  if (path === '/api/join' && m === 'POST') return joinOrg(request, env, await getUser());
  const j = path.match(/^\/api\/join\/([A-Za-z0-9-]{4,20})$/);
  if (j && m === 'GET') return joinInfo(env, j[1]);
  return null;
}
