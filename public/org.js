// Portal Organisasi — corporate talent assessment module (vanilla JS, hash routing).

import {
  ASPECTS,
  GROUPS,
  LEVELS,
  FIT,
  POTENTIAL,
  RECOMMENDATIONS,
  BOXES,
  BOX_ORDER,
  LEADERSHIP_STYLES,
  boxByKey,
  evaluate,
  iqCategory
} from '/shared/talent.js';
import { INDEX_NAMES } from '/shared/kraepelin.js';
import { FACTORS as DISC_FACTORS } from '/shared/disc.js';

const root = document.getElementById('root');
const S = { me: null, org: null, standards: [] };

// ---------------- utilities ----------------

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (res.status === 401) {
    showLogin();
    const e = new Error('Silakan masuk');
    e.handled = true;
    throw e;
  }
  if (!res.ok) {
    const e = new Error(data.error || `Permintaan gagal (${res.status})`);
    e.data = data;
    throw e;
  }
  return data;
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(query || '') };
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function pct(n, total) {
  return total ? Math.round((n / total) * 1000) / 10 : 0;
}

function can(role) {
  const rank = { viewer: 1, assessor: 2, admin: 3 };
  return S.org && rank[S.org.role] >= rank[role];
}

const REC_ORDER = ['disarankan', 'dipertimbangkan', 'catatan', 'tidak'];
const REC_COLOR = { disarankan: '#0F7B6C', dipertimbangkan: '#3A3FD8', catatan: '#C2410C', tidak: '#B42318' };
const ROLE_NAMES = { admin: 'Admin', assessor: 'Asesor', viewer: 'Pembaca (HR)' };
const PURPOSES = ['Talent Assessment', 'Promosi', 'Rotasi', 'Rekrutmen', 'Pengembangan'];

function recChip(key) {
  const r = RECOMMENDATIONS[key];
  return r ? `<span class="chip rec-${key}">${esc(r.name)}</span>` : '';
}

function boxChip(key) {
  const b = boxByKey(key);
  return b ? `<span class="chip rec-${b.rec}">${esc(b.name)}</span>` : '';
}

function icon(path, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

const IC = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 20a6 6 0 0 0-2.5-4.9"/>',
  ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  print: '<path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>',
  upload: '<path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M5 20h14"/>',
  download: '<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>'
};

function loading() {
  return '<div class="loading"><div class="spinner"></div>Memuat…</div>';
}

function showLogin() {
  try {
    sessionStorage.setItem('tc_next', '/org/' + location.hash);
  } catch {
    /* ignore */
  }
  root.innerHTML = `<div class="center-box">
    <div class="card">
      <h2>Portal Organisasi</h2>
      <p class="muted">Masuk dengan akun Test Center Anda untuk membuka portal organisasi.</p>
      <a class="btn btn-primary btn-lg" href="/app/#/login">Masuk</a>
      <p class="small muted">Belum punya akun? <a href="/app/#/register">Buat akun</a>, lalu minta admin organisasi menambahkan email Anda.</p>
    </div>
  </div>`;
}

function shell(active, content) {
  const id = S.org.id;
  const items = [
    ['dash', `#/o/${id}`, IC.dash, 'Dasbor'],
    ['peserta', `#/o/${id}/peserta`, IC.people, 'Peserta'],
    ['undangan', `#/o/${id}/undangan`, IC.send, 'Undangan & Tes'],
    ...(['sekolah', 'kampus'].includes(S.org.type) ? [] : [['talent', `#/o/${id}/talent`, IC.search, 'Talent pool']]),
    ['standar', `#/o/${id}/standar`, IC.ruler, 'Standar Jabatan'],
    ...(can('admin') ? [['pengaturan', `#/o/${id}/pengaturan`, IC.gear, 'Pengaturan']] : [])
  ];
  root.innerHTML = `<div class="shell">
    <aside class="side">
      <a class="brand" href="/"><span class="brand-mark">${icon(IC.compass, 18)}</span>Test Center</a>
      <div class="org-name">Organisasi<b>${esc(S.org.name)}</b></div>
      <nav aria-label="Menu organisasi">${items
        .map(([k, h, ic, label]) => `<a href="${h}" class="${active === k ? 'on' : ''}" ${active === k ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`)
        .join('')}</nav>
      <div class="foot">
        <span>${esc(S.me.user.name)} · ${esc(ROLE_NAMES[S.org.role])}</span>
        ${S.me.orgs.length > 1 || S.me.isAdmin ? '<a href="#/">Ganti organisasi</a>' : ''}
        <a href="/app/">Aplikasi peserta</a>
      </div>
    </aside>
    <main class="main" id="main">${content}</main>
  </div>`;
  return document.getElementById('main');
}

async function loadOrg(id) {
  if (S.org && S.org.id === id && S.standards.length) return;
  const [{ org }, { standards }] = await Promise.all([api(`/api/org/${id}`), api(`/api/org/${id}/standards`)]);
  S.org = org;
  S.standards = standards;
}

async function refreshStandards() {
  S.standards = (await api(`/api/org/${S.org.id}/standards`)).standards;
}

function standardOptions(selected, withAll) {
  return `${withAll ? '<option value="">Semua level</option>' : '<option value="">Pilih…</option>'}${S.standards
    .map((s) => `<option value="${esc(s.code)}" ${s.code === selected ? 'selected' : ''}>${esc(s.code)} – ${esc(s.name)}</option>`)
    .join('')}`;
}

// ---------------- org picker ----------------

async function viewPicker() {
  S.me = await api('/api/org/mine');
  if (S.me.orgs.length === 1 && !S.me.isAdmin) return go(`#/o/${S.me.orgs[0].id}`);
  root.innerHTML = `<div class="center-box">
    <div class="card">
      <h2>Pilih organisasi</h2>
      ${
        S.me.orgs.length
          ? `<div class="bars">${S.me.orgs
              .map((o) => `<a class="btn btn-outline btn-lg" style="justify-content:space-between" href="#/o/${o.id}"><span>${esc(o.name)}</span><span class="small muted">${esc(ROLE_NAMES[o.role])}</span></a>`)
              .join('')}</div>`
          : '<p class="muted">Akun Anda belum terdaftar di organisasi mana pun. Minta admin organisasi menambahkan email Anda.</p>'
      }
    </div>
    ${
      S.me.isAdmin
        ? `<form class="card" id="newOrg">
        <h2>Buat organisasi baru</h2>
        <div class="field"><label for="on">Nama organisasi</label><input class="input" id="on" required maxlength="160" placeholder="mis. PT Contoh Logistik"></div>
        <div class="field"><label for="ot">Jenis</label><select class="input" id="ot">
          <option value="perusahaan">Perusahaan</option><option value="sekolah">Sekolah</option><option value="kampus">Perguruan tinggi</option><option value="biro">Biro psikologi</option><option value="lainnya">Lainnya</option>
        </select></div>
        <div id="err"></div>
        <button class="btn btn-primary" type="submit">Buat organisasi</button>
        <p class="small muted">Organisasi baru langsung mendapat 4 contoh standar jabatan yang bisa Anda ubah.</p>
      </form>`
        : ''
    }
    <p class="small muted" style="text-align:center">Masuk sebagai ${esc(S.me.user.email)} · <a href="/app/">Aplikasi peserta</a></p>
  </div>`;
  const f = document.getElementById('newOrg');
  if (f)
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const { org } = await api('/api/admin/orgs', { method: 'POST', body: { name: f.on.value, type: f.ot.value } });
        go(`#/o/${org.id}`);
      } catch (err) {
        document.getElementById('err').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    });
}

// ---------------- dashboard ----------------

function nineBox(boxes, total, filterBase, highlight) {
  const rowLabels = ['Ready', 'Potential', 'Develop'];
  let html = '<div class="ninebox" role="group" aria-label="Matriks 9-box: potensi terhadap kesesuaian jabatan">';
  BOX_ORDER.forEach((row, r) => {
    html += `<div class="ylab">${rowLabels[r]}</div>`;
    row.forEach((pos) => {
      const b = BOXES[pos];
      const n = boxes ? boxes[b.key] || 0 : null;
      const inner = `<span class="nm">${esc(b.name)}</span>${
        n !== null ? `<span><span class="ct">${n}</span> <span class="pc">${pct(n, total)}%</span></span>` : ''
      }<span class="pc">${esc(RECOMMENDATIONS[b.rec].name)}</span>`;
      html += filterBase
        ? `<a class="cell ${b.rec}" href="${filterBase}box=${b.key}" aria-label="${esc(b.name)}: ${n} peserta">${inner}</a>`
        : `<div class="cell ${b.rec} ${highlight === b.key ? 'here' : ''}">${inner}</div>`;
    });
  });
  html += `<div></div><div class="xlab">Low Fit<br><span class="small">6+ gap</span></div><div class="xlab">Moderate Fit<br><span class="small">3–5 gap</span></div><div class="xlab">Fit in Position<br><span class="small">0–2 gap</span></div></div>`;
  return html;
}

function legend() {
  return `<div class="legend">${REC_ORDER.map((k) => `<span><i class="rec-${k}" style="border:1px solid ${REC_COLOR[k]}"></i>${RECOMMENDATIONS[k].name}</span>`).join('')}</div>`;
}

function recTable(map, label) {
  const keys = Object.keys(map).sort((a, b) => a.localeCompare(b));
  if (!keys.length) return '<p class="muted">Belum ada data.</p>';
  return `<div class="table-wrap"><table>
    <thead><tr><th>${label}</th><th class="num">Total</th>${REC_ORDER.map((k) => `<th class="num">${RECOMMENDATIONS[k].name}</th>`).join('')}</tr></thead>
    <tbody>${keys
      .map((k) => {
        const v = map[k];
        return `<tr><td class="nm">${esc(k)}</td><td class="num">${v.total}</td>${REC_ORDER.map((r) => `<td class="num">${v[r] || 0} <span class="muted small">(${pct(v[r] || 0, v.total)}%)</span></td>`).join('')}</tr>`;
      })
      .join('')}</tbody></table></div>`;
}

