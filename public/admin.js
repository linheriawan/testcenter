// Admin platform — users, roles, organizations and partnership inquiries.

import { esc, makeApi, IC, icon, loading, loginScreen, shell, downloadCsv, parseHash, fmtDate, fmtDateTime } from '/shared/ui.js';

const root = document.getElementById('root');
const api = makeApi(() => loginScreen(root, 'Admin platform', '/admin/'));
let ME = null;
let STATS = null;

const TEST_NAMES = { bigfive: 'Big Five', type16: '16 Tipe', kraepelin: 'Kraepelin' };
const SEG = { student: 'Pelajar', jobseeker: 'Pencari kerja' };
const ROLE = { user: 'Pengguna', psychologist: 'Psikolog' };
const ORG_TYPES = { sekolah: 'Sekolah', kampus: 'Perguruan tinggi', perusahaan: 'Perusahaan', biro: 'Biro psikologi', lainnya: 'Lainnya' };
const INQ_STATUS = { new: 'Baru', contacted: 'Dihubungi', won: 'Jadi mitra', closed: 'Ditutup' };
const STATUS_ID = { requested: 'Menunggu', confirmed: 'Terkonfirmasi', done: 'Selesai', cancelled: 'Dibatalkan', declined: 'Ditolak', no_show: 'Tidak hadir' };

function page(active, content) {
  return shell(
    root,
    {
      subtitle: 'Admin platform',
      title: 'Test Center',
      active,
      items: [
        ['ringkasan', '#/', IC.dash, 'Ringkasan'],
        ['pengguna', '#/pengguna', IC.people, 'Pengguna'],
        ['organisasi', '#/organisasi', IC.building, 'Organisasi'],
        ['kemitraan', '#/kemitraan', IC.inbox, 'Kemitraan', STATS && STATS.inquiriesNew ? STATS.inquiriesNew : '']
      ],
      footer: `<span>${esc(ME.user.name)}</span><a href="/org/">Portal organisasi</a>${ME.isPsychologist ? '<a href="/psikolog/">Halaman psikolog</a>' : ''}<a href="/app/">Aplikasi peserta</a>`
    },
    content
  );
}

async function viewSummary() {
  STATS = await api('/api/admin/stats');
  const s = STATS;
  page(
    'ringkasan',
    `<div class="page-head"><div><h1>Ringkasan</h1><p>Gambaran singkat platform hari ini.</p></div></div>
    <div class="grid cols-4">
      <a class="kpi" href="#/pengguna" style="text-decoration:none;color:inherit"><span>Pengguna aplikasi</span><b>${s.users}</b><small>${s.newUsers7d} baru dalam 7 hari</small></a>
      <a class="kpi" href="#/pengguna?role=psychologist" style="text-decoration:none;color:inherit"><span>Psikolog</span><b>${s.psychologists}</b><small>akun dengan peran psikolog</small></a>
      <a class="kpi" href="#/organisasi" style="text-decoration:none;color:inherit"><span>Organisasi</span><b>${s.orgs}</b><small>perusahaan, sekolah, biro</small></a>
      <a class="kpi" href="#/kemitraan" style="text-decoration:none;color:inherit"><span>Permintaan kemitraan baru</span><b>${s.inquiriesNew}</b><small>dari halaman depan</small></a>
    </div>
    <div class="grid cols-4">
      <div class="kpi"><span>Sesi mendatang</span><b>${s.upcoming}</b><small>konsultasi &amp; asesmen</small></div>
      <div class="kpi"><span>Menunggu konfirmasi</span><b>${s.requested}</b><small>permintaan konsultasi</small></div>
      <div class="kpi"><span>Tes dikerjakan</span><b>${s.testsDone}</b><small>total semua tes</small></div>
    </div>
    <div class="card"><h2>Menambah psikolog</h2><p class="muted">Psikolog membuat akun di aplikasi seperti pengguna biasa. Lalu buka <a href="#/pengguna">Pengguna</a>, cari emailnya, dan ubah perannya menjadi <b>Psikolog</b>. Setelah itu ia bisa membuka <b>${esc(location.origin)}/psikolog/</b> untuk mengatur jadwal dan menerima konsultasi.</p></div>`
  );
}

