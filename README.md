# Test Center

Personality and career assessment app for students and jobseekers, with results reviewed by a licensed psychologist.

Runs as a single Cloudflare Worker: static frontend (`public/`) plus the API (`src/`), with D1 for data and Workers AI for career/major matching.

- `/` — public front page in Bahasa Indonesia (`public/index.html`), with the partnership inquiry form
- `/app/` — the assessment app (`public/app/index.html`, `public/app.js`)

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
| GET / POST | `/api/bookings` | consultation requests |
| POST | `/api/inquiries` | partnership inquiry from the front page (no login) |

## Next steps

- Psychologist dashboard (client list, results, notes, booking confirmation)
- RIASEC interest test
- Payment (Midtrans or Xendit) for the full report and consultations
- Rate limiting on login and AI calls