async function viewDashboard(params) {
  const main = shell('dash', loading());
  const q = new URLSearchParams();
  for (const k of ['standard', 'division']) if (params.get(k)) q.set(k, params.get(k));
  const d = await api(`/api/org/${S.org.id}/dashboard?${q}`);
  const base = `#/o/${S.org.id}/peserta?${q.toString() ? q.toString() + '&' : ''}`;
  const t = d.total;
  const ready = (d.boxes.talent_future || 0) + (d.boxes.growth || 0);
  const sortedAspects = [...d.aspects].sort((a, b) => b.below - a.below);
  const maxBelow = Math.max(1, ...sortedAspects.map((a) => a.below));

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Dasbor talenta</h1><p>Ringkasan hasil asesmen ${esc(S.org.name)}</p></div>
      <div class="actions">
        ${can('assessor') ? `<a class="btn btn-primary" href="#/o/${S.org.id}/peserta/baru">${icon(IC.plus)}Tambah peserta</a>` : ''}
      </div>
    </div>
    <form class="filters" id="flt">
      <div class="field"><label for="fs">Level jabatan</label><select class="input" id="fs">${standardOptions(params.get('standard'), true)}</select></div>
      <div class="field"><label for="fd">Divisi</label><select class="input" id="fd"><option value="">Semua divisi</option>${d.divisions
        .map((x) => `<option ${x === params.get('division') ? 'selected' : ''}>${esc(x)}</option>`)
        .join('')}</select></div>
    </form>
    ${
      !t
        ? `<div class="card"><h2>Belum ada data asesmen</h2><p class="muted">Tambahkan peserta satu per satu atau impor dari file CSV.</p>
          <div class="actions">${can('assessor') ? `<a class="btn btn-primary" href="#/o/${S.org.id}/peserta/baru">Tambah peserta</a><a class="btn btn-outline" href="#/o/${S.org.id}/peserta?impor=1">Impor CSV</a>` : ''}
          ${S.me.isAdmin && !q.toString() ? '<button class="btn btn-outline" id="demo" type="button">Isi data contoh</button>' : ''}</div></div>`
        : `
    <div class="grid cols-4">
      <div class="kpi"><span>Total peserta</span><b>${t}</b><small>sesuai filter</small></div>
      <div class="kpi"><span>Disarankan</span><b>${pct(d.recommendations.disarankan || 0, t)}%</b><small>${d.recommendations.disarankan || 0} peserta</small></div>
      <div class="kpi"><span>Fit in position</span><b>${pct(d.fit.fit || 0, t)}%</b><small>${d.fit.fit || 0} peserta dengan gap 0–2</small></div>
      <div class="kpi"><span>Siap dikembangkan</span><b>${ready}</b><small>Talent Future + Growth</small></div>
    </div>
    <div class="grid cols-2">
      <div class="card">
        <h2>Matriks 9-box</h2>
        <p class="sub">Potensi (aspek di atas standar) terhadap kesesuaian jabatan (aspek di bawah standar). Klik kotak untuk melihat pesertanya.</p>
        ${nineBox(d.boxes, t, base)}
        ${legend()}
      </div>
      <div class="grid" style="align-content:start">
        <div class="card">
          <h2>Rekomendasi</h2>
          <div class="bars">${REC_ORDER.map((k) => {
            const n = d.recommendations[k] || 0;
            return `<a class="bar-row" href="${base}recommendation=${k}" style="text-decoration:none;color:inherit"><span>${RECOMMENDATIONS[k].name}</span><span class="track"><div style="width:${pct(n, t)}%;background:${REC_COLOR[k]}"></div></span><span class="val">${n}</span></a>`;
          }).join('')}</div>
        </div>
        <div class="card">
          <h2>Kesesuaian jabatan</h2>
          <div class="bars">${['fit', 'moderate', 'low'].map((k) => {
            const n = d.fit[k] || 0;
            return `<a class="bar-row" href="${base}fit=${k}" style="text-decoration:none;color:inherit"><span>${FIT[k].name}</span><span class="track"><div style="width:${pct(n, t)}%;background:#14213D"></div></span><span class="val">${pct(n, t)}%</span></a>`;
          }).join('')}</div>
        </div>
      </div>
    </div>
    <div class="card">
      <h2>Kebutuhan pengembangan</h2>
      <p class="sub">Jumlah peserta yang nilainya di bawah standar jabatan, per aspek. Aspek teratas adalah prioritas pelatihan.</p>
      <div class="bars">${sortedAspects
        .map(
          (a) =>
            `<div class="bar-row"><span>${esc(a.name)} <span class="muted small">· rata-rata ${a.average ?? '-'}</span></span><span class="track"><div style="width:${(a.below / maxBelow) * 100}%;background:#C2410C"></div></span><span class="val">${a.below} <span class="muted small">(${pct(a.below, t)}%)</span></span></div>`
        )
        .join('')}</div>
    </div>
    <div class="card"><h2>Per level jabatan</h2>${recTable(d.byStandard, 'Level')}</div>
    <div class="card"><h2>Per divisi</h2>${recTable(d.byDivision, 'Divisi')}</div>`
    }`;

  const apply = () => {
    const p = new URLSearchParams();
    const s = document.getElementById('fs').value;
    const dv = document.getElementById('fd').value;
    if (s) p.set('standard', s);
    if (dv) p.set('division', dv);
    go(`#/o/${S.org.id}${p.toString() ? '?' + p : ''}`);
  };
  document.getElementById('fs').addEventListener('change', apply);
  document.getElementById('fd').addEventListener('change', apply);
  const demo = document.getElementById('demo');
  if (demo)
    demo.addEventListener('click', async () => {
      demo.disabled = true;
      demo.textContent = 'Membuat data…';
      await api(`/api/org/${S.org.id}/demo`, { method: 'POST' });
      render();
    });
}

// ---------------- participants list ----------------

const CSV_COLS = [
  ['nik', 'NIK'],
  ['name', 'Nama'],
  ['gender', 'Jenis Kelamin'],
  ['age', 'Usia'],
  ['education', 'Pendidikan'],
  ['position', 'Jabatan'],
  ['division', 'Divisi'],
  ['location', 'Lokasi'],
  ['employment', 'Status Kerja'],
  ['standard_code', 'Standar'],
  ['assess_date', 'Tanggal Asesmen'],
  ['purpose', 'Tujuan'],
  ['target_position', 'Jabatan Tujuan'],
  ['iq', 'IQ'],
  ['disc', 'DISC'],
  ['leadership', 'Gaya Kepemimpinan'],
  ...ASPECTS.map((a, i) => [`a${i}`, a.name]),
  ['work_style', 'Gaya Kerja'],
  ['strengths', 'Area Potensi'],
  ['development', 'Area Pengembangan'],
  ['conclusion', 'Kesimpulan']
];

function normKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function csvEscape(v, sep) {
  const s = String(v ?? '');
  return /["\n\r]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename, rows, sep = ';') {
  const text = '﻿' + rows.map((r) => r.map((c) => csvEscape(c, sep)).join(sep)).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : firstLine.includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function toIsoDate(v) {
  const s = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
}

function scoreValue(v) {
  const s = String(v || '').trim().toUpperCase();
  const lvl = LEVELS.find((l) => l.code === s);
  if (lvl) return lvl.value;
  return Number(s.replace(',', '.'));
}

function csvToRows(text) {
  const table = parseCsv(text);
  if (table.length < 2) throw new Error('File kosong atau hanya berisi judul kolom');
  const header = table[0].map(normKey);
  const index = {};
  CSV_COLS.forEach(([key, label]) => {
    const i = header.indexOf(normKey(label));
    const j = header.indexOf(normKey(key));
    if (i !== -1) index[key] = i;
    else if (j !== -1) index[key] = j;
  });
  const missing = ['name', 'standard_code', ...ASPECTS.map((_, i) => `a${i}`)].filter((k) => index[k] === undefined);
  if (missing.length) {
    const labels = missing.map((k) => CSV_COLS.find((c) => c[0] === k)[1]);
    throw new Error(`Kolom wajib tidak ditemukan: ${labels.join(', ')}. Gunakan templat CSV.`);
  }
  return table.slice(1).map((r) => {
    const get = (k) => (index[k] === undefined ? '' : (r[index[k]] || '').trim());
    const out = {};
    for (const [key] of CSV_COLS) if (!/^a\d+$/.test(key)) out[key] = get(key);
    out.assess_date = toIsoDate(out.assess_date);
    out.scores = ASPECTS.map((_, i) => scoreValue(get(`a${i}`)));
    const lead = LEADERSHIP_STYLES.find((l) => normKey(l.key) === normKey(out.leadership));
    out.leadership = lead ? lead.key : '';
    return out;
  });
}

async function viewList(params) {
  const main = shell('peserta', loading());
  const filterKeys = ['q', 'standard', 'division', 'box', 'recommendation', 'fit', 'potential'];
  const q = new URLSearchParams();
  for (const k of filterKeys) if (params.get(k)) q.set(k, params.get(k));
  const [{ assessments }, dash] = await Promise.all([
    api(`/api/org/${S.org.id}/assessments?${q}`),
    api(`/api/org/${S.org.id}/dashboard`)
  ]);
  const showImport = params.get('impor') === '1';
  const activeExtra = ['box', 'recommendation', 'fit', 'potential'].filter((k) => params.get(k));

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Peserta</h1><p>${assessments.length} hasil asesmen${q.toString() ? ' sesuai filter' : ''}</p></div>
      <div class="actions">
        <button class="btn btn-outline" id="exp" type="button">${icon(IC.download)}Unduh CSV</button>
        ${can('assessor') ? `<a class="btn btn-outline" href="#/o/${S.org.id}/peserta?impor=1">${icon(IC.upload)}Impor CSV</a><a class="btn btn-primary" href="#/o/${S.org.id}/peserta/baru">${icon(IC.plus)}Tambah peserta</a>` : ''}
      </div>
    </div>
    ${showImport && can('assessor') ? importPanel() : ''}
    <form class="filters" id="flt">
      <div class="field grow"><label for="fq">Cari</label><input class="input" id="fq" placeholder="Nama, NIK, atau jabatan" value="${esc(params.get('q') || '')}"></div>
      <div class="field"><label for="fs">Level</label><select class="input" id="fs">${standardOptions(params.get('standard'), true)}</select></div>
      <div class="field"><label for="fd">Divisi</label><select class="input" id="fd"><option value="">Semua divisi</option>${dash.divisions
        .map((x) => `<option ${x === params.get('division') ? 'selected' : ''}>${esc(x)}</option>`)
        .join('')}</select></div>
      <div class="field"><label for="fr">Rekomendasi</label><select class="input" id="fr"><option value="">Semua</option>${REC_ORDER.map(
        (k) => `<option value="${k}" ${k === params.get('recommendation') ? 'selected' : ''}>${RECOMMENDATIONS[k].name}</option>`
      ).join('')}</select></div>
      <div class="field"><label for="fb">Posisi 9-box</label><select class="input" id="fb"><option value="">Semua</option>${Object.values(BOXES)
        .map((b) => `<option value="${b.key}" ${b.key === params.get('box') ? 'selected' : ''}>${esc(b.name)}</option>`)
        .join('')}</select></div>
    </form>
    ${activeExtra.includes('fit') || activeExtra.includes('potential') ? `<p class="small">Filter aktif: ${params.get('fit') ? FIT[params.get('fit')]?.name : ''} ${params.get('potential') ? POTENTIAL[params.get('potential')]?.name : ''} · <a href="#/o/${S.org.id}/peserta">Hapus filter</a></p>` : ''}
    ${
      assessments.length
        ? `<div class="table-wrap"><table>
      <thead><tr><th>Nama</th><th>Jabatan</th><th>Divisi</th><th>Level</th><th class="num" title="Aspek di bawah / sama dengan / di atas standar">Gap · Match · Talent</th><th>Posisi 9-box</th><th>Rekomendasi</th><th><span class="sr-only">Aksi</span></th></tr></thead>
      <tbody>${assessments
        .map(
          (a) => `<tr>
          <td><a class="nm" href="#/o/${S.org.id}/peserta/${a.id}">${esc(a.name)}</a><div class="small muted">${esc(a.nik || '')}</div></td>
          <td>${esc(a.position || '')}</td>
          <td>${esc(a.division || '')}</td>
          <td>${esc(a.standard_code)}</td>
          <td class="num">${a.gap} · ${a.match_count} · ${a.talent}</td>
          <td>${boxChip(a.box)}</td>
          <td>${recChip(a.final_recommendation)}</td>
          <td style="white-space:nowrap"><a href="#/o/${S.org.id}/peserta/${a.id}">Psikogram</a>${can('assessor') ? ` · <a href="#/o/${S.org.id}/peserta/${a.id}/edit">Ubah</a>` : ''}</td>
        </tr>`
        )
        .join('')}</tbody></table></div>`
        : `<div class="card"><p class="muted">Tidak ada peserta${q.toString() ? ' yang sesuai filter' : ' yang tercatat'}.</p></div>`
    }
    ${
      can('admin') && assessments.length && !q.toString()
        ? `<p class="small muted">Butuh mulai dari awal? <button type="button" class="link danger" id="clear">Hapus semua data peserta</button></p>`
        : ''
    }`;

  const apply = () => {
    if (!document.getElementById('fq')) return; // the page changed before a delayed search fired
    const p = new URLSearchParams();
    const vals = { q: 'fq', standard: 'fs', division: 'fd', recommendation: 'fr', box: 'fb' };
    for (const [k, id] of Object.entries(vals)) {
      const v = document.getElementById(id).value.trim();
      if (v) p.set(k, v);
    }
    for (const k of ['fit', 'potential']) if (params.get(k)) p.set(k, params.get(k));
    go(`#/o/${S.org.id}/peserta${p.toString() ? '?' + p : ''}`);
  };
  for (const id of ['fs', 'fd', 'fr', 'fb']) document.getElementById(id).addEventListener('change', apply);
  document.getElementById('flt').addEventListener('submit', (e) => {
    e.preventDefault();
    apply();
  });
  let timer;
  document.getElementById('fq').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(apply, 500);
  });

  document.getElementById('exp').addEventListener('click', () => {
    const header = [...CSV_COLS.slice(0, 16).map((c) => c[1]), ...ASPECTS.map((a) => a.name), 'Gap', 'Match', 'Talent', 'Kesesuaian', 'Potensi', 'Posisi 9-box', 'Rekomendasi'];
    const rows = assessments.map((a) => [
      a.nik, a.name, '', '', '', a.position, a.division, a.location, '', a.standard_code, a.assess_date, a.purpose, a.target_position, a.iq ?? '', a.disc, a.leadership,
      ...a.scores, a.gap, a.match_count, a.talent, FIT[a.fit]?.name, POTENTIAL[a.potential]?.name, boxByKey(a.box)?.name, RECOMMENDATIONS[a.final_recommendation]?.name
    ]);
    downloadCsv(`peserta-${S.org.name.replace(/\W+/g, '-').toLowerCase()}.csv`, [header, ...rows]);
  });

  const clear = document.getElementById('clear');
  if (clear)
    clear.addEventListener('click', async () => {
      if (!confirm('Hapus SEMUA data peserta organisasi ini? Tindakan ini tidak bisa dibatalkan.')) return;
      await api(`/api/org/${S.org.id}/assessments`, { method: 'DELETE' });
      render();
    });

  if (showImport && can('assessor')) bindImport();
}

