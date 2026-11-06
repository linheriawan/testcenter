// Test Center — single-page app (vanilla JS, hash routing).

import { columnDigits, expected } from '/shared/kraepelin.js';

const app = document.getElementById('app');
const state = { user: null, hasProfile: false };

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
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    state.user = null;
    go('#/login');
    throw new Error(data.error || 'Please log in');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// After logging in from the organization portal, send the user back there.
function goNext() {
  let next = null;
  try {
    next = sessionStorage.getItem('tc_next');
    sessionStorage.removeItem('tc_next');
  } catch {
    next = null;
  }
  if (next && next.startsWith('/org/')) {
    location.href = next;
    return true;
  }
  if (next && /^#\/join\/[A-Z0-9]+$/.test(next)) {
    go(next);
    return true;
  }
  return false;
}

function go(hash) {
  if (location.hash === hash) render();
  else location.hash = hash;
}

function store(key, value) {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: progress just isn't saved */
  }
}

function load(key) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}

const ICONS = {
  back: '<path d="M15 18l-6-6 6-6"></path>',
  close: '<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"></path>',
  chart: '<path d="M4 20V10"></path><path d="M10 20V4"></path><path d="M16 20v-7"></path><path d="M22 20H2"></path>',
  chat: '<path d="M21 12a8 8 0 0 1-11.8 7L3 21l2-6.2A8 8 0 1 1 21 12z"></path>',
  user: '<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>',
  plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
  compass: '<circle cx="12" cy="12" r="9"></circle><path d="M15.5 8.5l-2 5-5 2 2-5z"></path>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"></path>'
};

function icon(name, size = 22, color = 'currentColor') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

function topbar(title, backHash, iconName = 'back') {
  return `<div class="topbar">
    <a class="icon-btn" href="${backHash}" aria-label="${iconName === 'close' ? 'Close' : 'Back'}">${icon(iconName)}</a>
    <span class="title">${esc(title)}</span>
    <span style="width:34px"></span>
  </div>`;
}

function nav(active) {
  const items = [
    ['#/home', 'home', 'Home'],
    ['#/results', 'chart', 'Results'],
    ['#/consult', 'chat', 'Consult'],
    ['#/account', 'user', 'Account']
  ];
  return `<nav class="nav" aria-label="Main">${items
    .map(([h, i, label]) => `<a href="${h}" class="${active === h ? 'on' : ''}" ${active === h ? 'aria-current="page"' : ''}>${icon(i)}${label}</a>`)
    .join('')}</nav>`;
}

function showError(el, message) {
  el.innerHTML = message ? `<div class="error" role="alert">${esc(message)}</div>` : '';
}

function loading(text = 'Loading…') {
  app.className = 'app';
  app.innerHTML = `<div class="loading"><div class="spinner"></div>${esc(text)}</div>`;
}

// ---------------- auth screens ----------------

function viewRegister() {
  app.className = 'app';
  app.innerHTML = `<section class="screen">
    <a class="brand" href="/" style="text-decoration:none;color:inherit"><span class="brand-mark">${icon('compass', 20, '#FFFFFF')}</span>Test Center</a>
    <div class="stack-sm">
      <h1 class="h1">Find the path that fits you</h1>
      <p class="lead">Personality and interest tests, reviewed by a licensed psychologist.</p>
    </div>
    <form id="f" class="stack" novalidate>
      <div class="field"><label for="name">Full name</label><input class="input" id="name" name="name" autocomplete="name" placeholder="As on your ID card" required></div>
      <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" placeholder="you@email.com" required></div>
      <div class="field"><label for="phone">WhatsApp number</label><input class="input" id="phone" name="phone" type="tel" autocomplete="tel" placeholder="08xx xxxx xxxx"></div>
      <div class="field"><label for="password">Password</label><input class="input" id="password" name="password" type="password" autocomplete="new-password" placeholder="At least 8 characters" required minlength="8"></div>
      <div class="check"><input id="consent" name="consent" type="checkbox"><label for="consent">I agree to the Terms and to the processing of my personal data as described in the Privacy Policy (UU PDP).</label></div>
      <div id="err"></div>
      <button class="btn btn-primary" type="submit">Create account</button>
    </form>
    <p class="small center" style="font-size:14px">Already have an account? <a href="#/login"><b>Log in</b></a></p>
  </section>`;
  const f = document.getElementById('f');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const d = await api('/api/auth/register', {
        method: 'POST',
        body: { name: f.name.value, email: f.email.value, phone: f.phone.value, password: f.password.value, consent: f.consent.checked }
      });
      state.user = d.user;
      state.hasProfile = false;
      if (goNext()) return;
      go('#/profile');
    } catch (err) {
      showError(document.getElementById('err'), err.message);
      btn.disabled = false;
    }
  });
}

function viewLogin() {
  app.className = 'app';
  app.innerHTML = `<section class="screen">
    <a class="brand" href="/" style="text-decoration:none;color:inherit"><span class="brand-mark">${icon('compass', 20, '#FFFFFF')}</span>Test Center</a>
    <div class="stack-sm">
      <h1 class="h1">Welcome back</h1>
      <p class="lead">Log in to continue your tests and see your results.</p>
    </div>
    <form id="f" class="stack" novalidate>
      <div class="field"><label for="email">Email</label><input class="input" id="email" name="email" type="email" autocomplete="email" required></div>
      <div class="field"><label for="password">Password</label><input class="input" id="password" name="password" type="password" autocomplete="current-password" required></div>
      <div id="err"></div>
      <button class="btn btn-primary" type="submit">Log in</button>
    </form>
    <p class="small center" style="font-size:14px">New here? <a href="#/register"><b>Create an account</b></a></p>
  </section>`;
  const f = document.getElementById('f');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      const d = await api('/api/auth/login', { method: 'POST', body: { email: f.email.value, password: f.password.value } });
      state.user = d.user;
      const m = await api('/api/me');
      state.hasProfile = m.hasProfile;
      state.hasOrg = !!m.hasOrg;
      if (goNext()) return;
      go(state.hasProfile ? '#/home' : '#/profile');
    } catch (err) {
      showError(document.getElementById('err'), err.message);
      btn.disabled = false;
    }
  });
}

// ---------------- profile & CV ----------------

