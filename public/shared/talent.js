// Talent assessment scoring rules, shared by the Worker (API) and the browser (live preview).
//
// Each participant gets a score of 1–5 on 18 psychological aspects. Each job level
// (standard) has a required score per aspect. Comparing the two gives:
//   gap    = aspects below the requirement
//   match  = aspects equal to the requirement
//   talent = aspects above the requirement
// Fit (from gap):        0–2 Fit in position, 3–5 Moderate fit, 6+ Low fit
// Potential (from talent): 7+ Ready, 4–6 Potential, 0–3 Develop
// Fit × Potential places the participant in a 9-box grid, and each box maps to a recommendation.

export const LEVELS = [
  { value: 1, code: 'KS', name: 'Kurang Sekali' },
  { value: 2, code: 'K', name: 'Kurang' },
  { value: 3, code: 'C', name: 'Cukup' },
  { value: 4, code: 'B', name: 'Baik' },
  { value: 5, code: 'BS', name: 'Baik Sekali' }
];

export const GROUPS = [
  { key: 'kognitif', name: 'Kemampuan Kognitif' },
  { key: 'sikap', name: 'Sikap Kerja' },
  { key: 'sosial', name: 'Sosial Emosional' }
];

export const ASPECTS = [
  { key: 'kecerdasan', group: 'kognitif', name: 'Kecerdasan Umum', low: 'Kesulitan bernalar, merencanakan, dan memecahkan masalah', high: 'Mampu bernalar, merencanakan, dan memecahkan masalah secara optimal' },
  { key: 'analisis', group: 'kognitif', name: 'Analisis Sintesis', low: 'Kesulitan mengurai masalah dan menarik kesimpulan', high: 'Mampu mengurai masalah yang kompleks dan menyimpulkan secara akurat' },
  { key: 'integratif', group: 'kognitif', name: 'Berpikir Integratif', low: 'Cenderung melihat masalah dari satu sudut pandang', high: 'Melihat masalah dari berbagai sudut pandang dan mencari alternatif solusi' },
  { key: 'keputusan', group: 'kognitif', name: 'Pengambilan Keputusan', low: 'Lambat dan ragu dalam memutuskan', high: 'Mengambil keputusan dengan tepat berdasarkan data' },
  { key: 'motivasi', group: 'sikap', name: 'Motivasi Kerja', low: 'Mudah puas dengan hasil yang dicapai', high: 'Berusaha maksimal untuk melampaui target' },
  { key: 'stres', group: 'sikap', name: 'Daya Tahan Stres', low: 'Mudah cemas dan menyerah di bawah tekanan', high: 'Tetap konsisten bekerja di bawah tekanan' },
  { key: 'sistematika', group: 'sikap', name: 'Sistematika Kerja', low: 'Kurang runtut dan sulit menentukan prioritas', high: 'Bekerja runtut dan memahami langkah penyelesaian tugas' },
  { key: 'ketelitian', group: 'sikap', name: 'Ketelitian', low: 'Kurang cermat sehingga sering keliru', high: 'Akurat, detail, dan minim kesalahan' },
  { key: 'inisiatif', group: 'sikap', name: 'Inisiatif', low: 'Menunggu arahan sebelum memulai pekerjaan', high: 'Memulai pekerjaan tanpa perlu instruksi' },
  { key: 'interaksi', group: 'sikap', name: 'Interaksi Sosial', low: 'Cenderung menarik diri dari lingkungan sosial', high: 'Terampil membangun hubungan dengan orang lain' },
  { key: 'tanggungjawab', group: 'sikap', name: 'Tanggung Jawab', low: 'Kurang tuntas dalam menyelesaikan tugas', high: 'Menyelesaikan tugas secara tuntas dan siap menanggung risiko' },
  { key: 'percayadiri', group: 'sosial', name: 'Kepercayaan Diri', low: 'Kurang yakin pada kemampuan diri dan kurang asertif', high: 'Asertif, berpendirian, dan yakin pada kemampuan diri' },
  { key: 'penyesuaian', group: 'sosial', name: 'Penyesuaian Diri', low: 'Sulit menyesuaikan diri dengan orang dan situasi baru', high: 'Fleksibel dan cepat beradaptasi pada situasi baru' },
  { key: 'emosi', group: 'sosial', name: 'Stabilitas Emosi', low: 'Kurang stabil secara emosi dan cenderung impulsif', high: 'Tenang dan mampu mengendalikan emosi' },
  { key: 'kepatuhan', group: 'sosial', name: 'Kepatuhan', low: 'Kurang disiplin dan kurang mengikuti aturan', high: 'Disiplin dan mematuhi aturan yang berlaku' },
  { key: 'kritik', group: 'sosial', name: 'Penerimaan Kritik', low: 'Cenderung menolak masukan', high: 'Menerima masukan dan kritik dengan tenang' },
  { key: 'kerjasama', group: 'sosial', name: 'Kerja Sama', low: 'Lebih suka bekerja sendiri', high: 'Aktif berkontribusi dalam pencapaian tujuan tim' },
  { key: 'kepemimpinan', group: 'sosial', name: 'Kepemimpinan', low: 'Enggan mengambil peran memimpin', high: 'Mampu dan mau mengarahkan orang lain' }
];