function importPanel() {
  return `<div class="card" id="imp">
    <h2>Impor dari CSV</h2>
    <p class="sub">Isi templat di Excel, simpan sebagai CSV, lalu unggah di sini. Nilai aspek boleh angka 1–5 atau kode KS, K, C, B, BS. Kolom "Standar" diisi kode level, misalnya ${esc(S.standards.map((s) => s.code).join(', '))}.</p>
    <div class="actions">
      <button class="btn btn-outline" type="button" id="tpl">${icon(IC.download)}Unduh templat</button>
      <label class="btn btn-outline" for="file">${icon(IC.upload)}Pilih file CSV</label>
      <input type="file" id="file" accept=".csv,text/csv" class="sr-only">
      <a class="btn btn-outline" href="#/o/${S.org.id}/peserta">Tutup</a>
    </div>
    <div id="impMsg"></div>
  </div>`;
}

function bindImport() {
  document.getElementById('tpl').addEventListener('click', () => {
    const s = S.standards[0] || { code: 'L3', scores: ASPECTS.map(() => 3) };
    const sample = {
      nik: '10001', name: 'Contoh Nama', gender: 'Perempuan', age: '30', education: 'S1', position: 'Analis', division: 'Keuangan',
      location: 'Kantor Pusat', employment: 'PKWTT', standard_code: s.code, assess_date: new Date().toISOString().slice(0, 10),
      purpose: 'Talent Assessment', target_position: '', iq: '105', disc: 'S-C', leadership: 'Developer',
      work_style: '', strengths: '', development: '', conclusion: ''
    };
    const row = CSV_COLS.map(([k]) => (/^a(\d+)$/.test(k) ? s.scores[Number(k.slice(1))] : sample[k] ?? ''));
    downloadCsv('templat-peserta.csv', [CSV_COLS.map((c) => c[1]), row]);
  });
  document.getElementById('file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const msg = document.getElementById('impMsg');
    if (!file) return;
    let rows;
    try {
      rows = csvToRows(await file.text());
    } catch (err) {
      msg.innerHTML = `<div class="error">${esc(err.message)}</div>`;
      return;
    }
    msg.innerHTML = `<div class="notice">${rows.length} baris terbaca dari ${esc(file.name)}.</div>
      <div class="actions"><button class="btn btn-primary" type="button" id="doImp">Impor ${rows.length} peserta</button></div>`;
    document.getElementById('doImp').addEventListener('click', async (ev) => {
      ev.currentTarget.disabled = true;
      try {
        const r = await api(`/api/org/${S.org.id}/assessments/import`, { method: 'POST', body: { rows } });
        msg.innerHTML = `<div class="notice">${r.created} peserta berhasil diimpor.</div>`;
        setTimeout(() => go(`#/o/${S.org.id}/peserta`), 900);
      } catch (err) {
        const errs = err.data && err.data.errors;
        if (errs && errs.length) {
          msg.innerHTML = `<div class="error"><b>${errs.length} baris bermasalah, tidak ada yang diimpor.</b><ul style="margin:6px 0 0;padding-left:18px">${errs
            .slice(0, 12)
            .map((x) => `<li>Baris ${x.row + 1}: ${esc(x.error)}</li>`)
            .join('')}</ul>${errs.length > 12 ? `<p>…dan ${errs.length - 12} lainnya.</p>` : ''}</div>
            <div class="actions"><button class="btn btn-outline" type="button" id="skip">Impor hanya ${rows.length - errs.length} baris yang valid</button></div>`;
          const skip = document.getElementById('skip');
          if (skip)
            skip.addEventListener('click', async () => {
              const r = await api(`/api/org/${S.org.id}/assessments/import`, { method: 'POST', body: { rows, skipInvalid: true } });
              msg.innerHTML = `<div class="notice">${r.created} peserta berhasil diimpor.</div>`;
              setTimeout(() => go(`#/o/${S.org.id}/peserta`), 900);
            });
        } else msg.innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    });
  });
}

// ---------------- assessment form ----------------

function autoNarrative(scores, required) {
  const above = [];
  const below = [];
  ASPECTS.forEach((a, i) => {
    if (scores[i] > required[i]) above.push(a);
    else if (scores[i] < required[i]) below.push(a);
  });
  return {
    strengths: above.length ? above.map((a) => a.high).join('; ') + '.' : '',
    development: below.length ? below.map((a) => a.low.charAt(0).toLowerCase() + a.low.slice(1)).map((t) => `Masih ${t}`).join('; ') + '.' : ''
  };
}

function defaultConclusion(recKey, hasDev) {
  const r = RECOMMENDATIONS[recKey];
  return `Berdasarkan hasil asesmen dan dengan mempertimbangkan potensi yang dimiliki, yang bersangkutan dinyatakan ${r.name.toUpperCase()}${
    hasDev ? ' dengan tetap memperhatikan area pengembangan yang telah diuraikan' : ''
  }.`;
}