const EDU_OPTIONS = {
  student: ['SMA/SMK – Grade 10', 'SMA/SMK – Grade 11', 'SMA/SMK – Grade 12', 'University – Year 1–2', 'University – Year 3+'],
  jobseeker: ['SMA/SMK', 'Diploma (D3/D4)', 'Bachelor (S1)', 'Master (S2)', 'Doctorate (S3)']
};

const ENTRY_FIELDS = {
  education: [
    ['institution', 'School / university', 'e.g. Universitas Indonesia'],
    ['degree', 'Level', 'e.g. S1'],
    ['major', 'Major', 'e.g. Informatics'],
    ['start', 'From', '2019'],
    ['end', 'To', '2023']
  ],
  experience: [
    ['title', 'Role', 'e.g. Data Intern'],
    ['company', 'Organization', 'e.g. PT Contoh'],
    ['start', 'From', '2023'],
    ['end', 'To', 'Now'],
    ['description', 'What you did', 'Main tasks and achievements']
  ],
  certifications: [
    ['name', 'Certificate', 'e.g. Google Data Analytics'],
    ['issuer', 'Issued by', 'e.g. Coursera'],
    ['year', 'Year', '2024']
  ]
};

let draft = null;

function collectProfile() {
  const f = document.getElementById('pf');
  if (!f) return;
  draft.education_level = f.education_level.value;
  draft.field = f.field.value;
  draft.school = f.school.value;
  draft.summary = f.summary.value;
  for (const kind of Object.keys(ENTRY_FIELDS)) {
    draft[kind] = draft[kind].map((_, i) => {
      const item = {};
      for (const [key] of ENTRY_FIELDS[kind]) {
        const el = f.querySelector(`[name="${kind}.${i}.${key}"]`);
        item[key] = el ? el.value : '';
      }
      return item;
    });
  }
  const skillInput = f.querySelector('#skill');
  if (skillInput && skillInput.value.trim()) addSkills(skillInput.value);
}

function addSkills(text) {
  for (const s of text.split(',').map((x) => x.trim()).filter(Boolean)) {
    if (!draft.skills.some((k) => k.toLowerCase() === s.toLowerCase()) && draft.skills.length < 40) draft.skills.push(s.slice(0, 60));
  }
}

function entryBlock(kind, item, i) {
  const fields = ENTRY_FIELDS[kind];
  const input = ([key, label, ph]) => {
    const id = `${kind}-${i}-${key}`;
    const name = `${kind}.${i}.${key}`;
    const control =
      key === 'description'
        ? `<textarea class="input" id="${id}" name="${name}" placeholder="${esc(ph)}" maxlength="1000">${esc(item[key])}</textarea>`
        : `<input class="input" id="${id}" name="${name}" value="${esc(item[key])}" placeholder="${esc(ph)}">`;
    return `<div class="field"><label for="${id}">${label}</label>${control}</div>`;
  };
  const small = fields.filter(([k]) => ['start', 'end', 'degree', 'year'].includes(k));
  const big = fields.filter(([k]) => !['start', 'end', 'degree', 'year'].includes(k));
  return `<div class="entry">
    ${big.filter(([k]) => k !== 'description').map(input).join('')}
    ${small.length ? `<div class="grid-${small.length >= 3 ? 3 : 2}">${small.map(input).join('')}</div>` : ''}
    ${big.filter(([k]) => k === 'description').map(input).join('')}
    <button type="button" class="link-btn danger" data-remove="${kind}" data-index="${i}" style="align-self:flex-start">Remove</button>
  </div>`;
}

function section(kind, title, hint, addLabel) {
  return `<div class="stack-sm">
    <div class="row between"><h2 class="h2">${title}</h2></div>
    ${hint ? `<p class="small">${hint}</p>` : ''}
    ${draft[kind].map((item, i) => entryBlock(kind, item, i)).join('')}
    <button type="button" class="btn btn-outline btn-sm" data-add="${kind}" style="align-self:flex-start">${icon('plus', 18)}${addLabel}</button>
  </div>`;
}

