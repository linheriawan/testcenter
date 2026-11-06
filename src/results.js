// Latest result per test for a user.

export async function latestResults(env, userId) {
  const { results } = await env.DB.prepare(
    `SELECT test_id, result, created_at FROM test_results t
     WHERE user_id = ? AND created_at = (SELECT MAX(created_at) FROM test_results WHERE user_id = t.user_id AND test_id = t.test_id)`
  )
    .bind(userId)
    .all();
  const out = {};
  for (const r of results || []) out[r.test_id] = { ...JSON.parse(r.result), completedAt: r.created_at };
  return out;
}