async function viewForm(id, params) {
  const main = shell('peserta', loading());
  const fromPid = params ? params.get('dari') : null;
  let suggestions = [];
  let a = {
    standard_code: S.standards[0]?.code || '',
    scores: ASPECTS.map(() => 0),
    assess_date: new Date().toISOString().slice(0, 10),
    purpose: 'Talent Assessment',
    final_recommendation: ''
  };
  if (id) {
    a = (await api(`/api/org/${S.org.id}/assessments/${id}`)).assessment;
    if (a.final_recommendation === a.recommendation) a.final_recommendation = '';
  } else if (fromPid) {
    const { participant: p } = await api(`/api/org/${S.org.id}/participants/${fromPid}`);
    suggestions = p.suggestions || [];
    a = {
      ...a,
      name: p.name,
      nik: p.nik,
      position: p.position,
      division: p.division,
      purpose: p.purpose || a.purpose,
      standard_code: S.standards.some((s) => s.code === p.standard_code) ? p.standard_code : a.standard_code,
      disc: p.results?.disc ? p.results.disc.code : '',
      work_style: p.results?.disc ? `${p.results.disc.code} – ${DISC_FACTORS[p.results.disc.primary].descId}` : '',
      scores: ASPECTS.map((_, i) => (suggestions[i] ? suggestions[i].value : 0))
    };
  }
  if (!S.standards.length) {
    main.innerHTML = `<div class="card"><h2>Belum ada standar jabatan</h2><p class="muted">Buat minimal satu standar jabatan sebelum menambah peserta.</p><a class="btn btn-primary" href="#/o/${S.org.id}/standar">Buka Standar Jabatan</a></div>`;
    return;
  }
  const scores = [...a.scores];

  const text = (k, label, opts = {}) =>
    `<div class="field"><label for="f_${k}">${label}</label><input class="input" id="f_${k}" name="${k}" value="${esc(a[k] ?? '')}" ${opts.type ? `type="${opts.type}"` : ''} ${opts.max ? `maxlength="${opts.max}"` : ''} ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''} ${opts.req ? 'required' : ''}></div>`;
  const area = (k, label, hint = '') =>
    `<div class="field"><label for="f_${k}">${label}</label>${hint ? `<span class="hint">${hint}</span>` : ''}<textarea class="input" id="f_${k}" name="${k}" maxlength="3000">${esc(a[k] ?? '')}</textarea></div>`;

  main.innerHTML = `
    <div class="page-head">
      <div><h1>${id ? 'Ubah asesmen' : 'Tambah peserta'}</h1><p>${
        id ? esc(a.name) : fromPid ? 'Nilai dari tes online sudah diisi sebagai saran. Periksa, lalu lengkapi aspek yang bertanda "perlu penilaian".' : 'Isi identitas, nilai 18 aspek, dan interpretasi psikolog.'
      }</p></div>
      <div class="actions"><a class="btn btn-outline" href="${id ? `#/o/${S.org.id}/peserta/${id}` : `#/o/${S.org.id}/peserta`}">${icon(IC.back)}Batal</a></div>
    </div>
    <form id="af" class="form-layout" novalidate>
      <div class="form-main">
        <div class="card">
          <h2>Identitas</h2>
          <div class="grid cols-form">
            ${text('name', 'Nama lengkap', { req: true, max: 120 })}
            ${text('nik', 'NIK', { max: 40 })}
            <div class="field"><label for="f_gender">Jenis kelamin</label><select class="input" id="f_gender" name="gender"><option value=""></option>${['Laki-laki', 'Perempuan']
              .map((g) => `<option ${a.gender === g ? 'selected' : ''}>${g}</option>`)
              .join('')}</select></div>
            ${text('age', 'Usia', { type: 'number', max: 3 })}
            ${text('education', 'Pendidikan', { max: 40, ph: 'mis. S1' })}
            ${text('position', 'Jabatan saat ini', { max: 160 })}
            ${text('division', 'Divisi', { max: 120 })}
            ${text('location', 'Lokasi kerja', { max: 120 })}
            ${text('employment', 'Status kerja', { max: 40, ph: 'mis. PKWTT' })}
          </div>
        </div>
        <div class="card">
          <h2>Asesmen</h2>
          <div class="grid cols-form">
            <div class="field"><label for="f_standard_code">Standar jabatan</label><select class="input" id="f_standard_code" name="standard_code" required>${standardOptions(a.standard_code)}</select></div>
            ${text('assess_date', 'Tanggal asesmen', { type: 'date' })}
            <div class="field"><label for="f_purpose">Tujuan</label><input class="input" id="f_purpose" name="purpose" list="purposes" value="${esc(a.purpose ?? '')}" maxlength="120"><datalist id="purposes">${PURPOSES.map((p) => `<option value="${p}">`).join('')}</datalist></div>
            ${text('target_position', 'Jabatan tujuan', { max: 160, ph: 'untuk promosi/rotasi' })}
          </div>
        </div>
        <div class="card">
          <h2>Hasil tes pendukung</h2>
          <div class="grid cols-form">
            <div class="field"><label for="f_iq">IQ</label><input class="input" id="f_iq" name="iq" type="number" min="40" max="200" value="${esc(a.iq ?? '')}"><span class="hint" id="iqcat">${esc(iqCategory(a.iq))}</span></div>
            ${text('disc', 'Kode DISC', { max: 20, ph: 'mis. S-C' })}
            <div class="field"><label for="f_leadership">Gaya kepemimpinan</label><select class="input" id="f_leadership" name="leadership"><option value=""></option>${LEADERSHIP_STYLES.map(
              (l) => `<option ${a.leadership === l.key ? 'selected' : ''}>${l.key}</option>`
            ).join('')}</select><span class="hint" id="leaddesc">${esc(LEADERSHIP_STYLES.find((l) => l.key === a.leadership)?.desc || '')}</span></div>
          </div>
        </div>
        <div class="card">
          <h2>Aspek psikologi</h2>
          <p class="sub">Pilih nilai 1–5 (KS, K, C, B, BS). Sel abu-abu adalah standar untuk level jabatan yang dipilih.</p>
          <div class="table-wrap"><table class="score-table">
            <thead><tr><th>Aspek</th><th>Nilai</th><th class="num">Standar</th><th class="num">Selisih</th></tr></thead>
            <tbody id="scoreBody"></tbody>
          </table></div>
        </div>
        <div class="card">
          <div class="page-head"><h2>Interpretasi psikolog</h2><button type="button" class="btn btn-outline" id="autofill">Isi otomatis dari nilai</button></div>
          ${area('work_style', 'Gaya kerja', 'Deskripsi berdasarkan profil DISC')}
          <div class="grid cols-2">${area('strengths', 'Area potensi')}${area('development', 'Area pengembangan')}</div>
          ${area('conclusion', 'Kesimpulan', 'Kosongkan untuk memakai kalimat standar sesuai rekomendasi')}
          ${area('notes', 'Catatan internal', 'Tidak dicetak di psikogram')}
        </div>
      </div>
      <aside class="form-side">
        <div class="card" aria-live="polite">
          <h2>Hasil otomatis</h2>
          <div id="live"></div>
        </div>
        <div class="card">
          <div class="field"><label for="f_final">Rekomendasi akhir</label>
            <select class="input" id="f_final" name="final_recommendation"><option value="">Ikuti hasil otomatis</option>${REC_ORDER.map(
              (k) => `<option value="${k}" ${a.final_recommendation === k ? 'selected' : ''}>${RECOMMENDATIONS[k].name}</option>`
            ).join('')}</select>
            <span class="hint">Ubah hanya bila psikolog memutuskan berbeda dari hasil matriks.</span></div>
          <div id="err"></div>
          <button class="btn btn-primary btn-lg" type="submit">Simpan</button>
        </div>
      </aside>
    </form>`;

  const form = document.getElementById('af');
  const stdSel = form.standard_code;
  const required = () => (S.standards.find((s) => s.code === stdSel.value) || S.standards[0]).scores;

  const drawScores = () => {
    const req = required();
    let html = '';
    for (const g of GROUPS) {
      html += `<tr class="group-row"><td colspan="4">${g.name}</td></tr>`;
      ASPECTS.forEach((asp, i) => {
        if (asp.group !== g.key) return;
        const v = scores[i];
        const d = v ? v - req[i] : null;
        html += `<tr>
          <td><b>${esc(asp.name)}</b>${
            suggestions[i]
              ? ` <span class="chip ${suggestions[i].strength === 'tes' ? 'rec-disarankan' : 'rec-catatan'}" title="${esc(suggestions[i].source)}">saran ${suggestions[i].strength}: ${LEVELS[suggestions[i].value - 1].code}</span>`
              : fromPid ? ' <span class="chip chip-plain">perlu penilaian</span>' : ''
          }<div class="small muted">${esc(asp.high)}</div></td>
          <td><div class="seg" role="radiogroup" aria-label="${esc(asp.name)}">${LEVELS.map(
            (l) =>
              `<button type="button" role="radio" data-i="${i}" data-v="${l.value}" aria-checked="${v === l.value}" class="${req[i] === l.value ? 'req' : ''}" title="${l.name}">${l.code}</button>`
          ).join('')}</div></td>
          <td class="num">${LEVELS[req[i] - 1].code}</td>
          <td class="num">${d === null ? '<span class="muted">–</span>' : `<span class="diff ${d > 0 ? 'up' : d < 0 ? 'down' : 'eq'}">${d > 0 ? '▲ +' + d : d < 0 ? '▼ ' + d : '='}</span>`}</td>
        </tr>`;
      });
    }
    document.getElementById('scoreBody').innerHTML = html;
  };

  const drawLive = () => {
    const filled = scores.filter((s) => s >= 1).length;
    const live = document.getElementById('live');
    if (filled < ASPECTS.length) {
      live.innerHTML = `<p class="muted">${filled} dari ${ASPECTS.length} aspek terisi. Hasil muncul setelah semua aspek dinilai.</p><div class="ninebox-wrap">${nineBox(null, 0, null, null)}</div>`;
      return;
    }
    const r = evaluate(scores, required());
    const box = boxByKey(r.box);
    live.innerHTML = `<div class="result-big"><div><b>${r.gap}</b><span>Gap</span></div><div><b>${r.match}</b><span>Match</span></div><div><b>${r.talent}</b><span>Talent</span></div></div>
      <dl class="kv"><dt>Kesesuaian</dt><dd>${FIT[r.fit].name}</dd><dt>Potensi</dt><dd>${POTENTIAL[r.potential].name}</dd><dt>Posisi 9-box</dt><dd>${esc(box.name)}</dd></dl>
      ${nineBox(null, 0, null, r.box)}
      <div>Rekomendasi otomatis: ${recChip(r.recommendation)}</div>`;
  };

  drawScores();
  drawLive();

  document.getElementById('scoreBody').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    scores[Number(b.dataset.i)] = Number(b.dataset.v);
    drawScores();
    drawLive();
    const next = document.querySelector(`button[data-i="${Number(b.dataset.i) + 1}"]`);
    if (next && !scores[Number(b.dataset.i) + 1]) next.focus({ preventScroll: true });
  });
  stdSel.addEventListener('change', () => {
    drawScores();
    drawLive();
  });
  form.iq.addEventListener('input', () => (document.getElementById('iqcat').textContent = iqCategory(form.iq.value)));
  form.leadership.addEventListener('change', () => (document.getElementById('leaddesc').textContent = LEADERSHIP_STYLES.find((l) => l.key === form.leadership.value)?.desc || ''));
  document.getElementById('autofill').addEventListener('click', () => {
    if (scores.some((s) => !s)) {
      document.getElementById('err').innerHTML = '<div class="error">Lengkapi nilai semua aspek terlebih dulu.</div>';
      return;
    }
    const n = autoNarrative(scores, required());
    if (!form.strengths.value.trim() || confirm('Ganti isi Area potensi dan Area pengembangan dengan teks otomatis?')) {
      form.strengths.value = n.strengths;
      form.development.value = n.development;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = document.getElementById('err');
    err.innerHTML = '';
    if (!form.name.value.trim()) {
      err.innerHTML = '<div class="error">Nama peserta wajib diisi.</div>';
      form.name.focus();
      return;
    }
    if (scores.some((s) => !s)) {
      err.innerHTML = '<div class="error">Nilai 18 aspek harus lengkap.</div>';
      return;
    }
    const body = { scores };
    for (const el of form.elements) if (el.name) body[el.name] = el.value;
    if (fromPid) body.participant_id = fromPid;
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const r = id
        ? await api(`/api/org/${S.org.id}/assessments/${id}`, { method: 'PUT', body })
        : await api(`/api/org/${S.org.id}/assessments`, { method: 'POST', body });
      go(`#/o/${S.org.id}/peserta/${r.id}`);
    } catch (ex) {
      err.innerHTML = `<div class="error">${esc(ex.message)}</div>`;
      btn.disabled = false;
    }
  });
}

// ---------------- psikogram ----------------

function fmtDate(iso) {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${d} ${months[m - 1]} ${y}`;
}

async function viewReport(id) {
  const main = shell('peserta', loading());
  const { assessment: a } = await api(`/api/org/${S.org.id}/assessments/${id}`);
  const st = S.org.settings || {};
  const box = boxByKey(a.box);
  const lead = LEADERSHIP_STYLES.find((l) => l.key === a.leadership);
  const conclusion = a.conclusion || defaultConclusion(a.final_recommendation, !!(a.development || '').trim());
  const std = S.standards.find((s) => s.code === a.standard_code);
  const groupRows = GROUPS.map((g) => {
    const rows = ASPECTS.map((asp, i) => ({ asp, i }))
      .filter((x) => x.asp.group === g.key)
      .map(
        ({ asp, i }) => `<tr>
          <td><b>${esc(asp.name)}</b></td>
          <td class="low">${esc(asp.low)}</td>
          ${LEVELS.map((l) => `<td class="mark ${a.standard_scores[i] === l.value ? 'std' : ''}">${a.scores[i] === l.value ? '✕' : ''}</td>`).join('')}
          <td class="high">${esc(asp.high)}</td>
        </tr>`
      )
      .join('');
    return `<tr class="grp"><td colspan="8">${g.name}</td></tr>${rows}`;
  }).join('');

  const mini = BOX_ORDER.flat()
    .map((pos) => `<div class="${BOXES[pos].key === a.box ? 'here' : ''}">${esc(BOXES[pos].name.replace(' Employee', ''))}</div>`)
    .join('');

  main.innerHTML = `
    <div class="report-bar no-print">
      <a class="btn btn-outline" href="#/o/${S.org.id}/peserta">${icon(IC.back)}Daftar peserta</a>
      <div class="actions">
        ${can('assessor') ? `<a class="btn btn-outline" href="#/o/${S.org.id}/peserta/${id}/edit">Ubah</a>` : ''}
        ${can('admin') ? '<button class="btn btn-danger" type="button" id="del">Hapus</button>' : ''}
        <button class="btn btn-primary" type="button" id="print">${icon(IC.print)}Cetak / Simpan PDF</button>
      </div>
    </div>
    ${!st.psychologist_name && can('admin') ? `<div class="notice no-print">Nama dan SIPP psikolog belum diisi. Lengkapi di <a href="#/o/${S.org.id}/pengaturan">Pengaturan</a> agar tercetak di kolom tanda tangan.</div>` : ''}
    <article class="paper">
      <div class="conf">PRIBADI DAN RAHASIA</div>
      <div class="rhead"><h1>HASIL PEMERIKSAAN PSIKOLOGIS</h1><div class="org">${esc(S.org.name)}</div></div>

      <div class="ident">
        <div><span>Nama</span><b>${esc(a.name)}</b></div>
        <div><span>Tanggal tes</span><b>${fmtDate(a.assess_date)}</b></div>
        <div><span>NIK</span><b>${esc(a.nik || '-')}</b></div>
        <div><span>Tujuan tes</span><b>${esc(a.purpose || '-')}</b></div>
        <div><span>Usia / J. kelamin</span><b>${a.age ? a.age + ' tahun' : '-'} / ${esc(a.gender || '-')}</b></div>
        <div><span>Jabatan tujuan</span><b>${esc(a.target_position || '-')}</b></div>
        <div><span>Jabatan</span><b>${esc(a.position || '-')}</b></div>
        <div><span>Standar jabatan</span><b>${esc(a.standard_code)}${std ? ' – ' + esc(std.name) : ''}</b></div>
        <div><span>Divisi / Lokasi</span><b>${esc(a.division || '-')} / ${esc(a.location || '-')}</b></div>
        <div><span>Pendidikan</span><b>${esc(a.education || '-')}</b></div>
      </div>

      <h3>Intelegensi umum</h3>
      <div class="stats"><span>IQ: <b>${a.iq ?? '-'}</b></span><span>Kategori: <b>${esc(iqCategory(a.iq) || '-')}</b></span><span>DISC: <b>${esc(a.disc || '-')}</b></span></div>

      ${
        a.kraepelin
          ? `<h3>Sikap kerja (Kraepelin)</h3><div class="stats">${['speed', 'accuracy', 'consistency', 'endurance']
              .map((k) => `<span>${INDEX_NAMES[k]}: <b>${LEVEL_ID[a.kraepelin.levels[k]]}</b></span>`)
              .join('')}<span class="small">(${a.kraepelin.speed} jawaban/kolom, ${a.kraepelin.errorRate}% salah)</span></div>`
          : ''
      }
      <h3>Psikogram</h3>
      <table>
        <thead><tr><th style="text-align:left">Aspek psikologi</th><th>Skor rendah</th>${LEVELS.map((l) => `<th>${l.code}</th>`).join('')}<th>Skor tinggi</th></tr></thead>
        <tbody>${groupRows}</tbody>
      </table>
      <div class="stats">
        <span>✕ = hasil peserta · sel abu-abu = standar jabatan</span>
        <span>Di bawah standar: <b>${a.gap}</b></span><span>Sesuai: <b>${a.match_count}</b></span><span>Di atas standar: <b>${a.talent}</b></span>
        <span>Kategori: <b>${FIT[a.fit].category}</b></span>
      </div>

      <div class="two">
        <div>
          <h3>Posisi talenta</h3>
          <div class="mini9">${mini}</div>
          <div class="stats"><span>Potensi: <b>${POTENTIAL[a.potential].name}</b></span><span>Kesesuaian: <b>${FIT[a.fit].name}</b></span><span>Posisi: <b>${esc(box.name)}</b></span></div>
        </div>
        <div>
          <h3>Gaya kepemimpinan</h3>
          <div class="box"><b>${esc(a.leadership || '-')}</b>${lead ? '\n' + esc(lead.desc) : ''}</div>
        </div>
      </div>

      ${a.work_style ? `<h3>Gaya kerja</h3><div class="box">${esc(a.work_style)}</div>` : ''}
      <h3>Dinamika psikologi</h3>
      <div class="two">
        <div><b style="font-size:9pt">Area potensi</b><div class="box">${esc(a.strengths || '-')}</div></div>
        <div><b style="font-size:9pt">Area pengembangan</b><div class="box">${esc(a.development || '-')}</div></div>
      </div>

      <h3>Kesimpulan</h3>
      <div class="box">${esc(conclusion)}</div>

      <h3>Rekomendasi</h3>
      <div class="recs">${REC_ORDER.map((k) => `<div class="${a.final_recommendation === k ? 'on' : ''}">${RECOMMENDATIONS[k].name.toUpperCase()}</div>`).join('')}</div>

      <div class="sign">
        <div>Disusun oleh,<div class="sp"></div><b>${esc(st.psychologist_name || 'Psikolog')}</b>${st.psychologist_sipp ? `SIPP ${esc(st.psychologist_sipp)}` : 'SIPP …………'}</div>
        <div>Divalidasi oleh,<div class="sp"></div><b>${esc(st.validator_name || '……………………')}</b>${esc(st.validator_title || '')}</div>
        <div>Diketahui,<div class="sp"></div><b>${esc(st.approver_name || '……………………')}</b>${esc(st.approver_title || '')}</div>
      </div>
      <div class="foot">${esc(st.report_note || 'Uraian ini hanya berlaku apabila ditandatangani oleh psikolog. Hasil asesmen berlaku 2 (dua) tahun sejak tanggal tes.')}</div>
    </article>`;

  document.getElementById('print').addEventListener('click', () => {
    const old = document.title;
    document.title = `Psikogram - ${a.name}`;
    window.print();
    document.title = old;
  });
  const del = document.getElementById('del');
  if (del)
    del.addEventListener('click', async () => {
      if (!confirm(`Hapus data asesmen ${a.name}?`)) return;
      await api(`/api/org/${S.org.id}/assessments/${id}`, { method: 'DELETE' });
      go(`#/o/${S.org.id}/peserta`);
    });
}