async function viewUsers(params) {
  const main = page('pengguna', loading());
  const q = new URLSearchParams();
  for (const k of ['q', 'role', 'segment']) if (params.get(k)) q.set(k, params.get(k));
  const { users } = await api(`/api/admin/users?${q}`);
  main.innerHTML = `
    <div class="page-head"><div><h1>Pengguna aplikasi</h1><p>${users.length} akun${q.toString() ? ' sesuai filter' : ''}. Admin melihat data akun dan aktivitas, bukan hasil tes psikologi.</p></div>
      <div class="actions"><button class="btn btn-outline" id="exp" type="button">${icon(IC.download)}Unduh CSV</button></div></div>
    <form class="filters" id="flt">
      <div class="field grow"><label for="fq">Cari</label><input class="input" id="fq" placeholder="Nama atau email" value="${esc(params.get('q') || '')}"></div>
      <div class="field"><label for="fr">Peran</label><select class="input" id="fr"><option value="">Semua</option>${Object.entries(ROLE)
        .map(([k, v]) => `<option value="${k}" ${params.get('role') === k ? 'selected' : ''}>${v}</option>`)
        .join('')}</select></div>
      <div class="field"><label for="fs">Segmen</label><select class="input" id="fs"><option value="">Semua</option>${Object.entries(SEG)
        .map(([k, v]) => `<option value="${k}" ${params.get('segment') === k ? 'selected' : ''}>${v}</option>`)
        .join('')}<option value="none" ${params.get('segment') === 'none' ? 'selected' : ''}>Belum isi profil</option></select></div>
    </form>
    ${
      users.length
        ? `<div class="table-wrap"><table>
      <thead><tr><th>Nama</th><th>Peran</th><th>Segmen</th><th class="num">Tes</th><th class="num">Sesi</th><th class="num">Organisasi</th><th>Terdaftar</th></tr></thead>
      <tbody>${users
        .map(
          (u) => `<tr>
          <td><a class="nm" href="#/pengguna/${u.id}">${esc(u.name)}</a><div class="small muted">${esc(u.email)}</div></td>
          <td>${u.role === 'psychologist' ? '<span class="chip rec-dipertimbangkan">Psikolog</span>' : 'Pengguna'}</td>
          <td>${esc(SEG[u.segment] || '-')}</td>
          <td class="num">${u.tests_done}</td><td class="num">${u.sessions}</td><td class="num">${u.orgs}</td>
          <td>${esc(u.created_at.slice(0, 10))}</td>
        </tr>`
        )
        .join('')}</tbody></table></div>`
        : '<div class="card"><p class="muted">Tidak ada pengguna yang cocok.</p></div>'
    }`;
  const apply = () => {
    if (!document.getElementById('fq')) return; // the page changed before a delayed search fired
    const p = new URLSearchParams();
    const v = { q: 'fq', role: 'fr', segment: 'fs' };
    for (const [k, id] of Object.entries(v)) {
      const x = document.getElementById(id).value.trim();
      if (x) p.set(k, x);
    }
    location.hash = `#/pengguna${p.toString() ? '?' + p : ''}`;
  };
  document.getElementById('fr').addEventListener('change', apply);
  document.getElementById('fs').addEventListener('change', apply);
  document.getElementById('flt').addEventListener('submit', (e) => {
    e.preventDefault();
    apply();
  });
  let t;
  document.getElementById('fq').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(apply, 500);
  });
  document.getElementById('exp').addEventListener('click', () =>
    downloadCsv('pengguna.csv', [
      ['Nama', 'Email', 'Peran', 'Segmen', 'Jumlah tes', 'Sesi', 'Organisasi', 'Terdaftar'],
      ...users.map((u) => [u.name, u.email, ROLE[u.role] || u.role, SEG[u.segment] || '', u.tests_done, u.sessions, u.orgs, u.created_at.slice(0, 10)])
    ])
  );
}