function renderProfileForm() {
  const student = draft.segment === 'student';
  const opts = EDU_OPTIONS[draft.segment] || EDU_OPTIONS.jobseeker;
  app.className = 'app';
  app.innerHTML = `<section class="screen">
    ${topbar(state.hasProfile ? 'Edit profile' : 'Step 2 of 2', state.hasProfile ? '#/account' : '#/home')}
    ${state.hasProfile ? '' : '<div class="progress"><div style="width:100%"></div></div>'}
    <div class="stack-sm">
      <h1 class="h1" style="font-size:24px">Tell us about you</h1>
      <p class="lead" style="font-size:14px">This shapes your tests and your ${student ? 'major' : 'career'} matches. Your CV details are encrypted and only you and your psychologist can see them.</p>
    </div>
    <form id="pf" class="stack" novalidate>
      <div class="grid-2" role="group" aria-label="I am a">
        <button type="button" class="choice" data-segment="student" aria-pressed="${student}"><strong>Student</strong><span>High school or university. Find the right major.</span></button>
        <button type="button" class="choice" data-segment="jobseeker" aria-pressed="${draft.segment === 'jobseeker'}"><strong>Jobseeker</strong><span>Fresh grad or professional. Find roles that fit.</span></button>
      </div>
      <div class="field"><label for="education_level">${student ? 'Current level' : 'Highest education'}</label>
        <select class="input" id="education_level" name="education_level">
          <option value="">Choose…</option>
          ${opts.map((o) => `<option ${o === draft.education_level ? 'selected' : ''}>${esc(o)}</option>`).join('')}
        </select></div>
      <div class="field"><label for="field">${student ? 'Stream or major' : 'Field of study'}</label><input class="input" id="field" name="field" value="${esc(draft.field)}" placeholder="${student ? 'e.g. IPA, IPS, Informatics' : 'e.g. Informatics'}"></div>
      <div class="field"><label for="school">School / university</label><input class="input" id="school" name="school" value="${esc(draft.school)}" placeholder="e.g. SMAN 8 Jakarta"></div>
      <div class="field"><label for="summary">About you <span class="small">(optional)</span></label><textarea class="input" id="summary" name="summary" maxlength="1000" placeholder="${student ? 'Subjects you enjoy, hobbies, what you are curious about' : 'A short summary of your experience and what you are looking for'}">${esc(draft.summary)}</textarea></div>

      <div class="stack-sm">
        <h2 class="h2">Skills</h2>
        <div class="row">
          <label for="skill" class="sr-only">Add a skill</label>
          <input class="input" id="skill" placeholder="e.g. Excel, public speaking" style="flex:1">
          <button type="button" class="btn btn-outline btn-sm" id="addSkill">Add</button>
        </div>
        <div class="chips">${draft.skills
          .map((s, i) => `<span class="chip">${esc(s)}<button type="button" data-skill="${i}" aria-label="Remove ${esc(s)}">${icon('close', 14)}</button></span>`)
          .join('')}</div>
      </div>

      ${section('education', 'Education', '', 'Add education')}
      ${section('experience', student ? 'Activities & experience' : 'Work experience', student ? 'Organizations, competitions, volunteering or part-time work (optional).' : '', student ? 'Add activity' : 'Add experience')}
      ${section('certifications', 'Certifications', '', 'Add certificate')}

      <div id="err"></div>
      <button class="btn btn-primary" type="submit">${state.hasProfile ? 'Save changes' : 'Continue'}</button>
    </form>
  </section>`;

  const f = document.getElementById('pf');
  f.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.segment) {
      collectProfile();
      if (draft.segment !== t.dataset.segment) draft.education_level = '';
      draft.segment = t.dataset.segment;
      renderProfileForm();
    } else if (t.dataset.add) {
      collectProfile();
      draft[t.dataset.add].push({});
      renderProfileForm();
    } else if (t.dataset.remove) {
      collectProfile();
      draft[t.dataset.remove].splice(Number(t.dataset.index), 1);
      renderProfileForm();
    } else if (t.dataset.skill !== undefined) {
      collectProfile();
      draft.skills.splice(Number(t.dataset.skill), 1);
      renderProfileForm();
    } else if (t.id === 'addSkill') {
      collectProfile();
      renderProfileForm();
      document.getElementById('skill').focus();
    }
  });
  f.querySelector('#skill').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      collectProfile();
      renderProfileForm();
      document.getElementById('skill').focus();
    }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    collectProfile();
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api('/api/profile', { method: 'PUT', body: draft });
      state.hasProfile = true;
      go('#/home');
    } catch (err) {
      showError(document.getElementById('err'), err.message);
      btn.disabled = false;
    }
  });
}

async function viewProfile() {
  loading();
  const { profile } = await api('/api/profile');
  draft = {
    segment: profile?.segment || 'jobseeker',
    education_level: profile?.education_level || '',
    field: profile?.field || '',
    school: profile?.school || '',
    summary: profile?.summary || '',
    skills: profile?.skills || [],
    education: profile?.education?.length ? profile.education : [{}],
    experience: profile?.experience || [],
    certifications: profile?.certifications || []
  };
  renderProfileForm();
}

// ---------------- home ----------------

const TEST_COLORS = {
  kraepelin: ['#FFF3E6', '#9A3412'],
  bigfive: ['#DDF3EE', '#0B5E52'],
  type16: ['#E7E8FB', '#272BA8'],
  riasec: ['#FDEBD8', '#9A3412'],
  values: ['#EEF0F4', '#14213D']
};

async function viewHome() {
  loading();
  const { tests, assignments } = await api('/api/tests');
  const core = tests.filter((t) => t.status !== 'soon' && t.id !== 'kraepelin');
  const done = core.filter((t) => t.status === 'done').length;
  const first = (state.user?.name || '').split(' ')[0];
  app.className = 'app tinted';
  app.innerHTML = `<section class="screen with-nav">
    <div class="stack-sm" style="gap:2px">
      <span class="small" style="font-size:13px">Welcome</span>
      <h1 class="h1" style="font-size:22px">Hi, ${esc(first)}</h1>
    </div>
    ${
      state.hasProfile
        ? ''
        : `<a class="card" href="#/profile" style="text-decoration:none;color:inherit"><b>Complete your profile</b><span class="small">Add your education and CV details so your matches fit you.</span></a>`
    }
    ${(assignments || [])
      .map((a) => {
        const left = a.tests.filter((t) => !t.done);
        return `<div class="card" style="border-color:${left.length ? '#F5C89B' : 'var(--line)'}">
          <span class="eyebrow" style="color:var(--warm)">Assessment from ${esc(a.org)}</span>
          <b style="font-size:16px">${esc(a.name)}</b>
          <ul class="plain">${a.tests.map((t) => `<li>${esc(t.name)}: ${t.done ? '<b style="color:var(--ok)">done</b>' : '<b>to do</b>'}</li>`).join('')}</ul>
          <span class="small">${left.length ? 'Please complete the tests marked "Required" below. Your results are shared with the organization and its psychologist.' : 'All done. Thank you! The psychologist will review your results.'}</span>
        </div>`;
      })
      .join('')}
    <div class="card-dark">
      <span class="eyebrow">Your career report</span>
      <span style="font-size:17px;font-weight:700;line-height:1.35">${
        done >= core.length ? 'All core tests done. Your matches are ready.' : `Finish ${core.length} core tests to get your best matches`
      }</span>
      <div class="progress"><div style="width:${Math.round((done / core.length) * 100)}%"></div></div>
      <div class="row between">
        <span class="small" style="color:#C9CCF7">${done} of ${core.length} done</span>
        ${done ? '<a href="#/results" style="color:#FFFFFF;font-weight:700;font-size:13px">See results</a>' : ''}
      </div>
    </div>
    <h2 class="h2">Tests</h2>
    <div class="stack-sm" style="gap:10px">
      ${tests
        .map((t) => {
          const [bg, fg] = TEST_COLORS[t.id] || TEST_COLORS.values;
          const badge = t.required
            ? '<span class="badge" style="background:var(--warm);color:#FFFFFF">Required</span>'
            : t.status === 'done'
              ? '<span class="badge badge-done">Done</span>'
              : t.status === 'soon'
                ? '<span class="badge badge-soon">Soon</span>'
                : '<span class="badge badge-start">Start</span>';
          const meta =
            t.status === 'soon'
              ? `Coming soon · ~${t.minutes} min`
              : t.id === 'kraepelin'
                ? `Timed number test · ~${t.minutes} min`
                : `${t.count} questions · ~${t.minutes} min`;
          const inner = `<span class="test-icon" style="background:${bg};color:${fg}">${esc(t.code)}</span>
            <span style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0">
              <span style="font-size:15px;font-weight:700">${esc(t.name)}</span>
              <span class="small">${meta}</span>
            </span>${badge}`;
          return t.status === 'soon'
            ? `<div class="test-item soon">${inner}</div>`
            : `<a class="test-item" href="${t.id === 'kraepelin' ? '#/kraepelin' : `#/test/${t.id}`}" ${t.status === 'done' ? `aria-label="${esc(t.name)}, done. Retake test"` : ''}>${inner}</a>`;
        })
        .join('')}
    </div>
  </section>${nav('#/home')}`;
}

