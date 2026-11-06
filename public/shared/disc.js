// DISC-style work style test, based on W. M. Marston's model (1928). Items written for this app;
// not the DiSC® assessment and not the Thomas PPA. Should be reviewed by the psychologist before use.
//
// 24 groups of 4 words. In each group the participant picks the word MOST like them and the
// word LEAST like them. Each word belongs to one factor:
//   D = Dominance, I = Influence, S = Steadiness, C = Conscientiousness (compliance).
// Scores: Most count, Least count, and Change = Most − Least (−24 … +24) per factor.

export const FACTORS = {
  D: { name: 'Dominance', id: 'Dominan', desc: 'Direct, decisive and results-driven. Likes challenges, acts quickly and takes charge.', descId: 'Langsung, tegas, dan berorientasi hasil. Menyukai tantangan, cepat bertindak, dan mengambil kendali.' },
  I: { name: 'Influence', id: 'Pengaruh', desc: 'Outgoing, enthusiastic and persuasive. Energised by people and good at motivating others.', descId: 'Supel, antusias, dan persuasif. Bersemangat bersama orang lain dan pandai memotivasi.' },
  S: { name: 'Steadiness', id: 'Kestabilan', desc: 'Patient, reliable and supportive. Values harmony, consistency and a steady pace.', descId: 'Sabar, dapat diandalkan, dan suportif. Menghargai keharmonisan, konsistensi, dan ritme kerja yang stabil.' },
  C: { name: 'Conscientiousness', id: 'Kepatuhan', desc: 'Careful, accurate and analytical. Values quality, rules and getting things right.', descId: 'Cermat, akurat, dan analitis. Menghargai kualitas, aturan, dan ketepatan.' }
};