// ---------------- invites & online test results ----------------

const TEST_NAMES = { kraepelin: 'Kraepelin', bigfive: 'Big Five', disc: 'DISC', type16: '16 Tipe' };
const LEVEL_ID = ['', 'Sangat rendah', 'Rendah', 'Sedang', 'Tinggi', 'Sangat tinggi'];

function inviteLink(code) {
  return `${location.origin}/app/#/join/${code}`;
}

function statusChips(tests) {
  return Object.entries(tests)
    .map(([t, at]) => `<span class="chip ${at ? 'rec-disarankan' : 'chip-plain'}" title="${at ? 'Selesai ' + esc(at.slice(0, 10)) : 'Belum dikerjakan'}">${TEST_NAMES[t] || t} ${at ? '✓' : '·'}</span>`)
    .join(' ');
}

async function viewInvites(params) {
  const main = shell('undangan', loading());
  const inviteFilter = params.get('gelombang') || '';
  const emailFor = params.get('email') || '';
  const [{ invites }, { participants }] = await Promise.all([
    api(`/api/org/${S.org.id}/invites`),
    api(`/api/org/${S.org.id}/participants${inviteFilter ? `?invite=${encodeURIComponent(inviteFilter)}` : ''}`)
  ]);
  const editor = can('assessor');

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Undangan &amp; tes online</h1><p>Kirim tautan agar karyawan mengerjakan psikotes online. Hasilnya muncul di sini sebagai saran nilai.</p></div>
    </div>
    ${
      editor
        ? `<form class="card" id="invf">
      <h2>Buat tautan undangan</h2>
      <div class="grid cols-form">
        <div class="field"><label for="iname">Nama gelombang asesmen</label><input class="input" id="iname" required maxlength="120" placeholder="mis. Asesmen Promosi November 2026"></div>
        <div class="field"><label for="istd">Standar jabatan</label><select class="input" id="istd">${standardOptions('', false)}</select><span class="hint">Dipakai sebagai standar awal saat membuat asesmen.</span></div>
        <div class="field"><label for="ipur">Tujuan</label><input class="input" id="ipur" list="purposes2" value="Talent Assessment" maxlength="120"><datalist id="purposes2">${PURPOSES.map((p) => `<option value="${p}">`).join('')}</datalist></div>
      </div>
      <fieldset style="border:0;padding:0;margin:0" class="field"><legend style="font-size:13px;font-weight:600;margin-bottom:6px">Tes yang dikerjakan</legend>
        <div class="actions">
          <label class="chip chip-plain" style="padding:8px 12px"><input type="checkbox" name="t" value="kraepelin" checked> Kraepelin (±12 menit)</label>
          <label class="chip chip-plain" style="padding:8px 12px"><input type="checkbox" name="t" value="bigfive" checked> Big Five (±10 menit)</label>
          <label class="chip chip-plain" style="padding:8px 12px"><input type="checkbox" name="t" value="disc" checked> DISC (±8 menit)</label>
          <label class="chip chip-plain" style="padding:8px 12px"><input type="checkbox" name="t" value="type16"> 16 Tipe (±8 menit)</label>
        </div>
      </fieldset>
      <div id="ierr"></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Buat tautan</button></div>
    </form>`
        : ''
    }
    ${emailFor && editor ? '<div id="emailPanel"></div>' : ''}
    <div class="card">
      <h2>Gelombang asesmen</h2>
      ${
        invites.length
          ? `<div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Tautan</th><th>Tes</th><th class="num">Peserta</th><th>Status</th><th><span class="sr-only">Aksi</span></th></tr></thead>
        <tbody>${invites
          .map(
            (i) => `<tr>
            <td class="nm">${esc(i.name)}<div class="small muted">${esc(i.standard_code || '')} ${i.purpose ? '· ' + esc(i.purpose) : ''}</div></td>
            <td><code style="font-size:12.5px">${esc(inviteLink(i.code))}</code><br><button class="link" type="button" data-copy="${esc(inviteLink(i.code))}">Salin tautan</button> <span class="small muted">· kode ${esc(i.code)}</span></td>
            <td>${i.tests.map((t) => TEST_NAMES[t] || t).join(', ')}</td>
            <td class="num"><a href="#/o/${S.org.id}/undangan?gelombang=${i.id}">${i.joined}</a></td>
            <td>${i.active ? '<span class="chip rec-disarankan">Aktif</span>' : '<span class="chip chip-plain">Ditutup</span>'}</td>
            <td style="white-space:nowrap">${
              editor
                ? `${i.active ? `<a href="#/o/${S.org.id}/undangan?email=${i.id}">Undang via email</a> · ` : ''}<button class="link" type="button" data-toggle="${i.id}" data-active="${i.active ? 0 : 1}">${i.active ? 'Tutup' : 'Buka lagi'}</button>`
                : ''
            }</td>
          </tr>`
          )
          .join('')}</tbody></table></div>`
          : '<p class="muted">Belum ada tautan undangan.</p>'
      }
    </div>
    <div class="card">
      <div class="page-head"><h2>Peserta tes online${inviteFilter ? ' · ' + esc(invites.find((i) => i.id === inviteFilter)?.name || '') : ''}</h2>
        <div class="actions">${inviteFilter ? `<a href="#/o/${S.org.id}/undangan">Tampilkan semua</a>` : ''}${
          participants.length ? `<button class="btn btn-outline" type="button" id="pexp">${icon(IC.download)}Unduh CSV</button>` : ''
        }</div></div>
      ${participants.length > 5 ? '<div class="field"><label for="psearch" class="sr-only">Cari peserta</label><input class="input" id="psearch" placeholder="Cari nama, NIK, email, jabatan, atau divisi"></div>' : ''}
      ${
        participants.length
          ? `<div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Jabatan / Divisi</th><th>Gelombang</th><th>Tes</th><th><span class="sr-only">Aksi</span></th></tr></thead>
        <tbody id="ptbody">${participants
          .map(
            (p) => `<tr data-search="${esc([p.name, p.email, p.nik, p.position, p.division].join(' ').toLowerCase())}">
            <td><a class="nm" href="#/o/${S.org.id}/undangan/p/${p.id}">${esc(p.name)}</a><div class="small muted">${esc(p.nik || p.email)}</div></td>
            <td>${esc(p.position || '-')}<div class="small muted">${esc(p.division || '')}</div></td>
            <td>${esc(p.invite_name)}</td>
            <td>${statusChips(p.tests)}${p.minor ? ` <span class="chip ${p.guardian_consent ? 'rec-disarankan' : 'rec-catatan'}" title="Peserta di bawah 18 tahun">Ortu ${p.guardian_consent ? '✓' : ': menunggu'}</span>` : ''}</td>
            <td style="white-space:nowrap">${
              p.assessment_id
                ? `<a href="#/o/${S.org.id}/peserta/${p.assessment_id}">Psikogram</a>`
                : `<a href="#/o/${S.org.id}/undangan/p/${p.id}">Lihat hasil</a>`
            }</td>
          </tr>`
          )
          .join('')}</tbody></table></div>`
          : '<p class="muted">Belum ada karyawan yang bergabung. Bagikan tautan undangan lewat email atau WhatsApp.</p>'
      }
    </div>`;

  if (emailFor && editor) await emailPanel(invites.find((i) => i.id === emailFor));
  const ps = document.getElementById('psearch');
  if (ps)
    ps.addEventListener('input', () => {
      const q = ps.value.trim().toLowerCase();
      document.querySelectorAll('#ptbody tr').forEach((tr) => (tr.hidden = q && !tr.dataset.search.includes(q)));
    });
  const pexp = document.getElementById('pexp');
  if (pexp)
    pexp.addEventListener('click', () => {
      const tests = ['kraepelin', 'bigfive', 'disc', 'type16'];
      const header = ['Nama', 'Email', 'NIK', 'Jabatan', 'Divisi', 'Gelombang', 'Bergabung', ...tests.map((t) => `${TEST_NAMES[t]} selesai`), 'Psikogram dibuat'];
      const rows = participants.map((p) => [
        p.name, p.email, p.nik, p.position, p.division, p.invite_name, p.joined_at.slice(0, 10),
        ...tests.map((t) => (t in p.tests ? (p.tests[t] ? p.tests[t].slice(0, 10) : 'belum') : '-')),
        p.assessment_id ? 'ya' : 'belum'
      ]);
      downloadCsv('peserta-tes-online.csv', [header, ...rows]);
    });
  main.querySelectorAll('[data-copy]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.copy);
        b.textContent = 'Tersalin';
      } catch {
        prompt('Salin tautan ini:', b.dataset.copy);
      }
    })
  );
  main.querySelectorAll('[data-toggle]').forEach((b) =>
    b.addEventListener('click', async () => {
      await api(`/api/org/${S.org.id}/invites/${b.dataset.toggle}`, { method: 'PUT', body: { active: b.dataset.active === '1' } });
      render();
    })
  );
  const f = document.getElementById('invf');
  if (f)
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tests = [...f.querySelectorAll('input[name=t]:checked')].map((x) => x.value);
      try {
        await api(`/api/org/${S.org.id}/invites`, {
          method: 'POST',
          body: { name: f.iname.value, standard_code: f.istd.value, purpose: f.ipur.value, tests }
        });
        render();
      } catch (err) {
        document.getElementById('ierr').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    });
}

const EMAIL_STATUS = { pending: ['Menunggu', 'chip-plain'], accepted: ['Diterima', 'rec-disarankan'], declined: ['Ditolak', 'rec-tidak'] };

async function emailPanel(inv) {
  const box = document.getElementById('emailPanel');
  if (!box || !inv) return;
  const { emails } = await api(`/api/org/${S.org.id}/invites/${inv.id}/emails`);
  box.innerHTML = `<form class="card" id="ef">
    <div class="page-head"><h2>Undang via email · ${esc(inv.name)}</h2><a href="#/o/${S.org.id}/undangan">Tutup</a></div>
    <p class="sub">Undangan muncul di aplikasi orang tersebut setelah ia masuk. Jika emailnya belum terdaftar, undangan menunggu sampai ia mendaftar dengan email yang sama. Aplikasi belum mengirim email otomatis, jadi kabari mereka juga lewat email atau WhatsApp dengan tautan: <code>${esc(inviteLink(inv.code))}</code></p>
    <div class="field"><label for="emails">Alamat email</label><textarea class="input" id="emails" placeholder="satu email per baris, atau pisahkan dengan koma" style="min-height:110px"></textarea></div>
    <div id="emsg"></div>
    <div class="actions"><button class="btn btn-primary" type="submit">Kirim undangan</button></div>
    ${
      emails.length
        ? `<div class="table-wrap"><table><thead><tr><th>Email</th><th>Akun</th><th>Status</th><th>Diundang</th></tr></thead><tbody>${emails
            .map(
              (e) => `<tr><td>${esc(e.email)}</td><td>${e.registered ? 'Terdaftar' : '<span class="muted">Belum daftar</span>'}</td><td><span class="chip ${EMAIL_STATUS[e.status][1]}">${EMAIL_STATUS[e.status][0]}</span></td><td>${esc(e.created_at.slice(0, 10))}</td></tr>`
            )
            .join('')}</tbody></table></div>`
        : ''
    }
  </form>`;
  document.getElementById('ef').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const r = await api(`/api/org/${S.org.id}/invites/${inv.id}/emails`, { method: 'POST', body: { emails: document.getElementById('emails').value } });
      await emailPanel(inv);
      document.getElementById('emsg').innerHTML = `<div class="notice">${r.added} undangan tersimpan · ${r.registered} sudah punya akun dan langsung melihatnya di aplikasi.${
        r.invalid.length ? ` Diabaikan karena tidak valid: ${esc(r.invalid.join(', '))}` : ''
      }</div>`;
    } catch (err) {
      document.getElementById('emsg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  });
  box.scrollIntoView({ block: 'start' });
}

function isSchool() {
  return ['sekolah', 'kampus'].includes(S.org && S.org.type);
}

function guardianCard(p) {
  const g = p.guardian;
  if (g) {
    return `<div class="card" style="border-color:#9FD9CC"><h2>Persetujuan orang tua/wali ✓</h2>
      <dl class="kv"><dt>Nama</dt><dd>${esc(g.guardian_name)}</dd><dt>Hubungan</dt><dd>${esc(g.relationship)}</dd><dt>Tanggal formulir</dt><dd>${esc(g.form_date || '-')}</dd><dt>Dicatat</dt><dd>${esc(g.recorded_at.slice(0, 10))}</dd></dl>
      ${can('admin') ? '<div class="actions"><button class="btn btn-danger" type="button" id="grevoke">Tarik persetujuan</button></div><p class="small muted">Gunakan bila orang tua/wali meminta persetujuan dibatalkan.</p>' : ''}</div>`;
  }
  if (!can('assessor')) return '<div class="card" style="border-color:#F5C89B"><h2>Menunggu persetujuan orang tua/wali</h2><p class="muted">Peserta berusia di bawah 18 tahun.</p></div>';
  return `<form class="card" id="gf" style="border-color:#F5C89B">
    <h2>Persetujuan orang tua/wali</h2>
    <p class="sub">Peserta berusia di bawah 18 tahun. Sesuai UU PDP, hasil tesnya baru dapat dilihat organisasi dan psikolog setelah orang tua/wali menandatangani formulir persetujuan. <a href="/formulir-persetujuan.html?org=${encodeURIComponent(S.org.name)}&nama=${encodeURIComponent(p.name)}" target="_blank" rel="noopener">Cetak formulir</a></p>
    <div class="grid cols-form">
      <div class="field"><label for="gname">Nama orang tua/wali</label><input class="input" id="gname" maxlength="160" required></div>
      <div class="field"><label for="grel">Hubungan</label><select class="input" id="grel"><option>Ibu</option><option>Ayah</option><option>Wali</option></select></div>
      <div class="field"><label for="gdate">Tanggal ditandatangani</label><input class="input" id="gdate" type="date"></div>
    </div>
    <div class="field"><label for="gnote">Catatan <span class="hint">(opsional, mis. lokasi arsip formulir)</span></label><input class="input" id="gnote" maxlength="500"></div>
    <label class="small" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" id="gconf" style="margin-top:3px"> Saya menyatakan formulir persetujuan bertanda tangan orang tua/wali sudah diterima dan disimpan oleh organisasi.</label>
    <div id="gmsg"></div>
    <div class="actions"><button class="btn btn-primary" type="submit">Catat persetujuan</button></div>
  </form>`;
}

function krSpark(values) {
  if (!values || values.length < 2) return '';
  const w = 600;
  const h = 90;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 8) - 4).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" role="img" aria-label="Jumlah jawaban per kolom"><polyline points="${pts}" fill="none" stroke="#3A3FD8" stroke-width="2" vector-effect="non-scaling-stroke"></polyline></svg>`;
}

