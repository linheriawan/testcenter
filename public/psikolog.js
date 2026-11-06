// Halaman Psikolog — calendar of consultations and assessment sessions, clients, and working hours.

import { esc, makeApi, IC, icon, loading, loginScreen, shell, parseHash, fmtDateTime, fmtDate, DAYS, MONTHS } from '/shared/ui.js';
import { INDEX_NAMES } from '/shared/kraepelin.js';
import { FACTORS as DISC_FACTORS } from '/shared/disc.js';

const root = document.getElementById('root');
const api = makeApi(() => loginScreen(root, 'Halaman psikolog', '/psikolog/'));
let ME = null;

const STATUS = { requested: 'Menunggu konfirmasi', confirmed: 'Terkonfirmasi', done: 'Selesai', cancelled: 'Dibatalkan', declined: 'Ditolak', no_show: 'Tidak hadir' };
const KIND = { consult: 'Konsultasi', assessment: 'Asesmen' };
const HOUR_PX = 48;
const LEVEL_ID = ['', 'Sangat rendah', 'Rendah', 'Sedang', 'Tinggi', 'Sangat tinggi'];

// ---------------- date helpers (all WIB, 'YYYY-MM-DD' / 'YYYY-MM-DDTHH:MM') ----------------

function addDays(date, n) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
}
function weekdayOf(date) {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
function mondayOf(date) {
  return addDays(date, 1 - weekdayOf(date));
}
function minutesOf(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
function hhmm(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
function endOf(a) {
  return hhmm(minutesOf(a.start_at.slice(11)) + a.duration_min);
}
function statusChip(s) {
  return `<span class="chip st-${s}">${esc(STATUS[s] || s)}</span>`;
}

function page(active, content) {
  return shell(
    root,
    {
      subtitle: 'Halaman psikolog',
      title: ME.profile.display_name,
      active,
      items: [
        ['kalender', '#/', IC.calendar, 'Kalender', ME.pending || ''],
        ['daftar', '#/daftar', IC.list, 'Daftar jadwal'],
        ['pengaturan', '#/pengaturan', IC.gear, 'Jam praktik & profil']
      ],
      footer: `<span>${esc(ME.user.email)}</span>${ME.user.isAdmin ? '<a href="/admin/">Admin platform</a>' : ''}<a href="/org/">Portal organisasi</a><a href="/app/">Aplikasi peserta</a>`
    },
    content
  );
}

async function refreshMe() {
  ME = await api('/api/psych/me');
}

// ---------------- calendar ----------------

async function viewCalendar(params) {
  const main = page('kalender', loading());
  const today = ME.now.slice(0, 10);
  const monday = mondayOf(params.get('w') || today);
  const sunday = addDays(monday, 6);
  const showAll = params.get('semua') === '1';
  const [{ appointments }, pending] = await Promise.all([
    api(`/api/psych/appointments?from=${monday}T00:00&to=${addDays(monday, 7)}T00:00`),
    api('/api/psych/appointments?status=requested')
  ]);
  const visible = appointments.filter((a) => showAll || !['cancelled', 'declined'].includes(a.status));
  const av = ME.profile.availability;

  let h0 = Math.floor(minutesOf(av.start) / 60);
  let h1 = Math.ceil(minutesOf(av.end) / 60);
  for (const a of visible) {
    h0 = Math.min(h0, Math.floor(minutesOf(a.start_at.slice(11)) / 60));
    h1 = Math.max(h1, Math.ceil((minutesOf(a.start_at.slice(11)) + a.duration_min) / 60));
  }
  h0 = Math.max(0, Math.min(h0, 8));
  h1 = Math.min(24, Math.max(h1, 17));
  const height = (h1 - h0) * HOUR_PX;
  const top = (time) => ((minutesOf(time) - h0 * 60) / 60) * HOUR_PX;
  const days = [...Array(7)].map((_, i) => addDays(monday, i));
  const label = `${new Date(`${monday}T00:00:00Z`).getUTCDate()} ${MONTHS[new Date(`${monday}T00:00:00Z`).getUTCMonth()]} – ${fmtDate(sunday).replace(/^\w+, /, '')}`;

  const evHtml = (a) => {
    const t = top(a.start_at.slice(11));
    const h = Math.max(22, (a.duration_min / 60) * HOUR_PX - 2);
    const who = a.user_name || a.title;
    return `<a class="cal-ev ${a.kind} ${a.status}" href="#/jadwal/${a.id}" style="top:${t}px;height:${h}px" title="${esc(`${a.start_at.slice(11)}–${endOf(a)} ${who} · ${STATUS[a.status]}`)}">
      <b>${esc(who)}</b>${esc(a.start_at.slice(11))}–${endOf(a)} · ${esc(KIND[a.kind])}${a.org_name ? ' · ' + esc(a.org_name) : ''}</a>`;
  };

  const grid = `<div class="cal-wrap"><div class="cal">
    <div class="cal-head"></div>
    ${days
      .map((d) => {
        const dt = new Date(`${d}T00:00:00Z`);
        return `<div class="cal-head ${d === today ? 'today' : ''}">${DAYS[dt.getUTCDay()]}<b>${dt.getUTCDate()}</b></div>`;
      })
      .join('')}
    <div class="cal-times" style="height:${height}px">${[...Array(h1 - h0)].map((_, i) => `<span style="top:${i * HOUR_PX}px">${hhmm((h0 + i) * 60)}</span>`).join('')}</div>
    ${days
      .map((d) => {
        const working = av.days.includes(weekdayOf(d)) && !(av.blocked || []).includes(d);
        const nowLine = d === today ? `<div class="cal-now" style="top:${top(ME.now.slice(11))}px"></div>` : '';
        return `<div class="cal-day ${(av.blocked || []).includes(d) ? 'blocked' : ''}" data-date="${d}" style="height:${height}px">
          ${working ? `<div class="avail" style="top:${top(av.start)}px;height:${top(av.end) - top(av.start)}px"></div>` : ''}
          ${nowLine}${visible.filter((a) => a.start_at.slice(0, 10) === d).map(evHtml).join('')}
        </div>`;
      })
      .join('')}
  </div></div>`;

  const agenda = `<div class="agenda">${
    days
      .map((d) => {
        const list = visible.filter((a) => a.start_at.slice(0, 10) === d);
        if (!list.length) return '';
        return `<div class="agenda-day">${fmtDate(d)}</div>${list
          .map(
            (a) => `<a href="#/jadwal/${a.id}"><span class="t">${esc(a.start_at.slice(11))}</span><span style="flex:1"><b>${esc(a.user_name || a.title)}</b><br><span class="small muted">${esc(KIND[a.kind])} · ${a.duration_min} menit${a.org_name ? ' · ' + esc(a.org_name) : ''}</span></span>${statusChip(a.status)}</a>`
          )
          .join('')}`;
      })
      .join('') || '<p class="muted">Tidak ada jadwal minggu ini.</p>'
  }</div>`;

  const pend = pending.appointments;
  main.innerHTML = `
    <div class="page-head">
      <div><h1>Kalender</h1><p>${label}</p></div>
      <div class="actions">
        <a class="btn btn-outline" href="#/?w=${addDays(monday, -7)}" aria-label="Minggu sebelumnya">${icon(IC.back)}</a>
        <a class="btn btn-outline" href="#/">Hari ini</a>
        <a class="btn btn-outline" href="#/?w=${addDays(monday, 7)}" aria-label="Minggu berikutnya">${icon(IC.next)}</a>
        <a class="btn btn-primary" href="#/jadwal/baru">${icon(IC.plus)}Jadwal baru</a>
      </div>
    </div>
    ${
      pend.length
        ? `<div class="card" style="border-color:#F5C89B"><h2>Menunggu konfirmasi (${pend.length})</h2>
      <div class="table-wrap"><table><tbody>${pend
        .map(
          (a) => `<tr><td style="white-space:nowrap">${fmtDateTime(a.start_at)}</td><td><b>${esc(a.user_name || '-')}</b><div class="small muted">${esc(a.title)} · ${a.duration_min} menit${a.user_note ? ' · “' + esc(a.user_note) + '”' : ''}</div></td>
          <td style="white-space:nowrap;text-align:right"><button class="btn btn-primary" type="button" data-act="confirm" data-id="${a.id}">Konfirmasi</button> <button class="btn btn-outline" type="button" data-act="decline" data-id="${a.id}">Tolak</button> <a href="#/jadwal/${a.id}">Detail</a></td></tr>`
        )
        .join('')}</tbody></table></div>
      <p class="small muted">Setelah dikonfirmasi, tambahkan tautan Google Meet atau Zoom di detail jadwal agar muncul di aplikasi klien.</p></div>`
        : ''
    }
    <div class="legend"><span><i style="background:#FFF3E6;border:1px dashed #C2410C"></i>Menunggu</span><span><i style="background:#E3E5FB;border:1px solid #3A3FD8"></i>Konsultasi</span><span><i style="background:#DDF3EE;border:1px solid #0F7B6C"></i>Asesmen</span><span><i style="background:rgba(58,63,216,.08);border:1px solid #D0D5DE"></i>Jam praktik</span>
      <a href="#/?w=${monday}${showAll ? '' : '&semua=1'}">${showAll ? 'Sembunyikan yang dibatalkan' : 'Tampilkan yang dibatalkan'}</a></div>
    ${grid}${agenda}
    <p class="small muted">Klik area kosong di kalender untuk membuat jadwal pada jam tersebut. Semua waktu dalam WIB.</p>`;

  main.querySelectorAll('.cal-day').forEach((col) =>
    col.addEventListener('click', (e) => {
      if (e.target.closest('.cal-ev')) return;
      const rect = col.getBoundingClientRect();
      const min = h0 * 60 + Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30;
      location.hash = `#/jadwal/baru?start=${col.dataset.date}T${hhmm(Math.max(0, Math.min(min, 23 * 60 + 30)))}`;
    })
  );
  main.querySelectorAll('[data-act]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (b.dataset.act === 'decline' && !confirm('Tolak permintaan konsultasi ini?')) return;
      b.disabled = true;
      await api(`/api/psych/appointments/${b.dataset.id}`, { method: 'PUT', body: { action: b.dataset.act } });
      await refreshMe();
      render();
    })
  );
}

// ---------------- list ----------------

async function viewList(params) {
  const main = page('daftar', loading());
  const scope = params.get('lihat') || 'mendatang';
  const today = ME.now.slice(0, 10);
  const range = scope === 'lalu' ? `from=${addDays(today, -90)}T00:00&to=${ME.now}` : `from=${ME.now.slice(0, 10)}T00:00&to=${addDays(today, 120)}T00:00`;
  const { appointments } = await api(`/api/psych/appointments?${range}`);
  const list = scope === 'lalu' ? [...appointments].reverse() : appointments;
  main.innerHTML = `
    <div class="page-head"><div><h1>Daftar jadwal</h1><p>${scope === 'lalu' ? '90 hari terakhir' : 'Mulai hari ini'}</p></div>
      <div class="actions"><a class="btn ${scope !== 'lalu' ? 'btn-primary' : 'btn-outline'}" href="#/daftar">Mendatang</a><a class="btn ${scope === 'lalu' ? 'btn-primary' : 'btn-outline'}" href="#/daftar?lihat=lalu">Sudah lewat</a></div></div>
    ${
      list.length
        ? `<div class="table-wrap"><table><thead><tr><th>Waktu</th><th>Klien</th><th>Jenis</th><th>Status</th><th><span class="sr-only">Aksi</span></th></tr></thead><tbody>${list
            .map(
              (a) => `<tr><td style="white-space:nowrap">${fmtDateTime(a.start_at)}–${endOf(a)}</td>
              <td><b>${esc(a.user_name || a.title)}</b><div class="small muted">${esc(a.user_email || '')}${a.org_name ? ' · ' + esc(a.org_name) : ''}</div></td>
              <td>${esc(KIND[a.kind])}<div class="small muted">${esc(a.title)}</div></td><td>${statusChip(a.status)}</td>
              <td><a href="#/jadwal/${a.id}">Detail</a></td></tr>`
            )
            .join('')}</tbody></table></div>`
        : '<div class="card"><p class="muted">Tidak ada jadwal.</p></div>'
    }`;
}

// ---------------- appointment detail ----------------

async function viewAppointment(id) {
  const main = page('kalender', loading());
  const { appointment: a } = await api(`/api/psych/appointments/${id}`);
  const actions = {
    requested: [['confirm', 'Konfirmasi', 'btn-primary'], ['decline', 'Tolak', 'btn-outline']],
    confirmed: [['done', 'Tandai selesai', 'btn-primary'], ['noshow', 'Tidak hadir', 'btn-outline'], ['cancel', 'Batalkan', 'btn-danger']]
  }[a.status] || [];
  const editable = ['requested', 'confirmed'].includes(a.status);
  main.innerHTML = `
    <div class="report-bar"><a class="btn btn-outline" href="#/?w=${mondayOf(a.start_at.slice(0, 10))}">${icon(IC.back)}Kalender</a></div>
    <div class="page-head"><div><h1>${esc(a.user_name || a.title)}</h1><p>${esc(KIND[a.kind])} · ${esc(a.title)}${a.org_name ? ' · ' + esc(a.org_name) : ''}</p></div><div>${statusChip(a.status)}</div></div>
    <div class="grid cols-2">
      <div class="card">
        <h2>Jadwal</h2>
        <dl class="kv"><dt>Waktu</dt><dd>${fmtDateTime(a.start_at)}–${endOf(a)} WIB</dd><dt>Durasi</dt><dd>${a.duration_min} menit</dd>
          ${a.user_email ? `<dt>Email klien</dt><dd><a href="mailto:${esc(a.user_email)}">${esc(a.user_email)}</a></dd>` : ''}
          ${a.meeting_link ? `<dt>Tautan</dt><dd><a href="${esc(a.meeting_link)}" target="_blank" rel="noopener">Buka</a></dd>` : ''}</dl>
        ${a.user_note ? `<div><b class="small">Catatan dari klien</b><p style="white-space:pre-line">${esc(a.user_note)}</p></div>` : ''}
        ${a.user_id ? `<a class="btn btn-outline" href="#/klien/${a.user_id}">Lihat profil &amp; hasil tes klien</a>` : ''}
        ${actions.length ? `<div class="actions">${actions.map(([k, l, c]) => `<button class="btn ${c}" type="button" data-act="${k}">${l}</button>`).join('')}</div>` : ''}
        <div id="amsg"></div>
      </div>
      <form class="card" id="ef">
        <h2>Ubah jadwal</h2>
        <div class="grid cols-form">
          <div class="field"><label for="edate">Tanggal</label><input class="input" id="edate" type="date" value="${a.start_at.slice(0, 10)}" ${editable ? '' : 'disabled'}></div>
          <div class="field"><label for="etime">Jam (WIB)</label><input class="input" id="etime" type="time" step="900" value="${a.start_at.slice(11)}" ${editable ? '' : 'disabled'}></div>
          <div class="field"><label for="edur">Durasi (menit)</label><input class="input" id="edur" type="number" min="15" max="480" step="15" value="${a.duration_min}" ${editable ? '' : 'disabled'}></div>
        </div>
        <div class="field"><label for="elink">Tautan rapat atau lokasi</label><input class="input" id="elink" value="${esc(a.meeting_link || '')}" placeholder="https://meet.google.com/…" maxlength="300"><span class="hint">Terlihat oleh klien di aplikasi setelah jadwal dikonfirmasi.</span></div>
        <div class="field"><label for="enote">Catatan psikolog (pribadi)</label><textarea class="input" id="enote" maxlength="3000" placeholder="Hanya terlihat oleh Anda. Disimpan terenkripsi.">${esc(a.psych_note || '')}</textarea></div>
        <div id="emsg"></div>
        <div class="actions"><button class="btn btn-primary" type="submit">Simpan</button></div>
      </form>
    </div>`;
  main.querySelectorAll('[data-act]').forEach((b) =>
    b.addEventListener('click', async () => {
      if (['cancel', 'decline'].includes(b.dataset.act) && !confirm('Yakin? Klien akan melihat perubahan status ini di aplikasi.')) return;
      try {
        const body = { action: b.dataset.act };
        if (b.dataset.act === 'confirm') body.meeting_link = document.getElementById('elink').value;
        await api(`/api/psych/appointments/${id}`, { method: 'PUT', body });
        await refreshMe();
        render();
      } catch (err) {
        document.getElementById('amsg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
      }
    })
  );
  document.getElementById('ef').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { meeting_link: document.getElementById('elink').value, psych_note: document.getElementById('enote').value };
    if (editable) {
      body.start_at = `${document.getElementById('edate').value}T${document.getElementById('etime').value}`;
      body.duration_min = Number(document.getElementById('edur').value);
    }
    try {
      await api(`/api/psych/appointments/${id}`, { method: 'PUT', body });
      document.getElementById('emsg').innerHTML = '<div class="notice">Tersimpan.</div>';
    } catch (err) {
      document.getElementById('emsg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  });
}

// ---------------- new appointment ----------------

async function viewNew(params) {
  const start = params.get('start') || `${addDays(ME.now.slice(0, 10), 1)}T${ME.profile.availability.start}`;
  page(
    'kalender',
    `<div class="report-bar"><a class="btn btn-outline" href="#/?w=${mondayOf(start.slice(0, 10))}">${icon(IC.back)}Kalender</a></div>
    <div class="page-head"><div><h1>Jadwal baru</h1><p>Untuk sesi asesmen (wawancara, LGD, umpan balik) atau konsultasi yang Anda atur sendiri.</p></div></div>
    <form class="card" id="nf" style="max-width:760px">
      <div class="grid cols-form">
        <div class="field"><label for="nkind">Jenis</label><select class="input" id="nkind"><option value="assessment">Asesmen</option><option value="consult">Konsultasi</option></select></div>
        <div class="field"><label for="ntitle">Judul</label><input class="input" id="ntitle" maxlength="160" placeholder="mis. Wawancara kompetensi"></div>
      </div>
      <div class="field"><label for="nq">Klien atau peserta <span class="hint">(opsional)</span></label>
        <input class="input" id="nq" placeholder="Ketik nama, NIK, atau email peserta organisasi Anda" autocomplete="off">
        <div id="picked"></div><div class="people-pick" id="pres"></div>
        <span class="hint">Peserta organisasi dicari dari organisasi tempat Anda menjadi anggota. Pengguna aplikasi lain bisa dicari dengan email lengkap.</span></div>
      <div class="grid cols-form">
        <div class="field"><label for="ndate">Tanggal</label><input class="input" id="ndate" type="date" value="${start.slice(0, 10)}" required></div>
        <div class="field"><label for="ntime">Jam (WIB)</label><input class="input" id="ntime" type="time" step="900" value="${start.slice(11, 16)}" required></div>
        <div class="field"><label for="ndur">Durasi</label><select class="input" id="ndur">${[30, 45, 60, 90, 120, 180, 240]
          .map((m) => `<option value="${m}" ${m === 60 ? 'selected' : ''}>${m} menit</option>`)
          .join('')}</select></div>
      </div>
      <div class="field"><label for="nlink">Tautan rapat atau lokasi</label><input class="input" id="nlink" maxlength="300" placeholder="https://meet.google.com/… atau Ruang rapat lt. 3"></div>
      <div class="field"><label for="nnote">Catatan pribadi</label><textarea class="input" id="nnote" maxlength="3000"></textarea></div>
      <div id="nmsg"></div>
      <div class="actions"><button class="btn btn-primary" type="submit">Simpan jadwal</button></div>
    </form>`
  );
  let picked = null;
  const q = document.getElementById('nq');
  const res = document.getElementById('pres');
  const drawPicked = () => {
    document.getElementById('picked').innerHTML = picked
      ? `<p><span class="chip rec-dipertimbangkan" style="padding:6px 10px">${esc(picked.name)} · ${esc(picked.email)}${picked.org_name ? ' · ' + esc(picked.org_name) : ''}</span> <button class="link" type="button" id="unpick">Hapus</button></p>`
      : '';
    const u = document.getElementById('unpick');
    if (u)
      u.addEventListener('click', () => {
        picked = null;
        drawPicked();
      });
  };
  let t;
  q.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      if (q.value.trim().length < 2) {
        res.innerHTML = '';
        return;
      }
      const { people } = await api(`/api/psych/people?q=${encodeURIComponent(q.value.trim())}`);
      res.innerHTML = people.length
        ? people
            .map((p, i) => `<button type="button" data-i="${i}"><b>${esc(p.name)}</b> <span class="small muted">${esc(p.email)}${p.org_name ? ' · ' + esc(p.org_name) + ' · ' + esc(p.invite_name) : ''}</span></button>`)
            .join('')
        : '<span class="small muted">Tidak ditemukan.</span>';
      res.querySelectorAll('button').forEach((b) =>
        b.addEventListener('click', () => {
          picked = people[Number(b.dataset.i)];
          res.innerHTML = '';
          q.value = '';
          drawPicked();
        })
      );
    }, 300);
  });
  document.getElementById('nf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      kind: document.getElementById('nkind').value,
      title: document.getElementById('ntitle').value,
      start_at: `${document.getElementById('ndate').value}T${document.getElementById('ntime').value}`,
      duration_min: Number(document.getElementById('ndur').value),
      meeting_link: document.getElementById('nlink').value,
      psych_note: document.getElementById('nnote').value
    };
    if (picked) {
      if (picked.participant_id) body.participant_id = picked.participant_id;
      else body.user_id = picked.user_id;
    }
    try {
      const r = await api('/api/psych/appointments', { method: 'POST', body });
      location.hash = `#/jadwal/${r.id}`;
    } catch (err) {
      document.getElementById('nmsg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  });
}

// ---------------- client ----------------

function spark(values) {
  if (!values || values.length < 2) return '';
  const w = 600;
  const h = 70;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 8) - 4).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" role="img" aria-label="Jawaban per kolom"><polyline points="${pts}" fill="none" stroke="#3A3FD8" stroke-width="2" vector-effect="non-scaling-stroke"></polyline></svg>`;
}