// ---------------- taking a test ----------------

async function viewTest(id) {
  loading();
  const { test } = await api(`/api/tests/${id}`);
  const key = `tc_answers_${id}`;
  let answers = load(key);
  if (!Array.isArray(answers) || answers.length !== test.questions.length) answers = new Array(test.questions.length).fill(null);
  let index = answers.findIndex((a) => a === null);
  if (index === -1) index = test.questions.length - 1;
  let submitting = false;

  const draw = () => {
    const q = test.questions[index];
    const total = test.questions.length;
    const answered = answers.filter((a) => a !== null).length;
    const allDone = answered === total;
    const current = answers[index];
    let body = '';

    if (test.format === 'pair') {
      const sizes = [52, 42, 34, 42, 52];
      const colors = ['#3A3FD8', '#3A3FD8', '#8A91A3', '#C2410C', '#C2410C'];
      const labels = ['Strongly the left one', 'Somewhat the left one', 'Neutral', 'Somewhat the right one', 'Strongly the right one'];
      body = `<div class="stack-sm" style="gap:10px;margin-top:12px">
          <span class="eyebrow" style="color:var(--muted)">${esc(test.prompt)}</span>
        </div>
        <div class="pair"><div class="l">${esc(q.left)}</div><div class="r">${esc(q.right)}</div></div>
        <fieldset style="border:0;margin:0;padding:0" class="stack-sm">
          <legend class="sr-only">Choose which statement is more like you</legend>
          <div class="scale">${sizes
            .map(
              (s, i) =>
                `<button type="button" class="dot" data-answer="${i + 1}" aria-label="${labels[i]}" aria-pressed="${current === i + 1}" style="width:${s}px;height:${s}px;border-color:${colors[i]};background:${current === i + 1 ? colors[i] : '#FFFFFF'}"></button>`
            )
            .join('')}</div>
          <div class="scale-labels"><span>Left</span><span>Neutral</span><span>Right</span></div>
        </fieldset>`;
    } else {
      body = `<div class="stack-sm" style="gap:10px;margin-top:12px">
          <span class="eyebrow" style="color:var(--muted)">How accurately does this describe you?</span>
          <h1 class="h1" style="font-size:22px;line-height:1.35">I ${esc(q.text.charAt(0).toLowerCase() + q.text.slice(1))}</h1>
        </div>
        <div class="likert" role="group" aria-label="Your answer">${test.scale
          .map((label, i) => `<button type="button" data-answer="${i + 1}" aria-pressed="${current === i + 1}">${esc(label)}</button>`)
          .join('')}</div>`;
    }

    app.className = 'app';
    app.innerHTML = `<section class="screen">
      ${topbar(test.name, '#/home', 'close')}
      <div class="stack-sm">
        <div class="row between small" style="font-size:13px"><span>Question ${index + 1} of ${total}</span><span>${answered} answered</span></div>
        <div class="progress"><div style="width:${(answered / total) * 100}%"></div></div>
      </div>
      ${body}
      <p class="small center">${esc(test.instruction)}</p>
      <div id="err"></div>
      <div class="grid-2 push">
        <button type="button" class="btn btn-outline" id="prev" ${index === 0 ? 'disabled' : ''}>Previous</button>
        ${
          allDone
            ? `<button type="button" class="btn btn-primary" id="submit" ${submitting ? 'disabled' : ''}>See results</button>`
            : `<button type="button" class="btn btn-primary" id="next" ${current === null || index === total - 1 ? 'disabled' : ''}>Next</button>`
        }
      </div>
    </section>`;

    app.querySelectorAll('[data-answer]').forEach((b) =>
      b.addEventListener('click', () => {
        answers[index] = Number(b.dataset.answer);
        store(key, answers);
        const nextOpen = answers.findIndex((a, i) => a === null && i > index);
        const anyOpen = answers.findIndex((a) => a === null);
        if (nextOpen !== -1) {
          draw();
          setTimeout(() => {
            index = nextOpen;
            draw();
          }, 180);
        } else {
          if (anyOpen !== -1) index = anyOpen;
          draw();
        }
      })
    );
    const prev = document.getElementById('prev');
    if (prev) prev.addEventListener('click', () => { index = Math.max(0, index - 1); draw(); });
    const next = document.getElementById('next');
    if (next) next.addEventListener('click', () => { index = Math.min(total - 1, index + 1); draw(); });
    const submit = document.getElementById('submit');
    if (submit)
      submit.addEventListener('click', async () => {
        submitting = true;
        submit.disabled = true;
        submit.textContent = 'Scoring…';
        try {
          await api(`/api/tests/${id}/submit`, { method: 'POST', body: { answers } });
          store(key, undefined);
          go('#/results');
        } catch (err) {
          submitting = false;
          showError(document.getElementById('err'), err.message);
          submit.disabled = false;
          submit.textContent = 'See results';
        }
      });
  };
  draw();
}

// ---------------- results ----------------