// [word in Indonesian, English gloss, factor]
export const GROUPS = [
  [['Tegas', 'decisive', 'D'], ['Ramah', 'friendly', 'I'], ['Sabar', 'patient', 'S'], ['Teliti', 'thorough', 'C']],
  [['Ceria', 'cheerful', 'I'], ['Akurat', 'accurate', 'C'], ['Berani', 'bold', 'D'], ['Tenang', 'calm', 'S']],
  [['Setia', 'loyal', 'S'], ['Kompetitif', 'competitive', 'D'], ['Sistematis', 'systematic', 'C'], ['Pandai bergaul', 'sociable', 'I']],
  [['Analitis', 'analytical', 'C'], ['Pendengar yang baik', 'good listener', 'S'], ['Antusias', 'enthusiastic', 'I'], ['Lugas', 'straightforward', 'D']],
  [['Ambisius', 'ambitious', 'D'], ['Hati-hati', 'careful', 'C'], ['Ekspresif', 'expressive', 'I'], ['Stabil', 'steady', 'S']],
  [['Persuasif', 'persuasive', 'I'], ['Akomodatif', 'accommodating', 'S'], ['Mandiri', 'independent', 'D'], ['Taat aturan', 'rule-abiding', 'C']],
  [['Konsisten', 'consistent', 'S'], ['Perfeksionis', 'perfectionist', 'C'], ['Optimis', 'optimistic', 'I'], ['Suka tantangan', 'likes challenges', 'D']],
  [['Cepat bertindak', 'quick to act', 'D'], ['Spontan', 'spontaneous', 'I'], ['Logis', 'logical', 'C'], ['Penolong', 'helpful', 'S']],
  [['Rapi', 'neat', 'C'], ['Penuh tekad', 'determined', 'D'], ['Santai', 'easygoing', 'S'], ['Humoris', 'humorous', 'I']],
  [['Mudah percaya', 'trusting', 'I'], ['Bisa diandalkan', 'dependable', 'S'], ['Kritis', 'critical thinker', 'C'], ['Suka memimpin', 'takes charge', 'D']],
  [['Asertif', 'assertive', 'D'], ['Cermat', 'meticulous', 'C'], ['Rendah hati', 'humble', 'S'], ['Menginspirasi', 'inspiring', 'I']],
  [['Pemaaf', 'forgiving', 'S'], ['Senang bicara', 'talkative', 'I'], ['Kuat kemauan', 'strong-willed', 'D'], ['Disiplin', 'disciplined', 'C']],
  [['Detail', 'detail-oriented', 'C'], ['Populer', 'popular', 'I'], ['Lembut', 'gentle', 'S'], ['Berorientasi hasil', 'results-driven', 'D']],
  [['Petualang', 'adventurous', 'D'], ['Suka bekerja sama', 'cooperative', 'S'], ['Hangat', 'warm', 'I'], ['Berstandar tinggi', 'high standards', 'C']],
  [['Meyakinkan', 'convincing', 'I'], ['Objektif', 'objective', 'C'], ['Pantang mundur', 'never backs down', 'D'], ['Damai', 'peaceful', 'S']],
  [['Pengertian', 'understanding', 'S'], ['Suka mengendalikan', 'likes control', 'D'], ['Bersemangat', 'energetic', 'I'], ['Terencana', 'planned', 'C']],
  [['Faktual', 'factual', 'C'], ['Menerima', 'accepting', 'S'], ['Blak-blakan', 'blunt', 'D'], ['Supel', 'outgoing', 'I']],
  [['Suka tampil', 'likes the spotlight', 'I'], ['Pengambil risiko', 'risk-taker', 'D'], ['Menyukai rutinitas', 'likes routine', 'S'], ['Tertib', 'orderly', 'C']],
  [['Peduli', 'caring', 'S'], ['Mempertanyakan', 'questioning', 'C'], ['Penuh ide', 'full of ideas', 'I'], ['Tidak sabaran', 'impatient', 'D']],
  [['Teguh pendirian', 'firm', 'D'], ['Tepat waktu', 'punctual', 'C'], ['Menyenangkan', 'fun to be with', 'I'], ['Berkomitmen pada tim', 'team-committed', 'S']],
  [['Akrab', 'approachable', 'I'], ['Mendukung', 'supportive', 'S'], ['Berpikir mendalam', 'deep thinker', 'C'], ['Bersemangat menang', 'driven to win', 'D']],
  [['Prosedural', 'by the book', 'C'], ['Pemberi arahan', 'directive', 'D'], ['Sederhana', 'modest', 'S'], ['Pandai memotivasi', 'motivating', 'I']],
  [['Gesit', 'agile', 'D'], ['Riang', 'lively', 'I'], ['Presisi', 'precise', 'C'], ['Tidak tergesa-gesa', 'unhurried', 'S']],
  [['Penengah', 'peacemaker', 'S'], ['Pelopor', 'pioneer', 'D'], ['Komunikatif', 'communicative', 'I'], ['Waspada', 'cautious', 'C']]
];

export function validDisc(answers) {
  return (
    Array.isArray(answers) &&
    answers.length === GROUPS.length &&
    answers.every((a) => a && Number.isInteger(a.m) && Number.isInteger(a.l) && a.m >= 0 && a.m < 4 && a.l >= 0 && a.l < 4 && a.m !== a.l)
  );
}

export function scoreDisc(answers) {
  const most = { D: 0, I: 0, S: 0, C: 0 };
  const least = { D: 0, I: 0, S: 0, C: 0 };
  answers.forEach((a, g) => {
    most[GROUPS[g][a.m][2]]++;
    least[GROUPS[g][a.l][2]]++;
  });
  const change = {};
  for (const f of 'DISC') change[f] = most[f] - least[f];
  // Profile code: factors above the midline (change > 0), strongest first, up to three.
  const above = 'DISC'
    .split('')
    .filter((f) => change[f] > 0)
    .sort((a, b) => change[b] - change[a])
    .slice(0, 3);
  const code = above.length ? above.join('-') : 'DISC'.split('').sort((a, b) => change[b] - change[a])[0];
  const primary = code[0];
  return { most, least, change, code, primary };
}

// Change score (−24 … +24) to a 1–5 level, for suggestions.
export function changeLevel(v) {
  if (v >= 8) return 5;
  if (v >= 3) return 4;
  if (v >= -2) return 3;
  if (v >= -7) return 2;
  return 1;
}
