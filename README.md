# Test Center

Personality and career assessment app for students and jobseekers, with results reviewed by a licensed psychologist.

Runs as a single Cloudflare Worker: static frontend (`public/`) plus the API (`src/`), with D1 for data and Workers AI for career/major matching.

- `/` — public front page in Bahasa Indonesia (`public/index.html`), with the partnership inquiry form
- `/app/` — the assessment app (`public/app/index.html`, `public/app.js`)
- `/org/` — corporate portal in Bahasa Indonesia (`public/org/index.html`, `public/org.js`)

## Pages and roles

| Page | Who | What |
| --- | --- | --- |
| `/` | everyone | Front page (Bahasa Indonesia) with partnership form |
| `/app/` | app users (students, jobseekers, employees) | Tests, results, profile/CV, invitations, booking a psychologist |
| `/org/` | organization members (admin / assessor / viewer) | Talent assessment portal for one organization |
| `/psikolog/` | users with role `psychologist` | Calendar of consultations and assessment sessions, working hours, client results |
| `/admin/` | platform admins (`ADMIN_EMAILS`) | App users, roles, account deletion, organizations, partnership inquiries |

**Psychologists:** a psychologist registers in the app like anyone else; a platform admin then sets the
role to *Psikolog* in `/admin/`. The psychologist sets a profile (name, SIPP, bio) and working hours
(days, hours, slot length, days off) in `/psikolog/`. App users see free slots on the Consult page and
request a time; the psychologist confirms or declines, adds a meeting link (Google Meet, Zoom, or a
location), and can keep private encrypted notes. Psychologists can also schedule assessment sessions
(interviews, LGD) for employees of organizations they belong to. A psychologist can see test results
only for their own clients or for participants in their organizations. All times are WIB.

**Invitations by email:** in the portal's *Undangan & Tes*, assessors can invite app users by email.
Registered users see the invitation on their home screen; others see it once they register with that
email. No email is sent by the app yet, so share the invite link by email or WhatsApp too.

## Corporate module (Portal Organisasi)

Talent assessment for companies, following the assessment-center method: a psychologist scores
each participant 1–5 (KS, K, C, B, BS) on 18 psychological aspects, which are compared with the
required score for the participant's job level (standar jabatan).

- **gap / match / talent** = aspects below / equal to / above the standard
- **Fit:** gap 0–2 Fit in Position, 3–5 Moderate Fit, 6+ Low Fit
- **Potential:** talent 7+ Ready, 4–6 Potential, 0–3 Develop
- Fit × Potential gives the **9-box** position and the recommendation (Disarankan, Dipertimbangkan,
  Dipertimbangkan dengan Catatan, Tidak Disarankan). The psychologist can override the final recommendation.

The rules live in `public/shared/talent.js`, used by both the API and the browser.

Features: dashboard (9-box, recommendations, fit, development needs per aspect, per level and division),
participant list with filters and CSV export, CSV import with a template (comma or semicolon),
assessment form with live scoring, printable psikogram (A4 PDF via the browser), editable job standards,
signature settings, and team members with roles:

| Role | Can |
| --- | --- |
| `admin` | everything, including members, standards and deleting data |
| `assessor` | add, import and edit assessments |
| `viewer` | read the dashboard and psikogram (HR) |

**Platform admins** can create organizations and generate demo data. Set the secret
`ADMIN_EMAILS` (comma-separated) in the Worker's Variables and Secrets. Each admin needs an
account in the app with the same email. New organizations start with 4 made-up example standards
(L1–L4) to edit.

Narrative fields (strengths, development areas, conclusion, notes) are encrypted in D1.

### Online psikotes via invite links

In **Undangan & Tes**, an assessor creates an invite for an assessment round (name, default job
standard, purpose, tests). Employees open the link (`/app/#/join/CODE`), create an account, consent to
share results with the organization, and take the required tests in the app.

- **Kraepelin** (`public/shared/kraepelin.js`): 40 columns × 15 seconds; add adjacent digits and enter the
  last digit of the sum. Digits come from a server-issued seed, answers and timing are checked on the
  server, and tab switches are recorded. Scored as speed, accuracy (error %), consistency (variation)
  and endurance (last third ÷ first third), each converted to 1–5 with **provisional norms** (`NORMS`)
  that the psychologist should adjust once real data is available.
- **Big Five** and **16-type** from the participant app.

Assessors see each participant's results and **suggested** scores for 14 of the 18 aspects
(`public/shared/suggest.js`); the 4 cognitive aspects still need the psychologist (no online
cognitive test yet). "Buat asesmen dari hasil ini" opens the assessment form prefilled with those
suggestions, and the psikogram then includes the Kraepelin results. HR viewers only see test status,
not raw psychological results. Only tests completed after joining an invite count.

For local testing, `KRAEPELIN_TEST=1` in `.dev.vars` shortens the test to 3 columns × 5 seconds.
Never set it in production.

## Reading partnership inquiries