function matchesBlock(insights, busy, error) {
  const head = `<div class="stack-sm" style="gap:2px">
      <h2 class="h2">Top ${insights?.target === 'majors' ? 'major' : 'career'} matches</h2>
      <span class="small">Based on your tests and profile, generated with AI</span>
    </div>`;
  if (busy) return `<div class="card">${head}<div class="loading" style="padding:16px 0"><div class="spinner"></div>Finding your matches…</div></div>`;
  if (!insights) {
    return `<div class="card">${head}
      ${error ? `<div class="error" role="alert">${esc(error)}</div>` : ''}
      <button type="button" class="btn btn-primary" id="gen">${icon('sparkle', 20)}Find my matches</button>
    </div>`;
  }
  return `<div class="card">${head}
    ${insights.summary ? `<p style="font-size:14px;line-height:1.5">${esc(insights.summary)}</p>` : ''}
    <div>${insights.matches
      .map(
        (m, i) => `<div class="match"><span class="rank">${i + 1}</span>
          <span style="flex:1;display:flex;flex-direction:column;gap:2px"><b style="font-size:14.5px">${esc(m.title)}</b><span class="small">${esc(m.why)}</span></span>
          <span class="fit ${m.fit === 'Strong fit' ? '' : 'good'}">${esc(m.fit)}</span></div>`
      )
      .join('')}</div>
    ${insights.strengths?.length ? `<div class="stack-sm"><b style="font-size:14px">Strengths</b><ul class="plain">${insights.strengths.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
    ${insights.growth?.length ? `<div class="stack-sm"><b style="font-size:14px">To develop</b><ul class="plain">${insights.growth.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
    ${error ? `<div class="error" role="alert">${esc(error)}</div>` : ''}
    <button type="button" class="link-btn" id="gen" style="align-self:flex-start">Refresh matches</button>
  </div>`;
}

async function viewResults() {
  loading();
  const data = await api('/api/results');
  let insights = data.insights;
  let busy = false;
  let error = '';
  const { type16, bigfive, kraepelin } = data.results;

  const draw = () => {
    app.className = 'app tinted';
    if (!type16 && !bigfive && !kraepelin) {
      app.innerHTML = `<section class="screen with-nav">
        <h1 class="h1" style="font-size:24px">Your results</h1>
        <div class="card"><b>No results yet</b><p class="small">Finish a test and your results will show up here.</p><a class="btn btn-primary" href="#/home">Go to tests</a></div>
      </section>${nav('#/results')}`;
      return;
    }
    app.innerHTML = `<section class="screen with-nav">
      <h1 class="h1" style="font-size:24px">Your results</h1>
      ${
        type16
          ? `<div class="card-accent">
          <span class="eyebrow">16-type personality</span>
          <span style="font-size:44px;font-weight:800;letter-spacing:2px;line-height:1">${esc(type16.code)}</span>
          <span style="font-size:18px;font-weight:700">${esc(type16.title)}</span>
          <span style="font-size:14px;line-height:1.5;color:#E8E9FD">${esc(type16.description)}</span>
        </div>
        <div class="card"><h2 class="h2">Your preferences</h2>
          ${type16.dimensions
            .map((d) => {
              const aWins = d.letter === d.a;
              return `<div class="stack-sm" style="gap:6px">
              <div class="dim-labels"><span class="${aWins ? 'on' : 'off'}">${d.aName} ${d.aPct}%</span><span class="${aWins ? 'off' : 'on'}">${d.bName} ${d.bPct}%</span></div>
              <div class="bar" role="img" aria-label="${d.aName} ${d.aPct} percent, ${d.bName} ${d.bPct} percent"><div style="width:${d.aPct}%"></div></div>
            </div>`;
            })
            .join('')}
        </div>`
          : `<a class="card" href="#/test/type16" style="text-decoration:none;color:inherit"><b>16-type personality</b><span class="small">Not taken yet. Take it to see your type.</span></a>`
      }
      ${
        bigfive
          ? `<div class="card"><h2 class="h2">Big Five traits</h2>
          ${bigfive.traits
            .map(
              (t) => `<div class="stack-sm" style="gap:6px">
              <div class="dim-labels"><span class="on">${t.name}</span><span class="off">${t.level} · ${t.pct}%</span></div>
              <div class="bar" role="img" aria-label="${t.name} ${t.pct} percent"><div style="width:${t.pct}%;background:#0F7B6C"></div></div>
            </div>`
            )
            .join('')}
        </div>`
          : `<a class="card" href="#/test/bigfive" style="text-decoration:none;color:inherit"><b>Big Five personality</b><span class="small">Not taken yet. Take it for better matches.</span></a>`
      }
      ${kraepelinCard(data.results.kraepelin)}
      ${matchesBlock(insights, busy, error)}
      <div class="card-dark">
        <div class="row" style="gap:8px">${icon('lock', 18, '#C9CCF7')}<span class="eyebrow">Full report</span></div>
        <span style="font-size:16px;font-weight:700;line-height:1.4">A full report with a development plan, reviewed by a psychologist</span>
        <button type="button" class="btn btn-light" disabled>Coming soon</button>
      </div>
      <a class="btn btn-accent-outline" href="#/consult">Discuss with a psychologist</a>
      <p class="small center">Results describe preferences, not abilities or a diagnosis. Use them as a guide alongside your own judgment.</p>
    </section>${nav('#/results')}`;

    const gen = document.getElementById('gen');
    if (gen)
      gen.addEventListener('click', async () => {
        busy = true;
        error = '';
        draw();
        try {
          insights = (await api('/api/insights', { method: 'POST' })).insights;
        } catch (err) {
          error = err.message;
        }
        busy = false;
        draw();
      });
  };
  draw();
}

// ---------------- consultation ----------------

function nextWeekdays(n) {
  const out = [];
  const d = new Date();
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      out.push({ iso, dow: d.toLocaleDateString('en-US', { weekday: 'short' }), num: d.getDate() });
    }
  }
  return out;
}