async function viewParticipant(pid) {
  const main = shell('undangan', loading());
  const data = await api(`/api/org/${S.org.id}/participants/${pid}`);
  const p = data.participant;
  const k = p.results?.kraepelin;
  const b5 = p.results?.bigfive;
  const t16 = p.results?.type16;

  const krBlock = k
    ? `<div class="card"><h2>Kraepelin</h2>
      <div class="grid cols-4">
        <div class="kpi"><span>Kecepatan</span><b>${k.speed}</b><small>jawaban per kolom · ${LEVEL_ID[k.levels.speed]}</small></div>
        <div class="kpi"><span>Ketelitian</span><b>${k.errorRate}%</b><small>kesalahan · ${LEVEL_ID[k.levels.accuracy]}</small></div>
        <div class="kpi"><span>Keajegan</span><b>${k.range}</b><small>rentang naik-turun · ${LEVEL_ID[k.levels.consistency]}</small></div>
        <div class="kpi"><span>Ketahanan</span><b>${Math.round(k.endurance * 100)}%</b><small>akhir ÷ awal · ${LEVEL_ID[k.levels.endurance]}</small></div>
      </div>
      <div><span class="small muted">Jawaban per kolom (${k.columns} kolom × ${k.seconds} detik)</span>${krSpark(k.perColumn)}</div>
      <p class="small muted">${k.totalAnswered} jawaban, ${k.totalWrong} salah · percobaan ke-${k.attempt || 1}${k.tabSwitches ? ` · <b style="color:var(--danger)">berpindah tab/aplikasi ${k.tabSwitches} kali</b>` : ''}</p>
    </div>`
    : '';
  const b5Block = b5
    ? `<div class="card"><h2>Big Five</h2><div class="bars">${b5.traits
        .map((t) => `<div class="bar-row"><span>${esc(t.name)}</span><span class="track"><div style="width:${t.pct}%;background:#0F7B6C"></div></span><span class="val">${t.pct}%</span></div>`)
        .join('')}</div></div>`
    : '';
  const dc = p.results?.disc;
  const dcBlock = dc
    ? `<div class="card"><h2>DISC · ${esc(dc.code)}</h2><p>${esc(DISC_FACTORS[dc.primary].descId)}</p>
      <div class="table-wrap"><table><thead><tr><th>Faktor</th><th class="num">Most</th><th class="num">Least</th><th class="num">Change</th></tr></thead><tbody>${'DISC'
        .split('')
        .map((f) => `<tr><td>${f} · ${esc(DISC_FACTORS[f].id)}</td><td class="num">${dc.most[f]}</td><td class="num">${dc.least[f]}</td><td class="num"><b>${dc.change[f] > 0 ? '+' : ''}${dc.change[f]}</b></td></tr>`)
        .join('')}</tbody></table></div></div>`
    : '';
  const t16Block = t16 ? `<div class="card"><h2>16 Tipe</h2><p><b style="font-size:22px">${esc(t16.code)}</b> · ${esc(t16.title)}</p></div>` : '';

  const sug = p.suggestions || [];
  const sugCount = sug.filter(Boolean).length;
  const sugBlock = data.restricted
    ? ''
    : `<div class="card"><h2>Saran nilai aspek</h2>
      <p class="sub">${sugCount} dari 18 aspek punya saran dari tes online. <b>Tes</b> = diukur cukup langsung; <b>indikasi</b> = perlu dikonfirmasi lewat wawancara atau observasi. Aspek kognitif belum diukur tes online.</p>
      <div class="table-wrap"><table><thead><tr><th>Aspek</th><th>Saran</th><th>Dasar</th></tr></thead><tbody>${GROUPS.map(
        (g) =>
          `<tr><td colspan="3" style="background:#F8F9FC;font-weight:800;font-size:12px;color:var(--muted);text-transform:uppercase">${g.name}</td></tr>${ASPECTS.map((a, i) => ({ a, i }))
            .filter((x) => x.a.group === g.key)
            .map(({ a, i }) => {
              const s = sug[i];
              return `<tr><td>${esc(a.name)}</td><td>${s ? `<b>${LEVELS[s.value - 1].code}</b> (${s.value})` : '<span class="muted">Penilaian psikolog</span>'}</td><td class="small">${s ? `${esc(s.source)} · <i>${s.strength}</i>` : ''}</td></tr>`;
            })
            .join('')}`
      ).join('')}</tbody></table></div>
    </div>`;

  main.innerHTML = `
    <div class="report-bar"><a class="btn btn-outline" href="#/o/${S.org.id}/undangan">${icon(IC.back)}Undangan &amp; tes</a>
      <div class="actions">${
        p.assessment_id
          ? `<a class="btn btn-primary" href="#/o/${S.org.id}/peserta/${p.assessment_id}">Buka psikogram</a>`
          : can('assessor') && !data.restricted
            ? `<a class="btn btn-primary" href="#/o/${S.org.id}/peserta/baru?dari=${p.id}">Buat asesmen dari hasil ini</a>`
            : ''
      }</div></div>
    <div class="page-head"><div><h1>${esc(p.name)}</h1><p>${esc([p.nik, p.position, p.division].filter(Boolean).join(' · ') || p.email)} · ${esc(p.invite_name)}</p></div></div>
    ${
      can('assessor')
        ? `<form class="card" id="pedit">
      <h2>Data ${isSchool() ? 'siswa' : 'karyawan'}</h2>
      <div class="grid cols-form">
        <div class="field"><label for="pnik">${isSchool() ? 'NIS / NIM' : 'NIK'}</label><input class="input" id="pnik" value="${esc(p.nik || '')}" maxlength="40"></div>
        <div class="field"><label for="ppos">${isSchool() ? 'Kelas / jurusan' : 'Jabatan'}</label><input class="input" id="ppos" value="${esc(p.position || '')}" maxlength="160"></div>
        <div class="field"><label for="pdiv">${isSchool() ? 'Peminatan / fakultas' : 'Divisi'}</label><input class="input" id="pdiv" value="${esc(p.division || '')}" maxlength="120"></div>
      </div>
      <p class="small muted">Nama dan email (${esc(p.email)}) berasal dari akun peserta dan hanya bisa diubah oleh peserta sendiri.</p>
      <div id="pmsg"></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Simpan</button>${
        can('admin') ? '<button class="btn btn-danger" type="button" id="prm">Keluarkan dari organisasi</button>' : ''
      }</div>
    </form>`
        : ''
    }
    <div class="card"><h2>Status tes</h2><div>${statusChips(p.tests)}</div><p class="small muted">Bergabung ${esc(p.joined_at.slice(0, 10))}, persetujuan berbagi hasil diberikan ${esc(p.consent_at.slice(0, 10))}. Hanya tes yang dikerjakan setelah bergabung yang dihitung.</p></div>
    ${p.minor ? guardianCard(p) : ''}
    ${
      data.restricted
        ? data.reason === 'guardian'
          ? '<div class="notice">Peserta ini berusia di bawah 18 tahun. Hasil tesnya disembunyikan sampai persetujuan orang tua/wali dicatat di atas.</div>'
          : '<div class="notice">Hasil tes psikologi hanya dapat dilihat oleh psikolog dan asesor. Peran Anda dapat melihat status tes dan psikogram yang sudah final.</div>'
        : ''
    }
    ${krBlock}${b5Block}${dcBlock}${t16Block}${sugBlock}`;

  const gf = document.getElementById('gf');
  if (gf)
    gf.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api(`/api/org/${S.org.id}/participants/${pid}/consent`, {
          method: 'POST',
          body: {
            guardian_name: document.getElementById('gname').value,
            relationship: document.getElementById('grel').value,
            form_date: document.getElementById('gdate').value,
            note: document.getElementById('gnote').value,
            confirm: document.getElementById('gconf').checked
          }
        });
        render();
      } catch (err) {
        document.getElementById('gmsg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    });
  const grv = document.getElementById('grevoke');
  if (grv)
    grv.addEventListener('click', async () => {
      if (!confirm('Tarik persetujuan orang tua? Hasil tes siswa ini akan kembali disembunyikan dari organisasi dan psikolog.')) return;
      await api(`/api/org/${S.org.id}/participants/${pid}/consent`, { method: 'DELETE' });
      render();
    });
  const pe = document.getElementById('pedit');
  if (pe)
    pe.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api(`/api/org/${S.org.id}/participants/${pid}`, {
          method: 'PUT',
          body: { nik: pe.querySelector('#pnik').value, position: pe.querySelector('#ppos').value, division: pe.querySelector('#pdiv').value }
        });
        document.getElementById('pmsg').innerHTML = '<div class="notice">Data tersimpan.</div>';
      } catch (err) {
        document.getElementById('pmsg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    });
  const rm = document.getElementById('prm');
  if (rm)
    rm.addEventListener('click', async () => {
      if (!confirm(`Keluarkan ${p.name} dari organisasi? Organisasi tidak lagi bisa melihat hasil tesnya. Psikogram yang sudah dibuat tetap tersimpan di daftar Peserta.`)) return;
      await api(`/api/org/${S.org.id}/participants/${pid}`, { method: 'DELETE' });
      go(`#/o/${S.org.id}/undangan`);
    });
}

// ---------------- talent pool ----------------

const KR_ID = { speed: 'Kecepatan', accuracy: 'Ketelitian', consistency: 'Keajegan', endurance: 'Ketahanan' };
const LVL_ID = { 'Very low': 'sangat rendah', Low: 'rendah', Average: 'sedang', High: 'tinggi', 'Very high': 'sangat tinggi' };
const BF_ID = { High: 'tinggi', Moderate: 'sedang', Low: 'rendah' };
const TREQ = { pending: ['Menunggu jawaban', 'rec-catatan'], accepted: ['Diterima', 'rec-disarankan'], declined: ['Ditolak', 'rec-tidak'], withdrawn: ['Kandidat keluar', 'chip-plain'] };

function candidateCardHtml(c) {
  const st = c.request ? TREQ[c.request] : null;
  return `<div class="card" style="gap:10px">
    <div class="page-head" style="align-items:flex-start"><div><h2>Kandidat ${esc(c.alias)}</h2>${c.headline ? `<p>${esc(c.headline)}</p>` : ''}</div>${st ? `<span class="chip ${st[1]}">${st[0]}</span>` : ''}</div>
    <dl class="kv" style="grid-template-columns:auto 1fr">
      ${c.city ? `<dt>Kota</dt><dd style="text-align:left">${esc(c.city)}</dd>` : ''}
      ${c.education ? `<dt>Pendidikan</dt><dd style="text-align:left">${esc(c.education)}</dd>` : ''}
      ${c.desired_roles ? `<dt>Minat posisi</dt><dd style="text-align:left">${esc(c.desired_roles)}</dd>` : ''}
      ${c.experience && c.experience.length ? `<dt>Pengalaman</dt><dd style="text-align:left">${c.experience.map((e) => `${esc(e.title)}${e.years ? ` (${e.years} th)` : ''}`).join(', ')}</dd>` : ''}
    </dl>
    ${c.skills && c.skills.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px">${c.skills.slice(0, 12).map((x) => `<span class="chip chip-plain">${esc(x)}</span>`).join('')}</div>` : ''}
    ${
      c.disc || c.type16 || c.bigfive || c.kraepelin
        ? `<div class="small" style="display:flex;flex-direction:column;gap:4px;background:#F8F9FC;border-radius:10px;padding:10px 12px">
        ${c.disc ? `<span><b>DISC</b> ${esc(c.disc)}</span>` : ''}${c.type16 ? `<span><b>16 Tipe</b> ${esc(c.type16)}</span>` : ''}
        ${c.bigfive ? `<span><b>Big Five</b> ${c.bigfive.map((t) => `${esc(t.name)} ${BF_ID[t.level] || esc(t.level)}`).join(' · ')}</span>` : ''}
        ${c.kraepelin ? `<span><b>Kraepelin</b> ${Object.entries(c.kraepelin).map(([k, v]) => `${KR_ID[k]} ${LVL_ID[v] || esc(v)}`).join(' · ')}</span>` : ''}
      </div>`
        : ''
    }
    ${
      can('assessor') && (!c.request || ['declined', 'withdrawn'].includes(c.request))
        ? `<details><summary class="link" style="cursor:pointer">Minta kontak</summary>
        <form class="stack-sm" data-req="${esc(c.alias)}" style="margin-top:8px">
          <label class="sr-only" for="m-${esc(c.alias)}">Pesan untuk kandidat</label>
          <textarea class="input" id="m-${esc(c.alias)}" maxlength="600" placeholder="Posisi yang ditawarkan, lokasi, dan alasan Anda tertarik. Kandidat membaca pesan ini sebelum memutuskan."></textarea>
          <div class="actions"><button class="btn btn-primary" type="submit">Kirim permintaan</button></div><div class="rmsg"></div>
        </form></details>`
        : ''
    }
  </div>`;
}

async function viewTalentPool(params) {
  const main = shell('talent', loading());
  const tab = params.get('tab') === 'permintaan' ? 'permintaan' : 'cari';
  const head = `<div class="page-head"><div><h1>Talent pool</h1><p>Kandidat dewasa yang memilih untuk ditemukan. Profil tampil anonim; data kontak dibagikan hanya jika kandidat menerima permintaan Anda.</p></div>
    <div class="actions"><a class="btn ${tab === 'cari' ? 'btn-primary' : 'btn-outline'}" href="#/o/${S.org.id}/talent">Cari kandidat</a><a class="btn ${tab === 'permintaan' ? 'btn-primary' : 'btn-outline'}" href="#/o/${S.org.id}/talent?tab=permintaan">Permintaan saya</a></div></div>`;

  if (tab === 'permintaan') {
    const [{ requests }, { invites }] = await Promise.all([api(`/api/org/${S.org.id}/talent/requests`), api(`/api/org/${S.org.id}/invites`)]);
    const active = invites.filter((i) => i.active);
    main.innerHTML = `${head}
      ${
        requests.length
          ? requests
              .map(
                (r) => `<div class="card" style="gap:8px">
          <div class="page-head"><h2>Kandidat ${esc(r.alias)}</h2><span class="chip ${TREQ[r.status][1]}">${TREQ[r.status][0]}</span></div>
          <p class="small muted">Dikirim ${esc(r.created_at.slice(0, 10))}${r.responded_at ? ` · dijawab ${esc(r.responded_at.slice(0, 10))}` : ''}</p>
          <p style="white-space:pre-line">${esc(r.message || '')}</p>
          ${
            r.contact
              ? `<div class="notice"><b>${esc(r.contact.name)}</b> · <a href="mailto:${esc(r.contact.email)}">${esc(r.contact.email)}</a>${r.contact.phone ? ` · ${esc(r.contact.phone)}` : ''}</div>
            ${
              can('assessor') && active.length
                ? `<form class="actions" data-inv="${esc(r.contact.email)}"><label class="sr-only" for="i-${r.id}">Gelombang asesmen</label><select class="input" id="i-${r.id}" style="max-width:320px">${active
                    .map((i) => `<option value="${i.id}">${esc(i.name)}</option>`)
                    .join('')}</select><button class="btn btn-outline" type="submit">Undang ke asesmen</button><span class="small imsg"></span></form>`
                : ''
            }`
              : ''
          }
        </div>`
              )
              .join('')
          : '<div class="card"><p class="muted">Belum ada permintaan kontak.</p></div>'
      }
      <p class="small muted">Gunakan data kontak hanya untuk keperluan rekrutmen yang disebutkan dalam pesan Anda.</p>`;
    main.querySelectorAll('[data-inv]').forEach((f) =>
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const out = f.querySelector('.imsg');
        try {
          await api(`/api/org/${S.org.id}/invites/${f.querySelector('select').value}/emails`, { method: 'POST', body: { emails: f.dataset.inv } });
          out.textContent = 'Undangan terkirim ke aplikasi kandidat.';
        } catch (err) {
          out.textContent = err.message;
        }
      })
    );
    return;
  }

  const q = new URLSearchParams();
  for (const k of ['q', 'edu', 'city', 'test']) if (params.get(k)) q.set(k, params.get(k));
  const { candidates } = await api(`/api/org/${S.org.id}/talent?${q}`);
  main.innerHTML = `${head}
    <form class="filters" id="tflt">
      <div class="field grow"><label for="tq">Kata kunci</label><input class="input" id="tq" value="${esc(params.get('q') || '')}" placeholder="mis. data analyst SQL"></div>
      <div class="field"><label for="tedu">Pendidikan</label><input class="input" id="tedu" value="${esc(params.get('edu') || '')}" placeholder="mis. S1"></div>
      <div class="field"><label for="tcity">Kota</label><input class="input" id="tcity" value="${esc(params.get('city') || '')}"></div>
      <div class="field"><label for="ttest">Hasil tes</label><select class="input" id="ttest"><option value="">Semua</option>${[
        ['kraepelin', 'Ada Kraepelin'],
        ['disc', 'Ada DISC'],
        ['personality', 'Ada kepribadian']
      ]
        .map(([v, l]) => `<option value="${v}" ${params.get('test') === v ? 'selected' : ''}>${l}</option>`)
        .join('')}</select></div>
      <button class="btn btn-primary" type="submit" style="height:42px">Cari</button>
    </form>
    <p class="small muted">${candidates.length} kandidat${q.toString() ? ' sesuai pencarian' : ''}. Ringkasan hasil tes hanya tampil bila kandidat mengizinkannya.</p>
    <div class="grid cols-2" style="align-items:start">${candidates.map(candidateCardHtml).join('') || '<div class="card"><p class="muted">Belum ada kandidat yang cocok.</p></div>'}</div>`;

  document.getElementById('tflt').addEventListener('submit', (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    for (const [k, id] of [['q', 'tq'], ['edu', 'tedu'], ['city', 'tcity'], ['test', 'ttest']]) {
      const v = document.getElementById(id).value.trim();
      if (v) p.set(k, v);
    }
    go(`#/o/${S.org.id}/talent${p.toString() ? '?' + p : ''}`);
  });
  main.querySelectorAll('[data-req]').forEach((f) =>
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api(`/api/org/${S.org.id}/talent/requests`, { method: 'POST', body: { alias: f.dataset.req, message: f.querySelector('textarea').value } });
        render();
      } catch (err) {
        f.querySelector('.rmsg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    })
  );
}