async function viewClient(id) {
  const main = page('kalender', loading());
  const { client: c } = await api(`/api/psych/clients/${id}`);
  const r = c.results || {};
  const SEG = { student: 'Pelajar', jobseeker: 'Pencari kerja' };
  main.innerHTML = `
    <div class="report-bar"><button class="btn btn-outline" type="button" onclick="history.back()">${icon(IC.back)}Kembali</button></div>
    <div class="page-head"><div><h1>${esc(c.name)}</h1><p>${esc(c.email)} · pengguna sejak ${fmtDate(c.created_at)}</p></div></div>
    <div class="grid cols-2">
      <div class="card"><h2>Profil</h2>${
        c.profile
          ? `<dl class="kv"><dt>Segmen</dt><dd>${esc(SEG[c.profile.segment] || '-')}</dd><dt>Pendidikan</dt><dd>${esc(c.profile.education_level || '-')}</dd><dt>Bidang</dt><dd>${esc(c.profile.field || '-')}</dd><dt>Sekolah/kampus</dt><dd>${esc(c.profile.school || '-')}</dd></dl>
             ${c.profile.skills.length ? `<p class="small"><b>Keterampilan:</b> ${c.profile.skills.map(esc).join(', ')}</p>` : ''}`
          : '<p class="muted">Belum mengisi profil.</p>'
      }</div>
      <div class="card"><h2>Riwayat sesi dengan Anda</h2>${
        c.history.length
          ? `<ul class="plain" style="margin:0;padding-left:18px">${c.history.map((h) => `<li><a href="#/jadwal/${h.id}">${fmtDateTime(h.start_at)}</a> · ${esc(h.title)} · ${esc(STATUS[h.status])}</li>`).join('')}</ul>`
          : '<p class="muted">Belum ada.</p>'
      }</div>
    </div>
    ${
      r.type16
        ? `<div class="card"><h2>16 Tipe · ${esc(r.type16.code)} – ${esc(r.type16.title)}</h2><div class="bars">${r.type16.dimensions
            .map((d) => `<div class="bar-row"><span>${esc(d.aName)} / ${esc(d.bName)}</span><span class="track"><div style="width:${d.aPct}%;background:#3A3FD8"></div></span><span class="val">${d.aPct}% / ${d.bPct}%</span></div>`)
            .join('')}</div><p class="small muted">Dikerjakan ${fmtDate(r.type16.completedAt)}</p></div>`
        : ''
    }
    ${
      r.bigfive
        ? `<div class="card"><h2>Big Five</h2><div class="bars">${r.bigfive.traits
            .map((t) => `<div class="bar-row"><span>${esc(t.name)}</span><span class="track"><div style="width:${t.pct}%;background:#0F7B6C"></div></span><span class="val">${t.pct}%</span></div>`)
            .join('')}</div><p class="small muted">Dikerjakan ${fmtDate(r.bigfive.completedAt)}</p></div>`
        : ''
    }
    ${
      r.disc
        ? `<div class="card"><h2>DISC · ${esc(r.disc.code)}</h2><p>${esc(DISC_FACTORS[r.disc.primary].descId)}</p><div class="bars">${'DISC'
            .split('')
            .map((f) => `<div class="bar-row"><span>${f} · ${esc(DISC_FACTORS[f].id)}</span><span class="track"><div style="width:${((r.disc.change[f] + 24) / 48) * 100}%;background:#9F1D14"></div></span><span class="val">${r.disc.change[f] > 0 ? '+' : ''}${r.disc.change[f]}</span></div>`)
            .join('')}</div><p class="small muted">Most ${'DISC'.split('').map((f) => f + r.disc.most[f]).join(' ')} · Least ${'DISC'.split('').map((f) => f + r.disc.least[f]).join(' ')} · dikerjakan ${fmtDate(r.disc.completedAt)}</p></div>`
        : ''
    }
    ${
      r.kraepelin
        ? `<div class="card"><h2>Kraepelin</h2><div class="grid cols-4">${['speed', 'accuracy', 'consistency', 'endurance']
            .map((k) => `<div class="kpi"><span>${INDEX_NAMES[k]}</span><b style="font-size:20px">${LEVEL_ID[r.kraepelin.levels[k]]}</b></div>`)
            .join('')}</div>${spark(r.kraepelin.perColumn)}<p class="small muted">${r.kraepelin.speed} jawaban/kolom · ${r.kraepelin.errorRate}% salah${
            r.kraepelin.tabSwitches ? ` · berpindah tab ${r.kraepelin.tabSwitches} kali` : ''
          } · dikerjakan ${fmtDate(r.kraepelin.completedAt)}</p></div>`
        : ''
    }
    ${
      c.insights
        ? `<div class="card"><h2>Rekomendasi AI yang dilihat klien</h2><p>${esc(c.insights.summary)}</p><ul class="plain" style="margin:0;padding-left:18px">${c.insights.matches
            .map((m) => `<li><b>${esc(m.title)}</b> – ${esc(m.why)}</li>`)
            .join('')}</ul></div>`
        : ''
    }
    ${!r.type16 && !r.bigfive && !r.kraepelin && !r.disc ? '<div class="card"><p class="muted">Klien belum mengerjakan tes.</p></div>' : ''}`;
}

