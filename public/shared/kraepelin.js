// Kraepelin-style work test: add each pair of adjacent digits and enter the last digit of the sum.
// Each column lasts a fixed number of seconds; the test moves to the next column automatically.
// Shared by the browser (to show the digits) and the Worker (to regenerate and score them).

export const KRAEPELIN = {
  columns: 40,
  seconds: 15,
  length: 70, // digits per column; more than anyone can finish in 15 seconds
  practiceSeconds: 15
};

// Small deterministic PRNG so the server can regenerate the exact digits from a seed.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function columnDigits(seed, col, length = KRAEPELIN.length) {
  const rand = mulberry32((seed ^ Math.imul(col + 1, 2654435761)) >>> 0);
  const out = [];
  for (let i = 0; i < length; i++) out.push(1 + Math.floor(rand() * 9)); // digits 1–9
  return out;
}

export function expected(digits, i) {
  return (digits[i] + digits[i + 1]) % 10;
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function sd(xs) {
  const m = mean(xs);
  return xs.length > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1)) : 0;
}

function round(n, d = 2) {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}

// Provisional norms for the online version (per 15-second column). These are starting points,
// not validated norms: the psychologist should adjust them once real results are collected.
export const NORMS = {
  speed: [12, 16, 21, 27], // average answers per column: below 12 → 1 … 27 or more → 5
  errorRate: [10, 6, 3, 1], // % wrong: above 10 → 1 … below 1 → 5
  variation: [0.35, 0.25, 0.18, 0.12], // coefficient of variation: above 0.35 → 1 … below 0.12 → 5
  endurance: [0.75, 0.88, 0.97, 1.05] // last third ÷ first third: below 0.75 → 1 … 1.05 or more → 5
};

function levelUp(value, cuts) {
  // Higher is better.
  let level = 1;
  for (const c of cuts) if (value >= c) level++;
  return level;
}

function levelDown(value, cuts) {
  // Lower is better.
  let level = 1;
  for (const c of cuts) if (value <= c) level++;
  return level;
}

export const INDEX_NAMES = {
  speed: 'Kecepatan kerja',
  accuracy: 'Ketelitian',
  consistency: 'Keajegan',
  endurance: 'Ketahanan'
};

// answers: array (one per column) of arrays of entered digits, in order.
export function scoreKraepelin(seed, answers, config = KRAEPELIN) {
  const perColumn = [];
  let totalAnswered = 0;
  let totalWrong = 0;
  for (let c = 0; c < config.columns; c++) {
    const digits = columnDigits(seed, c, config.length);
    const given = Array.isArray(answers[c]) ? answers[c].slice(0, config.length - 1) : [];
    let wrong = 0;
    given.forEach((d, i) => {
      if (d !== expected(digits, i)) wrong++;
    });
    perColumn.push({ answered: given.length, wrong });
    totalAnswered += given.length;
    totalWrong += wrong;
  }
  const counts = perColumn.map((p) => p.answered);
  const avg = mean(counts);
  const third = Math.max(1, Math.floor(counts.length / 3));
  const first = mean(counts.slice(0, third));
  const last = mean(counts.slice(-third));
  const errorRate = totalAnswered ? (totalWrong / totalAnswered) * 100 : 100;
  const variation = avg ? sd(counts) / avg : 1;
  const endurance = first ? last / first : 0;

  return {
    columns: config.columns,
    seconds: config.seconds,
    perColumn: counts,
    wrongPerColumn: perColumn.map((p) => p.wrong),
    totalAnswered,
    totalWrong,
    speed: round(avg, 1),
    errorRate: round(errorRate, 1),
    range: counts.length ? Math.max(...counts) - Math.min(...counts) : 0,
    variation: round(variation, 3),
    endurance: round(endurance, 3),
    levels: {
      speed: levelUp(avg, NORMS.speed),
      accuracy: levelDown(errorRate, NORMS.errorRate),
      consistency: levelDown(variation, NORMS.variation),
      endurance: levelUp(endurance, NORMS.endurance)
    }
  };
}