async function viewConsult() {
  loading();
  let { bookings } = await api('/api/bookings');
  const days = nextWeekdays(5);
  const times = ['09:00', '10:30', '13:00', '14:30', '16:00', '19:00'];
  const sessions = [
    ['review', 'Result review', '30 min · walk through your results'],
    ['coaching', 'Career coaching', '60 min · plan your next steps']
  ];
  const sel = { session: 'review', day: days[0].iso, time: '10:30', note: '' };
  let notice = '';
  let error = '';

  const draw = () => {
    app.className = 'app';
    app.innerHTML = `<section class="screen with-nav">
      <h1 class="h1" style="font-size:22px">Talk to a psychologist</h1>
      <div class="card" style="flex-direction:row;align-items:center;gap:14px;padding:14px">
        <div style="width:56px;height:56px;border-radius:28px;background:#E7E8FB;color:#272BA8;font-weight:800;display:flex;align-items:center;justify-content:center">PS</div>
        <div class="stack-sm" style="gap:3px"><b style="font-size:15px">Licensed psychologist</b><span class="small">Career &amp; education · online video call</span></div>
      </div>
      ${notice ? `<div class="notice" role="status">${esc(notice)}</div>` : ''}
      <div class="stack-sm" style="gap:10px"><h2 class="h2" style="font-size:15px">Session type</h2>
        ${sessions
          .map(
            ([id, name, meta]) => `<button type="button" class="select-btn session-btn" data-session="${id}" aria-pressed="${sel.session === id}">
            <span style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:14.5px">${name}</span><span class="small" style="font-weight:500">${meta}</span></span>
          </button>`
          )
          .join('')}
      </div>
      <div class="stack-sm" style="gap:10px"><h2 class="h2" style="font-size:15px">Date</h2>
        <div class="grid-5">${days
          .map((d) => `<button type="button" class="select-btn day-btn" data-day="${d.iso}" aria-pressed="${sel.day === d.iso}"><small>${d.dow}</small><b>${d.num}</b></button>`)
          .join('')}</div>
      </div>
      <div class="stack-sm" style="gap:10px"><h2 class="h2" style="font-size:15px">Time (WIB)</h2>
        <div class="grid-3">${times.map((t) => `<button type="button" class="select-btn" data-time="${t}" aria-pressed="${sel.time === t}">${t}</button>`).join('')}</div>
      </div>
      <div class="field"><label for="note">Anything you want to discuss? <span class="small">(optional)</span></label><textarea class="input" id="note" maxlength="500">${esc(sel.note)}</textarea></div>
      ${error ? `<div class="error" role="alert">${esc(error)}</div>` : ''}
      <button type="button" class="btn btn-primary" id="book">Request booking</button>
      <p class="small center">The psychologist will confirm your slot and payment details by WhatsApp or email.</p>
      ${
        bookings.length
          ? `<div class="card"><h2 class="h2" style="font-size:15px">Your bookings</h2>${bookings
              .map((b) => `<div class="row between" style="font-size:14px;border-top:1px solid #EEF0F4;padding-top:10px"><span>${esc(b.label)}<br><span class="small">${esc(b.date)} · ${esc(b.time)} WIB</span></span><span class="badge badge-soon" style="text-transform:capitalize">${esc(b.status)}</span></div>`)
              .join('')}</div>`
          : ''
      }
    </section>${nav('#/consult')}`;

    const note = document.getElementById('note');
    note.addEventListener('input', () => (sel.note = note.value));
    app.querySelectorAll('[data-session]').forEach((b) => b.addEventListener('click', () => { sel.session = b.dataset.session; draw(); }));
    app.querySelectorAll('[data-day]').forEach((b) => b.addEventListener('click', () => { sel.day = b.dataset.day; draw(); }));
    app.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => { sel.time = b.dataset.time; draw(); }));
    document.getElementById('book').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      error = '';
      notice = '';
      try {
        await api('/api/bookings', { method: 'POST', body: { session_type: sel.session, date: sel.day, time: sel.time, note: sel.note } });
        bookings = (await api('/api/bookings')).bookings;
        notice = 'Booking requested. We will confirm it with you soon.';
        sel.note = '';
      } catch (err) {
        error = err.message;
      }
      draw();
    });
  };
  draw();
}

// ---------------- account ----------------

function viewAccount() {
  app.className = 'app tinted';
  app.innerHTML = `<section class="screen with-nav">
    <h1 class="h1" style="font-size:22px">Account</h1>
    <div class="card"><b style="font-size:16px">${esc(state.user.name)}</b><span class="small">${esc(state.user.email)}</span></div>
    <div class="card" style="gap:0;padding:6px 18px">
      <a href="#/profile" style="padding:14px 0;text-decoration:none;font-weight:700">Edit profile &amp; CV</a>
      ${state.hasOrg ? '<a href="/org/" style="padding:14px 0;text-decoration:none;font-weight:700;border-top:1px solid #EEF0F4">Organization portal</a>' : ''}
      <button type="button" class="link-btn" id="logout" style="padding:14px 0;text-align:left;border-top:1px solid #EEF0F4">Log out</button>
      <button type="button" class="link-btn danger" id="del" style="padding:14px 0;text-align:left;border-top:1px solid #EEF0F4">Delete my account and data</button>
    </div>
    <div id="err"></div>
  </section>${nav('#/account')}`;
  document.getElementById('logout').addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
    state.user = null;
    go('#/login');
  });
  document.getElementById('del').addEventListener('click', async () => {
    if (!confirm('This permanently deletes your account, profile, CV details, test results and bookings. Continue?')) return;
    try {
      await api('/api/me', { method: 'DELETE' });
      state.user = null;
      go('#/register');
    } catch (err) {
      showError(document.getElementById('err'), err.message);
    }
  });
}

// ---------------- joining an organization (invite link) ----------------

async function viewJoin(code) {
  loading();
  const { invite } = await api(`/api/join/${code}`);
  app.className = 'app';
  const head = `<a class="brand" href="/" style="text-decoration:none;color:inherit"><span class="brand-mark">${icon('compass', 20, '#FFFFFF')}</span>Test Center</a>
    <div class="stack-sm">
      <span class="eyebrow" style="color:var(--warm)">Invitation from ${esc(invite.org)}</span>
      <h1 class="h1" style="font-size:24px">${esc(invite.name)}</h1>
      <p class="lead" style="font-size:14.5px">${esc(invite.org)} has invited you to take the following online tests:</p>
      <ul class="plain">${invite.tests.map((t) => `<li>${esc(t.name)}</li>`).join('')}</ul>
    </div>`;
  if (!state.user) {
    try {
      sessionStorage.setItem('tc_next', `#/join/${code}`);
    } catch {
      /* ignore */
    }
    app.innerHTML = `<section class="screen">${head}
      <p class="small">Create an account (or log in) to continue. Use your own email; your results stay linked to your account.</p>
      <div class="stack-sm push">
        <a class="btn btn-primary" href="#/register">Create account</a>
        <a class="btn btn-outline" href="#/login">I already have an account</a>
      </div>
    </section>`;
    return;
  }
  app.innerHTML = `<section class="screen">${head}
    <form id="jf" class="stack" novalidate>
      <div class="field"><label for="nik">Employee ID (NIK) <span class="small">(optional)</span></label><input class="input" id="nik" maxlength="40"></div>
      <div class="field"><label for="pos">Current position <span class="small">(optional)</span></label><input class="input" id="pos" maxlength="160"></div>
      <div class="field"><label for="div">Division <span class="small">(optional)</span></label><input class="input" id="div" maxlength="120"></div>
      <div class="check"><input id="consent" type="checkbox"><label for="consent">I agree that my results from these tests are shared with ${esc(invite.org)} and its psychologist for this assessment. I can ask for my data to be deleted at any time.</label></div>
      <div id="err"></div>
      <button class="btn btn-primary" type="submit">Join and start</button>
    </form>
    <p class="small center">Logged in as ${esc(state.user.email)}</p>
  </section>`;
  document.getElementById('jf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await api('/api/join', {
        method: 'POST',
        body: {
          code,
          nik: document.getElementById('nik').value,
          position: document.getElementById('pos').value,
          division: document.getElementById('div').value,
          consent: document.getElementById('consent').checked
        }
      });
      go('#/home');
    } catch (err) {
      showError(document.getElementById('err'), err.message);
      btn.disabled = false;
    }
  });
}