// ---------------- settings ----------------

async function viewSettings() {
  await refreshMe();
  const p = ME.profile;
  const av = p.availability;
  const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
  let blocked = [...(av.blocked || [])];
  page(
    'pengaturan',
    `<div class="page-head"><div><h1>Jam praktik &amp; profil</h1><p>Profil dan jam praktik ini dilihat pengguna saat memesan konsultasi di aplikasi.</p></div></div>
    <form class="grid cols-2" id="sf" style="align-items:start">
      <div class="card">
        <h2>Profil</h2>
        <div class="field"><label for="pn">Nama tampilan</label><input class="input" id="pn" value="${esc(p.display_name)}" maxlength="160" required placeholder="mis. Nama, M.Psi., Psikolog"></div>
        <div class="field"><label for="pt">Keahlian</label><input class="input" id="pt" value="${esc(p.title || '')}" maxlength="160" placeholder="mis. Psikolog pendidikan & karier"></div>
        <div class="field"><label for="ps">Nomor SIPP</label><input class="input" id="ps" value="${esc(p.sipp || '')}" maxlength="80"></div>
        <div class="field"><label for="pb">Tentang saya</label><textarea class="input" id="pb" maxlength="1000">${esc(p.bio || '')}</textarea></div>
        <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="pa" ${p.active ? 'checked' : ''}> Terima konsultasi baru dari aplikasi</label>
      </div>
      <div class="card">
        <h2>Jam praktik</h2>
        <fieldset style="border:0;padding:0;margin:0" class="field"><legend style="font-size:13px;font-weight:600;margin-bottom:6px">Hari praktik</legend>
          <div class="daypick">${[1, 2, 3, 4, 5, 6, 7]
            .map((d) => `<label><input type="checkbox" name="day" value="${d}" ${av.days.includes(d) ? 'checked' : ''}> ${dayNames[d]}</label>`)
            .join('')}</div></fieldset>
        <div class="grid cols-form">
          <div class="field"><label for="as">Mulai</label><input class="input" id="as" type="time" step="1800" value="${av.start}"></div>
          <div class="field"><label for="ae">Selesai</label><input class="input" id="ae" type="time" step="1800" value="${av.end}"></div>
          <div class="field"><label for="al">Panjang slot</label><select class="input" id="al">${[30, 45, 60, 90].map((m) => `<option value="${m}" ${av.slot === m ? 'selected' : ''}>${m} menit</option>`).join('')}</select></div>
        </div>
        <div class="field"><label for="bd">Hari libur / tidak praktik</label>
          <div class="actions"><input class="input" id="bd" type="date" style="max-width:200px"><button class="btn btn-outline" type="button" id="addb">Tambah</button></div>
          <div class="actions" id="blist"></div></div>
      </div>
      <div id="smsg" style="grid-column:1/-1"></div>
      <div style="grid-column:1/-1"><button class="btn btn-primary btn-lg" type="submit">Simpan</button></div>
    </form>`
  );
  const drawBlocked = () => {
    document.getElementById('blist').innerHTML = blocked.length
      ? blocked
          .sort()
          .map((d) => `<span class="chip chip-plain" style="padding:6px 10px">${fmtDate(d)} <button class="link" type="button" data-rm="${d}" aria-label="Hapus ${d}">×</button></span>`)
          .join('')
      : '<span class="small muted">Tidak ada.</span>';
    document.querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', () => {
        blocked = blocked.filter((x) => x !== b.dataset.rm);
        drawBlocked();
      })
    );
  };
  drawBlocked();
  document.getElementById('addb').addEventListener('click', () => {
    const v = document.getElementById('bd').value;
    if (v && !blocked.includes(v)) blocked.push(v);
    drawBlocked();
  });
  document.getElementById('sf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      display_name: document.getElementById('pn').value,
      title: document.getElementById('pt').value,
      sipp: document.getElementById('ps').value,
      bio: document.getElementById('pb').value,
      active: document.getElementById('pa').checked,
      availability: {
        days: [...document.querySelectorAll('input[name=day]:checked')].map((x) => Number(x.value)),
        start: document.getElementById('as').value,
        end: document.getElementById('ae').value,
        slot: Number(document.getElementById('al').value),
        blocked
      }
    };
    try {
      await api('/api/psych/me', { method: 'PUT', body });
      await refreshMe();
      document.getElementById('smsg').innerHTML = '<div class="notice">Tersimpan.</div>';
      document.querySelector('.org-name b').textContent = ME.profile.display_name;
    } catch (err) {
      document.getElementById('smsg').innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }
  });
}

