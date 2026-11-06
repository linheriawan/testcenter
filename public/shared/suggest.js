// Turns online test results into SUGGESTED 1–5 scores for the 18 psikogram aspects.
// Suggestions are a starting point for the psychologist, never a final score.
// strength: 'tes' = measured fairly directly; 'indikasi' = weaker, needs confirmation.

import { ASPECTS } from './talent.js';
import { changeLevel } from './disc.js';

function fromPct(p) {
  // Big Five percentage (0–100) to 1–5.
  if (p >= 80) return 5;
  if (p >= 60) return 4;
  if (p >= 40) return 3;
  if (p >= 20) return 2;
  return 1;
}

function avg(...xs) {
  const v = xs.filter((x) => Number.isFinite(x));
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

export function suggestScores({ kraepelin, bigfive, disc } = {}) {
  const k = kraepelin ? kraepelin.levels : null;
  const b = {};
  if (bigfive && Array.isArray(bigfive.traits)) for (const t of bigfive.traits) b[t.key] = t.pct;
  const has = (key) => Number.isFinite(b[key]);
  const out = {};
  const set = (key, value, source, strength) => {
    if (value !== null && value !== undefined) out[key] = { value: Math.max(1, Math.min(5, value)), source, strength };
  };

  if (k) {
    set('ketelitian', k.accuracy, 'Kraepelin: ketelitian', 'tes');
    set('sistematika', has('C') ? avg(k.consistency, fromPct(b.C)) : k.consistency, has('C') ? 'Kraepelin: keajegan + Big Five: Conscientiousness' : 'Kraepelin: keajegan', 'tes');
    set('stres', has('N') ? avg(k.endurance, fromPct(100 - b.N)) : k.endurance, has('N') ? 'Kraepelin: ketahanan + Big Five: stabilitas emosi' : 'Kraepelin: ketahanan', 'tes');
    set('motivasi', avg(k.speed, k.endurance), 'Kraepelin: kecepatan dan ketahanan', 'indikasi');
  } else if (has('N')) {
    set('stres', fromPct(100 - b.N), 'Big Five: stabilitas emosi', 'indikasi');
  }
  if (!k && has('C')) set('sistematika', fromPct(b.C), 'Big Five: Conscientiousness', 'indikasi');

  if (has('N')) set('emosi', fromPct(100 - b.N), 'Big Five: stabilitas emosi', 'tes');
  if (has('C')) {
    set('kepatuhan', fromPct(b.C), 'Big Five: Conscientiousness', 'indikasi');
    set('tanggungjawab', fromPct(b.C), 'Big Five: Conscientiousness', 'indikasi');
  }
  if (has('A')) {
    set('kerjasama', fromPct(b.A), 'Big Five: Agreeableness', 'indikasi');
    set('kritik', fromPct(b.A), 'Big Five: Agreeableness', 'indikasi');
  }
  if (has('E')) {
    set('interaksi', fromPct(b.E), 'Big Five: Extraversion', 'indikasi');
    set('kepemimpinan', fromPct(b.E), 'Big Five: Extraversion', 'indikasi');
  }
  if (has('E') && has('N')) set('percayadiri', avg(fromPct(b.E), fromPct(100 - b.N)), 'Big Five: Extraversion + stabilitas emosi', 'indikasi');
  if (has('O') && has('N')) set('penyesuaian', avg(fromPct(b.O), fromPct(100 - b.N)), 'Big Five: Openness + stabilitas emosi', 'indikasi');
  if (has('E') && has('O')) set('inisiatif', avg(fromPct(b.E), fromPct(b.O)), 'Big Five: Extraversion + Openness', 'indikasi');

  // DISC fills gaps only (weaker evidence than Big Five for these aspects).
  if (disc && disc.change) {
    const c = disc.change;
    const fill = (key, value, source) => {
      if (!out[key]) set(key, value, source, 'indikasi');
    };
    fill('kepemimpinan', changeLevel(c.D), 'DISC: Dominance');
    fill('inisiatif', changeLevel(c.D), 'DISC: Dominance');
    fill('interaksi', changeLevel(c.I), 'DISC: Influence');
    fill('kerjasama', changeLevel(c.S), 'DISC: Steadiness');
    fill('kepatuhan', changeLevel(c.C), 'DISC: Conscientiousness');
    fill('sistematika', changeLevel(c.C), 'DISC: Conscientiousness');
  }

  return ASPECTS.map((a) => out[a.key] || null);
}

// Aspects no current online test covers (cognitive ability, decision making in simulation).
export const NEEDS_JUDGMENT_NOTE =
  'Aspek kognitif (Kecerdasan Umum, Analisis Sintesis, Berpikir Integratif, Pengambilan Keputusan) belum diukur oleh tes online dan perlu dinilai psikolog.';