Until there is an admin dashboard, open D1 → `testcenter-db` → Console in the Cloudflare dashboard and run:

```sql
SELECT created_at, org_type, org_name, contact_name, position, phone, email, size, message
FROM inquiries ORDER BY created_at DESC;
```

## What's in v0.1

- Register / log in (PBKDF2-hashed passwords, HttpOnly JWT session cookie)
- Profile and CV entered as structured data (education, experience, skills, certifications), encrypted in D1 with AES-GCM
- Tests, scored on the server:
  - **16-type personality**: 32 original paired items written for this app (not the official MBTI and not OEJTS). Should be reviewed and validated by the psychologist before launch.
  - **Big Five**: IPIP 50-item markers (public domain)
  - RIASEC and Work values are placeholders ("coming soon")
- Results page with AI career or major matches (Workers AI, `@cf/meta/llama-3.1-8b-instruct`)
- Consultation booking requests
- Account deletion (removes all of a user's data, for UU PDP)

## Cloudflare setup

The Worker `testcenter` deploys automatically from `main` via Workers Builds.

Bindings are declared in `wrangler.toml` (Cloudflare treats that file as the source of truth):

| Binding | What |
| --- | --- |
| `DB` | D1 database `testcenter-db` |
| `AI` | Workers AI |
| `ASSETS` | files in `public/` |

Secrets (Worker → Settings → Variables and Secrets, type **Secret**):

| Secret | How to generate |
| --- | --- |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` — never change it after launch, or stored CV data can no longer be decrypted |

The database tables are created automatically on the first API request. The same SQL is in `migrations/0001_init.sql` if you prefer `wrangler d1 migrations apply testcenter-db --remote`.

## Local development

```
npm install
printf 'JWT_SECRET=dev-secret\nENCRYPTION_KEY=dev-key\n' > .dev.vars
npx wrangler login
npm run dev
```

`.dev.vars` is git-ignored. Workers AI always runs remotely, so it needs `wrangler login`; everything else (including D1) runs locally.

## API

| Method | Path | |
| --- | --- | --- |
| POST | `/api/auth/register` | name, email, phone, password, consent |
| POST | `/api/auth/login` | email, password |
| POST | `/api/auth/logout` | |
| GET / DELETE | `/api/me` | current user / delete account and data |
| GET / PUT | `/api/profile` | profile and CV |
| GET | `/api/tests` | catalog with status |
| GET | `/api/tests/:id` | questions |
| POST | `/api/tests/:id/submit` | `{ answers: [1..5, …] }` |
| GET | `/api/results` | latest result per test plus AI matches |
| POST | `/api/insights` | generate AI matches |
| POST | `/api/inquiries` | partnership inquiry from the front page (no login) |
| GET | `/api/org/mine` | organizations the user belongs to |
| POST | `/api/admin/orgs` | create organization (platform admin) |
| GET / PUT | `/api/org/:id`, `/api/org/:id/settings` | organization and signature settings |
| GET / POST / DELETE | `/api/org/:id/members[/:userId]` | team members |
| GET / POST / PUT / DELETE | `/api/org/:id/standards[/:sid]` | job standards |
| GET / POST / PUT / DELETE | `/api/org/:id/assessments[/:aid]` | assessments (list supports filters) |
| POST | `/api/org/:id/assessments/import` | CSV import, up to 500 rows |
| GET | `/api/org/:id/dashboard` | aggregates for the dashboard |
| POST | `/api/org/:id/demo` | 120 demo participants (platform admin) |
| GET / POST / PUT | `/api/org/:id/invites[/:iid]` | invite links (PUT toggles active) |
| GET | `/api/org/:id/participants[/:pid]` | employees who joined, with test status, results and suggestions |
| GET | `/api/join/:code` | public invite info |
| POST | `/api/join` | join an organization with consent |
| POST | `/api/kraepelin/start`, `/api/kraepelin/submit` | Kraepelin session and scoring |
| GET / POST | `/api/org/:id/invites/:iid/emails` | invite app users by email |
| GET | `/api/invitations`; POST `/api/invitations/:id/decline` | a user's pending invitations |
| GET | `/api/psychologists`, `/api/slots?psychologist=&days=` | psychologists and free slots |
| GET / POST | `/api/bookings`; POST `/api/bookings/:id/cancel` | a user's sessions |
| GET / PUT | `/api/psych/me` | psychologist profile and working hours |
| GET / POST / PUT | `/api/psych/appointments[/:id]` | calendar, create, confirm/decline/done/cancel, reschedule, notes |
| GET | `/api/psych/people?q=`, `/api/psych/clients/:userId` | find people to schedule, client profile and results |
| GET / PUT / DELETE | `/api/admin/users[/:id]`, GET `/api/admin/stats`, GET/PUT `/api/admin/inquiries[/:id]` | platform admin |

## Next steps

- Psychologist dashboard (client list, results, notes, booking confirmation)
- RIASEC interest test
- Payment (Midtrans or Xendit) for the full report and consultations
- Rate limiting on login and AI calls