// ---------------- router ----------------

async function render() {
  const { parts, params } = parseHash();
  window.scrollTo(0, 0);
  try {
    if (!ME) {
      const me = await api('/api/me');
      if (!me.user) return loginScreen(root, 'Halaman psikolog', '/psikolog/');
      if (!me.isPsychologist && !me.isAdmin) {
        root.innerHTML = `<div class="center-box"><div class="card"><h2>Khusus psikolog</h2><p class="muted">Akun ${esc(me.user.email)} belum terdaftar sebagai psikolog. Minta admin platform mengubah peran akun Anda.</p><a class="btn btn-outline" href="/app/">Ke aplikasi</a></div></div>`;
        return;
      }
      await refreshMe();
    }
    if (!parts.length) return await viewCalendar(params);
    if (parts[0] === 'daftar') return await viewList(params);
    if (parts[0] === 'pengaturan') return await viewSettings();
    if (parts[0] === 'klien' && parts[1]) return await viewClient(parts[1]);
    if (parts[0] === 'jadwal' && parts[1] === 'baru') return await viewNew(params);
    if (parts[0] === 'jadwal' && parts[1]) return await viewAppointment(parts[1]);
    location.hash = '#/';
  } catch (err) {
    if (err.handled) return;
    const target = document.getElementById('main') || root;
    target.innerHTML = `<div class="center-box"><div class="error" role="alert">${esc(err.message)}</div><a class="btn btn-outline" href="#/">Kalender</a></div>`;
  }
}

window.addEventListener('hashchange', render);
render();
