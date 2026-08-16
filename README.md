# EduManage — Education Management Portal

An education management portal with integrated AI academic intelligence.
Students, teachers and administrators each sign in with real credentials and see
only what their role allows. On top of the academic record, an AI layer analyses
actual attendance, assignment scores and examination marks to flag weak
subjects, surface academic risk, and generate personalised recommendations.

Built for the *Web Development × Integrated AI* problem statement.

## Live

- **App:** _pending deploy_
- **Repo:** _pending publish_

## Demo credentials

These are throwaway accounts on demo data, published deliberately so a judge can
walk every role. The login page also has one-click fill buttons.

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@kitedu.in` | `Admin@2026` |
| Teacher (CSE — DSA, DBMS, Web Tech) | `priya@kitedu.in` | `Teacher@2026` |
| Teacher (Maths — Discrete Maths) | `ravi@kitedu.in` | `Teacher@2026` |
| Teacher (CSE — OS, Networks) | `meena@kitedu.in` | `Teacher@2026` |
| Student — **at risk**, 37% score / 62% attendance | `arun@kitedu.in` | `Student@2026` |
| Student — **top performer**, 95% / 97% | `divya@kitedu.in` | `Student@2026` |
| Student — borderline, 54% / 80% | `karthik@kitedu.in` | `Student@2026` |
| Students 22CS004–22CS010 | `sneha@`, `vikram@`, `anitha@`, `rahul@`, `keerthi@`, `suresh@`, `nithya@` `kitedu.in` | `Student@2026` |

Passwords are bcrypt-hashed by Supabase Auth. The application never stores or
sees a plaintext password.

## Two-minute walkthrough

1. **Home → Courses.** Public catalogue, searchable by code/title/topic and
   filterable by semester and credits.
2. **Sign in as `priya@kitedu.in`.** Open a course → mark attendance for today
   (recording the same date again edits rather than duplicates) → switch to the
   Marks tab and enter marks for an assessment.
3. **Sign in as `arun@kitedu.in`.** The student dashboard shows attendance
   percentage, per-course scores and progress — including the mark just entered.
4. **Press "Get AI insights."** Gemini reads Arun's real record and returns a
   risk level, the specific weak subjects with the actual numbers cited, a trend
   line, and 3–5 concrete recommendations. Compare with `divya@kitedu.in` to see
   a genuinely different analysis.
5. **Sign in as `admin@kitedu.in`.** Institution-wide risk roll-up across all
   students, with the latest AI verdict per student, plus course creation,
   enrollment and faculty reassignment.

## What makes the authorization real

Authorization is enforced **in the database**, not only in the app:

- Every one of the nine tables has row-level security enabled.
- Policies are keyed to `auth.uid()` through `SECURITY DEFINER` helpers, so a
  student can only ever read their own rows and a teacher only the students they
  actually teach — even for a hand-crafted request with the public anon key.
- Middleware redirects a student who types `/admin`, but that is only
  convenience. If it were bypassed, RLS would still return zero rows.
- A trigger on `auth.users` gives every self-registered account the `student`
  role; a second trigger blocks any role change not made by an administrator.
- A trigger rejects a score above the assessment's maximum, so a typo in the
  marks form cannot corrupt the data the AI reasons over.

## Edge cases handled

- Invalid login returns one generic message — no account enumeration.
- `?next=` returns you to the page you wanted after signing in, and only accepts
  same-origin relative paths, so it cannot become an open redirect.
- Zero enrollments, zero recorded sessions and zero graded work all render real
  empty states and `—`, never `NaN` or a blank page.
- Pending work is excluded from averages; a missed submission counts as zero.
  The dashboard states the difference rather than hiding it.
- Attendance is idempotent per (student, course, date); marks are idempotent per
  (assessment, student).
- Marks are validated in the form, again in the server action, and again by a
  database trigger.
- **AI:** Gemini rate limit or failure falls back to Groq automatically, and the
  response says which model answered. A malformed model response gets a repair
  pass, then fails cleanly. A student with no record at all gets an honest "not
  enough data" instead of an invented analysis. A double click cannot fire two
  generations. Course titles and names are passed as data, so prompt injection
  through them does not change the output contract.

## Stack

Next.js 16 (App Router) · Supabase Postgres + Auth · Tailwind CSS 4 · Gemini
`gemini-flash-latest` with Groq `llama-3.3-70b-versatile` fallback · deployed on
Vercel.

See [TECHSTACK.md](TECHSTACK.md) for the architecture and the reason behind each
dependency, and [ANALYSIS.md](../ANALYSIS.md) for the problem breakdown.

## Local setup

```bash
npm install
```

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
GROQ_API_KEY=
```

The first two are public by design — row-level security is the real boundary.
The AI keys are server-only and are read only inside the route handler. The
Supabase service-role key is not used anywhere in this application.

```bash
npm run dev
```

## Status

Feature-complete and building clean. Schema, RLS policies, demo accounts and
seed data are live on Supabase.