// ---------------- standards ----------------

async function viewStandards(params) {
  await refreshStandards();
  const editing = params.get('ubah');
  const main = shell('standar', '');
  const admin = can('admin');
  const st = S.standards;

  main.innerHTML = `
    <div class="page-head">
      <div><h1>Standar jabatan</h1><p>Nilai minimal yang dibutuhkan setiap level jabatan untuk 18 aspek psikologi.</p></div>
      <div class="actions">${admin ? `<a class="btn btn-primary" href="#/o/${S.org.id}/standar?ubah=baru">${icon(IC.plus)}Tambah standar</a>` : ''}</div>
    </div>
    ${editing && admin ? '<div id="editor"></div>' : ''}
    <div class="table-wrap"><table>
      <thead><tr><th>Aspek</th>${st.map((s) => `<th class="num" title="${esc(s.name)}">${esc(s.code)}</th>`).join('')}</tr></thead>
      <tbody>
        <tr><td class="muted">Nama level</td>${st.map((s) => `<td class="num small">${esc(s.name)}</td>`).join('')}</tr>
        ${GROUPS.map(
          (g) =>
            `<tr class="group-row"><td colspan="${st.length + 1}" style="background:#F8F9FC;font-weight:800;font-size:12px;color:var(--muted);text-transform:uppercase">${g.name}</td></tr>${ASPECTS.map((asp, i) => ({ asp, i }))
              .filter((x) => x.asp.group === g.key)
              .map(({ asp, i }) => `<tr><td>${esc(asp.name)}</td>${st.map((s) => `<td class="num">${LEVELS[s.scores[i] - 1].code} <span class="muted small">(${s.scores[i]})</span></td>`).join('')}</tr>`)
              .join('')}`
        ).join('')}
        <tr><td class="muted">Total</td>${st.map((s) => `<td class="num"><b>${s.scores.reduce((x, y) => x + y, 0)}</b></td>`).join('')}</tr>
        ${admin ? `<tr><td></td>${st.map((s) => `<td class="num"><a href="#/o/${S.org.id}/standar?ubah=${s.id}">Ubah</a></td>`).join('')}</tr>` : ''}
      </tbody>
    </table></div>
    <p class="small muted">Mengubah standar tidak mengubah hasil asesmen yang sudah tersimpan. Hasil lama dihitung ulang hanya bila datanya diubah dan disimpan kembali.</p>`;

  if (!(editing && admin)) return;
  const s = editing === 'baru' ? { code: '', name: '', scores: ASPECTS.map(() => 3) } : st.find((x) => x.id === editing);
  if (!s) return go(`#/o/${S.org.id}/standar`);
  const vals = [...s.scores];
  const ed = document.getElementById('editor');
  ed.innerHTML = `<form class="card" id="sf">
    <h2>${editing === 'baru' ? 'Standar baru' : `Ubah standar ${esc(s.code)}`}</h2>
    <div class="grid cols-form">
      <div class="field"><label for="sc">Kode</label><input class="input" id="sc" value="${esc(s.code)}" maxlength="30" required placeholder="mis. BOD-3"></div>
      <div class="field"><label for="sn">Nama level</label><input class="input" id="sn" value="${esc(s.name)}" maxlength="120" required placeholder="mis. Supervisor"></div>
    </div>
    <div class="table-wrap"><table class="score-table"><tbody id="sb"></tbody></table></div>
    <div id="serr"></div>
    <div class="actions">
      <button class="btn btn-primary" type="submit">Simpan standar</button>
      <a class="btn btn-outline" href="#/o/${S.org.id}/standar">Batal</a>
      ${editing !== 'baru' ? '<button class="btn btn-danger" type="button" id="sdel">Hapus standar</button>' : ''}
    </div>
  </form>`;
  const draw = () => {
    document.getElementById('sb').innerHTML = ASPECTS.map(
      (asp, i) => `<tr><td><b>${esc(asp.name)}</b></td><td><div class="seg" role="radiogroup" aria-label="${esc(asp.name)}">${LEVELS.map(
        (l) => `<button type="button" role="radio" data-i="${i}" data-v="${l.value}" aria-checked="${vals[i] === l.value}" title="${l.name}">${l.code}</button>`
      ).join('')}</div></td></tr>`
    ).join('');
  };
  draw();
  document.getElementById('sb').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    vals[Number(b.dataset.i)] = Number(b.dataset.v);
    draw();
  });
  document.getElementById('sf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { code: document.getElementById('sc').value, name: document.getElementById('sn').value, scores: vals };
    try {
      if (editing === 'baru') await api(`/api/org/${S.org.id}/standards`, { method: 'POST', body });
      else await api(`/api/org/${S.org.id}/standards/${s.id}`, { method: 'PUT', body });
      go(`#/o/${S.org.id}/standar`);
    } catch (err) {
      document.getElementById('serr').innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  });
  const sdel = document.getElementById('sdel');
  if (sdel)
    sdel.addEventListener('click', async () => {
      if (!confirm(`Hapus standar ${s.code}? Peserta yang sudah memakai standar ini tetap tersimpan, tetapi standar ini tidak bisa dipilih lagi.`)) return;
      await api(`/api/org/${S.org.id}/standards/${s.id}`, { method: 'DELETE' });
      go(`#/o/${S.org.id}/standar`);
    });
  ed.scrollIntoView({ block: 'start' });
}