export const FIT = {
  fit: { key: 'fit', name: 'Fit in Position', short: 'Fit', category: 'Memenuhi Kriteria', range: '0–2 aspek di bawah standar' },
  moderate: { key: 'moderate', name: 'Moderate Fit', short: 'Moderat', category: 'Cukup Memenuhi Kriteria', range: '3–5 aspek di bawah standar' },
  low: { key: 'low', name: 'Low Fit', short: 'Rendah', category: 'Kurang Memenuhi Kriteria', range: '6 aspek atau lebih di bawah standar' }
};

export const POTENTIAL = {
  ready: { key: 'ready', name: 'Ready', range: '7 aspek atau lebih di atas standar' },
  potential: { key: 'potential', name: 'Potential', range: '4–6 aspek di atas standar' },
  develop: { key: 'develop', name: 'Develop', range: '0–3 aspek di atas standar' }
};

export const RECOMMENDATIONS = {
  disarankan: { key: 'disarankan', name: 'Disarankan', order: 1 },
  dipertimbangkan: { key: 'dipertimbangkan', name: 'Dipertimbangkan', order: 2 },
  catatan: { key: 'catatan', name: 'Dipertimbangkan dengan Catatan', order: 3 },
  tidak: { key: 'tidak', name: 'Tidak Disarankan', order: 4 }
};

// 9-box: rows are potential (ready, potential, develop); columns are fit (low, moderate, fit).
export const BOXES = {
  'ready:low': { key: 'potential_employee', name: 'Potential Employee', rec: 'dipertimbangkan' },
  'ready:moderate': { key: 'growth', name: 'Growth Employee', rec: 'disarankan' },
  'ready:fit': { key: 'talent_future', name: 'Talent Future', rec: 'disarankan' },
  'potential:low': { key: 'inconsistent', name: 'Inconsistent Employee', rec: 'catatan' },
  'potential:moderate': { key: 'effective', name: 'Effective Employee', rec: 'disarankan' },
  'potential:fit': { key: 'fitness', name: 'Fitness Employee', rec: 'disarankan' },
  'develop:low': { key: 'risk', name: 'Risk Employee', rec: 'tidak' },
  'develop:moderate': { key: 'average', name: 'Average Employee', rec: 'catatan' },
  'develop:fit': { key: 'solid', name: 'Solid Employee', rec: 'dipertimbangkan' }
};

export const BOX_ORDER = [
  ['ready:low', 'ready:moderate', 'ready:fit'],
  ['potential:low', 'potential:moderate', 'potential:fit'],
  ['develop:low', 'develop:moderate', 'develop:fit']
];

export function boxByKey(key) {
  for (const [pos, box] of Object.entries(BOXES)) if (box.key === key) return { pos, ...box };
  return null;
}

export const LEADERSHIP_STYLES = [
  { key: 'Executive', desc: 'Menyeimbangkan target dan hubungan kerja; menetapkan standar tinggi sekaligus melibatkan tim dalam keputusan.' },
  { key: 'Developer', desc: 'Profesional dan peduli pada pengembangan bawahan; memberi ruang untuk ide dan senang berbagi keahlian.' },
  { key: 'Benevolent Autocrat', desc: 'Tegas dan terstruktur dalam menetapkan target, tetapi tetap komunikatif dan adil.' },
  { key: 'Bureaucrat', desc: 'Berpegang pada prosedur, aturan, dan jalur kewenangan; komunikasi cenderung formal.' },
  { key: 'Compromiser', desc: 'Berusaha menyeimbangkan tugas dan hubungan, tetapi cenderung berkompromi sehingga keputusan kurang tegas.' },
  { key: 'Missionary', desc: 'Mengutamakan keharmonisan dan hubungan baik, kadang dengan mengorbankan target.' },
  { key: 'Autocrat', desc: 'Fokus pada hasil dan instruksi; komunikasi terbatas dan kurang melibatkan bawahan.' },
  { key: 'Deserter', desc: 'Cenderung menghindari keterlibatan dan situasi sulit; kurang aktif mengarahkan tim.' }
];

export function iqCategory(iq) {
  const n = Number(iq);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 130) return 'Sangat Superior';
  if (n >= 120) return 'Superior';
  if (n >= 110) return 'Rata-rata Atas';
  if (n >= 90) return 'Rata-rata';
  if (n >= 80) return 'Rata-rata Bawah';
  return 'Di Bawah Rata-rata';
}

export function isValidScores(scores) {
  return Array.isArray(scores) && scores.length === ASPECTS.length && scores.every((s) => Number.isInteger(s) && s >= 1 && s <= 5);
}

export function evaluate(scores, required) {
  let gap = 0;
  let match = 0;
  let talent = 0;
  const diffs = ASPECTS.map((_, i) => {
    const d = scores[i] - required[i];
    if (d < 0) gap++;
    else if (d === 0) match++;
    else talent++;
    return d;
  });
  const fit = gap <= 2 ? 'fit' : gap <= 5 ? 'moderate' : 'low';
  const potential = talent >= 7 ? 'ready' : talent >= 4 ? 'potential' : 'develop';
  const box = BOXES[`${potential}:${fit}`];
  return { gap, match, talent, diffs, fit, potential, box: box.key, recommendation: box.rec };
}