async function viewUser(id) {
  const main = page('pengguna', loading());
  const { user: u } = await api(`/api/admin/users/${id}`);
  const self = u.email === ME.user.email;
  main.innerHTML = `
    <div class="report-bar"><a class="btn btn-outline" href="#/pengguna">${icon(IC.back)}Pengguna</a></div>
    <div class="page-head"><div><h1>${esc(u.name)}</h1><p>${esc(u.email)} · terdaftar ${fmtDate(u.created_at)}</p></div></div>
    <div class="grid cols-2">
      <div class="card">
        <h2>Akun</h2>
        <div class="field"><label for="role">Peran</label><select class="input" id="role" ${self ? 'disabled' : ''}>${Object.entries(ROLE)
          .map(([k, v]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${v}</option>`)
          .join('')}</select><span class="hint">Psikolog bisa membuka halaman psikolog, mengatur jam praktik, dan menerima konsultasi.</span></div>
        <div id="rmsg"></div>
        <div class="actions">${self ? '' : '<button class="btn btn-primary" type="button" id="saveRole">Simpan peran</button>'}</div>
      </div>
      <div class="card">
        <h2>Profil</h2>
        ${
          u.profile
            ? `<dl class="kv"><dt>Segmen</dt><dd>${esc(SEG[u.profile.segment] || '-')}</dd><dt>Pendidikan</dt><dd>${esc(u.profile.education_level || '-')}</dd><dt>Bidang</dt><dd>${esc(u.profile.field || '-')}</dd><dt>Sekolah/kampus</dt><dd>${esc(u.profile.school || '-')}</dd></dl>`
            : '<p class="muted">Belum mengisi profil.</p>'
        }
      </div>
    </div>
    <div class="grid cols-2">
      <div class="card"><h2>Tes yang dikerjakan</h2>${
        u.tests.length
          ? `<div class="table-wrap"><table><thead><tr><th>Tes</th><th class="num">Kali</th><th>Terakhir</th></tr></thead><tbody>${u.tests
              .map((t) => `<tr><td>${esc(TEST_NAMES[t.test_id] || t.test_id)}</td><td class="num">${t.times}</td><td>${fmtDate(t.last)}</td></tr>`)
              .join('')}</tbody></table></div>`
          : '<p class="muted">Belum ada.</p>'
      }<p class="small muted">Hasil tes hanya bisa dilihat psikolog yang menangani pengguna ini.</p></div>
      <div class="card"><h2>Organisasi</h2>${
        u.orgs.length || u.memberOf.length
          ? `<ul class="plain" style="margin:0;padding-left:18px">${u.orgs.map((o) => `<li>Peserta di <b>${esc(o.org)}</b> · ${esc(o.invite)}</li>`).join('')}${u.memberOf
              .map((o) => `<li>Anggota tim <b>${esc(o.org)}</b> (${esc(o.role)})</li>`)
              .join('')}</ul>`
          : '<p class="muted">Tidak terhubung dengan organisasi.</p>'
      }</div>
    </div>
    <div class="card"><h2>Sesi dengan psikolog</h2>${
      u.sessions.length
        ? `<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Sesi</th><th>Psikolog</th><th>Status</th></tr></thead><tbody>${u.sessions
            .map((s) => `<tr><td>${fmtDateTime(s.start_at)}</td><td>${esc(s.title)}</td><td>${esc(s.psychologist || '-')}</td><td>${esc(STATUS_ID[s.status] || s.status)}</td></tr>`)
            .join('')}</tbody></table></div>`
        : '<p class="muted">Belum ada sesi.</p>'
    }</div>
    ${
      self
        ? ''
        : `<div class="card"><h2>Hapus akun</h2><p class="muted">Menghapus akun beserta profil, CV, hasil tes, jadwal, dan keanggotaan organisasi secara permanen. Gunakan saat pengguna meminta datanya dihapus (UU PDP).</p>
      <div class="actions"><button class="btn btn-danger" type="button" id="del">Hapus akun ${esc(u.name)}</button></div></div>`
    }`;
  const save = document.getElementById('saveRole');
  if (save)
    save.addEventListener('click', async () => {
      try {
        await api(`/api/admin/users/${id}`, { method: 'PUT', body: { role: document.getElementById('role').value } });
        document.getElementById('rmsg').innerHTML = '<div class="notice">Peran tersimpan.</div>';
      } catch (err) {
        document.getElementById('rmsg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    });
  const del = document.getElementById('del');
  if (del)
    del.addEventListener('click', async () => {
      const typed = prompt(`Ketik HAPUS untuk menghapus akun ${u.email} secara permanen.`);
      if (typed !== 'HAPUS') return;
      await api(`/api/admin/users/${id}`, { method: 'DELETE' });
      location.hash = '#/pengguna';
    });
}

async function viewOrgs() {
  const main = page('organisasi', loading());
  const { orgs } = await api('/api/org/mine');
  main.innerHTML = `
    <div class="page-head"><div><h1>Organisasi</h1><p>Perusahaan, sekolah, dan biro yang memakai portal organisasi.</p></div>
      <div class="actions"><a class="btn btn-primary" href="/org/#/">${icon(IC.plus)}Buat organisasi</a></div></div>
    ${
      orgs.length
        ? `<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Jenis</th><th><span class="sr-only">Aksi</span></th></tr></thead><tbody>${orgs
            .map((o) => `<tr><td class="nm">${esc(o.name)}</td><td>${esc(ORG_TYPES[o.type] || o.type)}</td><td><a href="/org/#/o/${o.id}">Buka portal</a></td></tr>`)
            .join('')}</tbody></table></div>`
        : '<div class="card"><p class="muted">Belum ada organisasi. Buat dari portal organisasi.</p></div>'
    }`;
}

async function viewInquiries() {
  const main = page('kemitraan', loading());
  const { inquiries } = await api('/api/admin/inquiries');
  main.innerHTML = `
    <div class="page-head"><div><h1>Permintaan kemitraan</h1><p>Masuk dari formulir di halaman depan.</p></div>
      <div class="actions"><button class="btn btn-outline" id="exp" type="button">${icon(IC.download)}Unduh CSV</button></div></div>
    ${
      inquiries.length
        ? inquiries
            .map(
              (q) => `<div class="card">
          <div class="page-head"><div><h2>${esc(q.org_name)} <span class="chip chip-plain">${esc(ORG_TYPES[q.org_type] || q.org_type)}</span></h2>
            <p>${esc(q.contact_name)}${q.position ? ', ' + esc(q.position) : ''} · ${fmtDate(q.created_at)}${q.size ? ' · ' + esc(q.size) + ' peserta' : ''}</p></div>
            <div class="field" style="min-width:180px"><label for="st-${q.id}" class="sr-only">Status</label><select class="input" id="st-${q.id}" data-inq="${q.id}">${Object.entries(INQ_STATUS)
              .map(([k, v]) => `<option value="${k}" ${q.status === k ? 'selected' : ''}>${v}</option>`)
              .join('')}</select></div></div>
          <div class="actions"><a href="mailto:${esc(q.email)}">${esc(q.email)}</a>${
            q.phone ? ` · <a href="https://wa.me/${esc(q.phone.replace(/\D/g, '').replace(/^0/, '62'))}" target="_blank" rel="noopener">WhatsApp ${esc(q.phone)}</a>` : ''
          }</div>
          ${q.message ? `<p style="white-space:pre-line">${esc(q.message)}</p>` : ''}
        </div>`
            )
            .join('')
        : '<div class="card"><p class="muted">Belum ada permintaan kemitraan.</p></div>'
    }`;
  main.querySelectorAll('[data-inq]').forEach((s) =>
    s.addEventListener('change', async () => {
      await api(`/api/admin/inquiries/${s.dataset.inq}`, { method: 'PUT', body: { status: s.value } });
      STATS = await api('/api/admin/stats');
    })
  );
  document.getElementById('exp').addEventListener('click', () =>
    downloadCsv('kemitraan.csv', [
      ['Tanggal', 'Jenis', 'Organisasi', 'Kontak', 'Jabatan', 'WhatsApp', 'Email', 'Jumlah peserta', 'Pesan', 'Status'],
      ...inquiries.map((q) => [q.created_at.slice(0, 10), ORG_TYPES[q.org_type] || q.org_type, q.org_name, q.contact_name, q.position, q.phone, q.email, q.size, q.message, INQ_STATUS[q.status]])
    ])
  );
}

async function render() {
  const { parts, params } = parseHash();
  window.scrollTo(0, 0);
  try {
    if (!ME) {
      ME = await api('/api/me');
      if (!ME.user) return loginScreen(root, 'Admin platform', '/admin/');
      if (!ME.isAdmin) {
        root.innerHTML = `<div class="center-box"><div class="card"><h2>Khusus admin platform</h2><p class="muted">Akun ${esc(ME.user.email)} tidak terdaftar sebagai admin. Tambahkan email ini ke secret <code>ADMIN_EMAILS</code> di Cloudflare.</p><a class="btn btn-outline" href="/app/">Ke aplikasi</a></div></div>`;
        return;
      }
      STATS = await api('/api/admin/stats');
    }
    if (!parts.length) return await viewSummary();
    if (parts[0] === 'pengguna') return parts[1] ? await viewUser(parts[1]) : await viewUsers(params);
    if (parts[0] === 'organisasi') return await viewOrgs();
    if (parts[0] === 'kemitraan') return await viewInquiries();
    location.hash = '#/';
  } catch (err) {
    if (err.handled) return;
    const target = document.getElementById('main') || root;
    target.innerHTML = `<div class="center-box"><div class="error" role="alert">${esc(err.message)}</div></div>`;
  }
}

window.addEventListener('hashchange', render);
render();
