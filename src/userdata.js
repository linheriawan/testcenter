// Deletes everything stored about one user (used by self-service deletion and by admins).

export async function deleteUserData(env, userId) {
  const u = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first();
  const stmts = [
    env.DB.prepare('DELETE FROM bookings WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM appointments WHERE user_id = ?').bind(userId),
    env.DB.prepare("UPDATE appointments SET status = 'cancelled' WHERE psychologist_id = ? AND status IN ('requested', 'confirmed')").bind(userId),
    env.DB.prepare('DELETE FROM insights WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM test_results WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM kraepelin_sessions WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM profiles WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM org_participants WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM org_members WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM psychologists WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM talent_profiles WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM talent_requests WHERE user_id = ?').bind(userId),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId)
  ];
  if (u) stmts.push(env.DB.prepare('DELETE FROM org_invite_emails WHERE email = ?').bind(u.email));
  await env.DB.batch(stmts);
}
