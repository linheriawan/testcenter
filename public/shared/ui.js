// Small UI helpers shared by the admin page and the psychologist page.

export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function makeApi(onUnauthorized) {
  return async function api(path, { method = 'GET', body } = {}) {
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
      onUnauthorized();
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
  };
}

export const IC = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 20a6 6 0 0 0-2.5-4.9"/>',
  building: '<path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M16 9h3a2 2 0 0 1 2 2v10"/><path d="M9 7h3M9 11h3M9 15h3"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  next: '<path d="M9 18l6-6-6-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>'
};

export function icon(path, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}

export function loading() {
  return '<div class="loading"><div class="spinner"></div>Memuat…</div>';
}

export function loginScreen(root, title, returnPath) {
  try {
    sessionStorage.setItem('tc_next', returnPath + location.hash);
  } catch {
    /* ignore */
  }
  root.innerHTML = `<div class="center-box"><div class="card">
    <h2>${esc(title)}</h2>
    <p class="muted">Masuk dengan akun Test Center Anda untuk melanjutkan.</p>
    <a class="btn btn-primary btn-lg" href="/app/#/login">Masuk</a>
  </div></div>`;
}

// Sidebar layout shared with the organization portal's styles (org.css).
export function shell(root, { subtitle, title, items, active, footer }, content) {
  root.innerHTML = `<div class="shell">
    <aside class="side">
      <a class="brand" href="/"><span class="brand-mark">${icon(IC.compass, 18)}</span>Test Center</a>
      <div class="org-name">${esc(subtitle)}<b>${esc(title)}</b></div>
      <nav aria-label="Menu">${items
        .map(
          ([k, h, ic, label, badge]) =>
            `<a href="${h}" class="${active === k ? 'on' : ''}" ${active === k ? 'aria-current="page"' : ''}>${icon(ic)}<span style="flex:1">${label}</span>${
              badge ? `<span class="chip rec-tidak" style="padding:2px 8px">${badge}</span>` : ''
            }</a>`
        )
        .join('')}</nav>
      <div class="foot">${footer || ''}</div>
    </aside>
    <main class="main" id="main">${content}</main>
  </div>`;
  return document.getElementById('main');
}

export function downloadCsv(filename, rows, sep = ';') {
  const cell = (v) => {
    const s = String(v ?? '');
    return /["\n\r]/.test(s) || s.includes(sep) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = '﻿' + rows.map((r) => r.map(cell).join(sep)).join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, query] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(query || '') };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export function fmtDateTime(stamp) {
  if (!stamp) return '-';
  const d = new Date(`${stamp.slice(0, 10)}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}${stamp.length > 10 ? ' · ' + stamp.slice(11, 16) : ''}`;
}

export function fmtDate(iso) {
  return iso ? fmtDateTime(iso.slice(0, 10)) : '-';
}

export { MONTHS, DAYS };