// ---------------- settings & members ----------------

async function viewSettings() {
  if (!can('admin')) return go(`#/o/${S.org.id}`);
  const main = shell('pengaturan', loading());
  const { org } = await api(`/api/org/${S.org.id}`);
  S.org = org;
  const { members } = await api(`/api/org/${S.org.id}/members`);
  const st = org.settings || {};
  const f = (k, label, ph = '') =>
    `<div class="field"><label for="s_${k}">${label}</label><input class="input" id="s_${k}" name="${k}" value="${esc(st[k] || '')}" placeholder="${esc(ph)}"></div>`;

  main.innerHTML = `
    <div class="page-head"><div><h1>Pengaturan</h1><p>Identitas organisasi, tanda tangan psikogram, dan anggota tim.</p></div></div>
    <form class="card" id="sf">
      <h2>Organisasi &amp; tanda tangan psikogram</h2>
      <div class="grid cols-form">
        <div class="field"><label for="s_name">Nama organisasi</label><input class="input" id="s_name" name="name" value="${esc(org.name)}" maxlength="160"></div>
        ${f('psychologist_name', 'Nama psikolog (disusun oleh)', 'mis. Nama, M.Psi., Psikolog')}
        ${f('psychologist_sipp', 'Nomor SIPP')}
        ${f('validator_name', 'Divalidasi oleh – nama')}
        ${f('validator_title', 'Divalidasi oleh – jabatan', 'mis. Organization Development Analyst')}
        ${f('approver_name', 'Diketahui – nama')}
        ${f('approver_title', 'Diketahui – jabatan', 'mis. Senior Specialist')}
      </div>
      ${f('report_note', 'Catatan kaki psikogram', 'Uraian ini hanya berlaku apabila ditandatangani oleh psikolog.')}
      <div id="smsg"></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Simpan</button></div>
    </form>
    <div class="card">
      <h2>Anggota tim</h2>
      <p class="sub"><b>Admin</b> mengelola semuanya. <b>Asesor</b> menambah dan mengubah data peserta. <b>Pembaca (HR)</b> hanya melihat dasbor dan psikogram.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th><span class="sr-only">Aksi</span></th></tr></thead>
        <tbody>${members
          .map(
            (m) => `<tr><td class="nm">${esc(m.name)}</td><td>${esc(m.email)}</td><td>${esc(ROLE_NAMES[m.role])}</td>
            <td>${m.email === S.me.user.email ? '<span class="muted small">Anda</span>' : `<button class="link danger" type="button" data-rm="${m.id}" data-nm="${esc(m.name)}">Keluarkan</button>`}</td></tr>`
          )
          .join('')}</tbody>
      </table></div>
      <form class="filters" id="mf">
        <div class="field grow"><label for="me">Email anggota</label><input class="input" id="me" type="email" required placeholder="email@perusahaan.co.id"></div>
        <div class="field"><label for="mr">Peran</label><select class="input" id="mr"><option value="viewer">Pembaca (HR)</option><option value="assessor">Asesor</option><option value="admin">Admin</option></select></div>
        <button class="btn btn-primary" type="submit" style="height:42px">Tambahkan</button>
      </form>
      <div id="mmsg"></div>
      <p class="small muted">Orang yang ditambahkan harus sudah membuat akun di <a href="/app/#/register">aplikasi</a> dengan email yang sama. Setelah itu mereka membuka portal ini di <b>${esc(location.origin)}/org/</b>.</p>
    </div>`;

  document.getElementById('sf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {};
    for (const el of e.target.elements) if (el.name) body[el.name] = el.value;
    try {
      await api(`/api/org/${S.org.id}/settings`, { method: 'PUT', body });
      S.org.name = body.name || S.org.name;
      document.getElementById('smsg').innerHTML = '<div class="notice">Pengaturan tersimpan.</div>';
      document.querySelector('.org-name b').textContent = S.org.name;
    } catch (err) {
      document.getElementById('smsg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  });
  document.getElementById('mf').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api(`/api/org/${S.org.id}/members`, { method: 'POST', body: { email: document.getElementById('me').value, role: document.getElementById('mr').value } });
      render();
    } catch (err) {
      document.getElementById('mmsg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  });
  main.querySelectorAll('[data-rm]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (!confirm(`Keluarkan ${b.dataset.nm} dari organisasi?`)) return;
      await api(`/api/org/${S.org.id}/members/${b.dataset.rm}`, { method: 'DELETE' });
      render();
    })
  );
}

// ---------------- router ----------------

async function render() {
  const { parts, params } = parseHash();
  window.scrollTo(0, 0);
  try {
    if (!S.me) S.me = await api('/api/org/mine');
    if (parts[0] !== 'o' || !parts[1]) return await viewPicker();
    await loadOrg(parts[1]);
    const [, , section, sub, action] = parts;
    if (!section) return await viewDashboard(params);
    if (section === 'peserta') {
      if (!sub) return await viewList(params);
      if (sub === 'baru') return can('assessor') ? await viewForm(null, params) : go(`#/o/${S.org.id}/peserta`);
      if (action === 'edit') return can('assessor') ? await viewForm(sub) : go(`#/o/${S.org.id}/peserta/${sub}`);
      return await viewReport(sub);
    }
    if (section === 'standar') return await viewStandards(params);
    if (section === 'talent') return await viewTalentPool(params);
    if (section === 'undangan') return sub === 'p' && action ? await viewParticipant(action) : await viewInvites(params);
    if (section === 'pengaturan') return await viewSettings();
    go(`#/o/${S.org.id}`);
  } catch (err) {
    if (err.handled) return;
    const target = document.getElementById('main') || root;
    target.innerHTML = `<div class="center-box"><div class="error" role="alert">${esc(err.message)}</div><a class="btn btn-outline" href="#/">Kembali</a></div>`;
  }
}

window.addEventListener('hashchange', render);
render();