// ---------------- Kraepelin test ----------------

const LEVEL_WORDS = ['', 'Very low', 'Low', 'Average', 'High', 'Very high'];
const KR_INDEX_EN = { speed: 'Speed', accuracy: 'Accuracy', consistency: 'Consistency', endurance: 'Endurance' };

function sparkline(values, w = 300, h = 60) {
  if (!values || values.length < 2) return '';
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - (v / max) * (h - 6) - 3).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" role="img" aria-label="Answers per column over time"><polyline points="${pts}" fill="none" stroke="#3A3FD8" stroke-width="2" stroke-linejoin="round"></polyline></svg>`;
}

function kraepelinCard(k) {
  if (!k) {
    return `<a class="card" href="#/kraepelin" style="text-decoration:none;color:inherit"><b>Work attitude (Kraepelin)</b><span class="small">Not taken yet. A 10-minute timed number test of speed, accuracy and endurance.</span></a>`;
  }
  return `<div class="card">
    <h2 class="h2">Work attitude (Kraepelin)</h2>
    ${['speed', 'accuracy', 'consistency', 'endurance']
      .map(
        (key) => `<div class="stack-sm" style="gap:6px">
        <div class="dim-labels"><span class="on">${KR_INDEX_EN[key]}</span><span class="off">${LEVEL_WORDS[k.levels[key]]}</span></div>
        <div class="bar" role="img" aria-label="${KR_INDEX_EN[key]}: ${LEVEL_WORDS[k.levels[key]]}"><div style="width:${k.levels[key] * 20}%;background:#C2410C"></div></div>
      </div>`
      )
      .join('')}
    <div class="stack-sm" style="gap:4px"><span class="small">Answers per column</span>${sparkline(k.perColumn)}</div>
    <span class="small">${k.speed} answers per column on average · ${k.errorRate}% errors</span>
  </div>`;
}

let krCleanup = null;

async function viewKraepelin() {
  if (krCleanup) krCleanup();
  let tabSwitches = 0;
  const onVis = () => {
    if (document.hidden) tabSwitches++;
  };
  let keyHandler = null;
  let timer = null;
  krCleanup = () => {
    document.removeEventListener('visibilitychange', onVis);
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    if (timer) clearInterval(timer);
    keyHandler = null;
    timer = null;
  };
  window.addEventListener('hashchange', () => krCleanup && krCleanup(), { once: true });

  const intro = () => {
    app.className = 'app';
    app.innerHTML = `<section class="screen">
      ${topbar('Work attitude test', '#/home', 'close')}
      <h1 class="h1" style="font-size:24px">How it works</h1>
      <p class="lead" style="font-size:15px">Add the two numbers shown and enter only the <b>last digit</b> of the sum.</p>
      <div class="card" style="flex-direction:row;align-items:center;gap:18px">
        <div style="font-size:30px;font-weight:800;line-height:1.2;text-align:center">7<br>8</div>
        <div class="small" style="font-size:14px">7 + 8 = 15, so you enter <b>5</b>.<br>5 + 4 = 9, so you enter <b>9</b>.</div>
      </div>
      <ul class="plain">
        <li>The test has <b>40 columns of 15 seconds</b> each (10 minutes). When time is up, the next column starts automatically.</li>
        <li>Work as fast and as accurately as you can, and keep going until the end.</li>
        <li>Use the number keys on your keyboard or the keypad on screen.</li>
        <li>Find a quiet place and don't switch apps or tabs during the test.</li>
      </ul>
      <div class="stack-sm push">
        <button class="btn btn-outline" id="practice" type="button">Try a 15-second practice</button>
        <button class="btn btn-primary" id="begin" type="button">Start the test</button>
      </div>
    </section>`;
    document.getElementById('practice').addEventListener('click', () => run({ practice: true }));
    document.getElementById('begin').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        const cfg = await api('/api/kraepelin/start', { method: 'POST' });
        run({ practice: false, cfg });
      } catch (err) {
        e.currentTarget.disabled = false;
        alert(err.message);
      }
    });
  };

  const run = ({ practice, cfg }) => {
    const seed = practice ? Math.floor(Math.random() * 4294967295) : cfg.seed;
    const columns = practice ? 1 : cfg.columns;
    const seconds = practice ? 15 : cfg.seconds;
    const length = practice ? 70 : cfg.length;
    const answers = [];
    let col = 0;
    let idx = 0;
    let digits = columnDigits(seed, 0, length);
    let colStart = performance.now();
    let correctPractice = 0;
    if (!practice) document.addEventListener('visibilitychange', onVis);

    app.className = 'app';
    app.innerHTML = `<section class="screen" style="gap:14px">
      <div class="row between small" style="font-size:13px">
        <span id="krCol">${practice ? 'Practice' : `Column 1 of ${columns}`}</span>
        <span id="krCount">0 answered</span>
      </div>
      <div class="progress" aria-hidden="true"><div id="krTime" style="width:100%;transition:none"></div></div>
      ${practice ? '' : `<div class="progress" aria-hidden="true" style="height:4px"><div id="krAll" style="width:0%;background:#9EA2F5"></div></div>`}
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;margin:10px 0">
        <span id="krPrev" style="font-size:22px;font-weight:700;color:#AEB4C2;height:28px"></span>
        <div style="display:flex;align-items:center;gap:18px">
          <span style="font-size:30px;font-weight:700;color:var(--muted)">+</span>
          <div style="display:flex;flex-direction:column;align-items:center;font-size:56px;font-weight:800;line-height:1.1">
            <span id="krA"></span><span id="krB"></span>
          </div>
        </div>
        <span id="krFb" class="small" style="height:20px" aria-live="polite"></span>
      </div>
      <div class="grid-3" id="krPad" style="gap:10px;margin-top:auto">
        ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" class="btn btn-outline" data-d="${n}" style="height:60px;font-size:24px">${n}</button>`).join('')}
        <span></span><button type="button" class="btn btn-outline" data-d="0" style="height:60px;font-size:24px">0</button><span></span>
      </div>
    </section>`;

    const elA = document.getElementById('krA');
    const elB = document.getElementById('krB');
    const elPrev = document.getElementById('krPrev');
    const elCount = document.getElementById('krCount');
    const elTime = document.getElementById('krTime');
    const elAll = document.getElementById('krAll');
    const elFb = document.getElementById('krFb');
    const elCol = document.getElementById('krCol');
    answers[0] = [];

    const show = () => {
      elA.textContent = digits[idx];
      elB.textContent = digits[idx + 1];
      elPrev.textContent = idx > 0 ? digits[idx - 1] : '';
      elCount.textContent = `${answers[col].length} answered`;
    };

    const finish = async () => {
      krCleanup();
      if (practice) {
        app.innerHTML = `<section class="screen">
          ${topbar('Practice done', '#/home', 'close')}
          <div class="card"><b style="font-size:18px">${answers[0].length} answers, ${correctPractice} correct</b>
          <span class="small">In the real test you won't see whether an answer is right. Just keep a steady pace.</span></div>
          <div class="stack-sm push">
            <button class="btn btn-outline" id="again" type="button">Practice again</button>
            <button class="btn btn-primary" id="toIntro" type="button">I'm ready</button>
          </div>
        </section>`;
        document.getElementById('again').addEventListener('click', () => run({ practice: true }));
        document.getElementById('toIntro').addEventListener('click', intro);
        return;
      }
      app.innerHTML = `<div class="loading"><div class="spinner"></div>Saving your results…</div>`;
      try {
        await api('/api/kraepelin/submit', { method: 'POST', body: { sessionId: cfg.sessionId, columns: answers, tabSwitches } });
        go('#/results');
      } catch (err) {
        app.innerHTML = `<section class="screen"><div class="error" role="alert">${esc(err.message)}</div><a class="btn btn-outline" href="#/home">Back to home</a></section>`;
      }
    };

    const nextColumn = () => {
      col++;
      if (col >= columns) return finish();
      answers[col] = [];
      idx = 0;
      digits = columnDigits(seed, col, length);
      colStart = performance.now();
      elCol.textContent = `Column ${col + 1} of ${columns}`;
      if (elAll) elAll.style.width = `${(col / columns) * 100}%`;
      show();
    };

    const enter = (d) => {
      if (idx >= length - 1) return;
      if (practice) {
        const ok = d === expected(digits, idx);
        if (ok) correctPractice++;
        elFb.textContent = ok ? 'Correct' : `Not quite: ${digits[idx]} + ${digits[idx + 1]} = ${digits[idx] + digits[idx + 1]}`;
        elFb.style.color = ok ? 'var(--ok)' : 'var(--danger)';
      }
      answers[col].push(d);
      idx++;
      show();
    };

    document.getElementById('krPad').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-d]');
      if (b) enter(Number(b.dataset.d));
    });
    keyHandler = (e) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        enter(Number(e.key));
      }
    };
    document.addEventListener('keydown', keyHandler);
    timer = setInterval(() => {
      const left = seconds - (performance.now() - colStart) / 1000;
      elTime.style.width = `${Math.max(0, (left / seconds) * 100)}%`;
      if (left <= 0) nextColumn();
    }, 100);
    show();
  };

  intro();
}

// ---------------- router ----------------

async function render() {
  const hash = location.hash || '#/';
  const publicRoutes = ['#/login', '#/register'];
  const joinMatch = hash.match(/^#\/join\/([A-Za-z0-9]{4,20})$/);
  if (joinMatch) {
    window.scrollTo(0, 0);
    return viewJoin(joinMatch[1].toUpperCase()).catch((err) => {
      app.innerHTML = `<section class="screen"><div class="error" role="alert">${esc(err.message)}</div><a class="btn btn-outline" href="#/">Go to app</a></section>`;
    });
  }
  if (!state.user && !publicRoutes.includes(hash)) {
    if (hash !== '#/') go('#/login');
    else go('#/register');
    return;
  }
  if (state.user && (publicRoutes.includes(hash) || hash === '#/')) {
    go(state.hasProfile ? '#/home' : '#/profile');
    return;
  }
  window.scrollTo(0, 0);
  try {
    if (hash === '#/register') return viewRegister();
    if (hash === '#/login') return viewLogin();
    if (hash === '#/profile') return await viewProfile();
    if (hash === '#/home') return await viewHome();
    if (hash === '#/results') return await viewResults();
    if (hash === '#/consult') return await viewConsult();
    if (hash === '#/account') return viewAccount();
    if (hash === '#/kraepelin') return await viewKraepelin();
    const t = hash.match(/^#\/test\/([a-z0-9]+)$/);
    if (t) return await viewTest(t[1]);
    go('#/home');
  } catch (err) {
    if (!state.user) return;
    app.className = 'app';
    app.innerHTML = `<section class="screen"><div class="error" role="alert">${esc(err.message)}</div><a class="btn btn-outline" href="#/home">Back to home</a></section>`;
  }
}

async function start() {
  try {
    const m = await api('/api/me');
    state.user = m.user;
    state.hasProfile = !!m.hasProfile;
    state.hasOrg = !!m.hasOrg;
  } catch (err) {
    app.innerHTML = `<section class="screen"><div class="error" role="alert">${esc(err.message)}</div></section>`;
    return;
  }
  window.addEventListener('hashchange', render);
  render();
}

start();
