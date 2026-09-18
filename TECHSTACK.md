# Tech stack

## Choice

**Next.js (App Router) + Supabase (Postgres + Auth) + Vercel + Gemini.**

One repository, one deploy. The App Router renders every screen on the server,
route handlers act as the backend, and Supabase provides both the database and
real credentialed authentication. Supabase Auth is the deciding factor: it gives
bcrypt-hashed passwords, cookie sessions and — crucially — row-level security
policies keyed to `auth.uid()`, so authorization lives in the database rather
than only in application code.

No Python is required anywhere in the problem, so a second service would have
cost a deploy and a CORS boundary for nothing.

## Dependencies

| Package | Why |
|---|---|
| `next` 16 | App Router, server components, route handlers, proxy — one framework for UI and API |
| `react` / `react-dom` 19 | `useActionState` and `useFormStatus` give real pending and error states on every form with no client state library |
| `@supabase/supabase-js` | Postgres queries and auth from server and browser |
| `@supabase/ssr` | Cookie-based session handling that works across server components, route handlers and the proxy layer |
| `tailwindcss` 4 | Utility styling; the UI is styled as it is built rather than in a polish pass |
| `typescript` | Catches shape errors against the database rows before they reach a deploy |

No UI kit, no ORM, no state manager — every one of those would have cost more
setup time than it saved at this size.

## Architecture

```
Browser
  │
  ├─ Server Components ──────────► Supabase Postgres (RLS enforced per role)
  │    /  /courses  /student  /teacher  /admin
  │
  ├─ Server Actions ────────────► writes: attendance, marks, courses, enrollments
  │    validated in the action, re-checked by RLS, re-checked by a DB trigger
  │
  ├─ proxy.ts ──────────────────► refreshes the session, redirects by role
  │
  └─ POST /api/ai/insight ──────► Gemini gemini-flash-latest
                                    └─ on failure ─► Groq llama-3.3-70b-versatile
                                    └─ result persisted to edu_ai_insights
```

Rules held throughout:

- Server Components by default; `"use client"` only where a form or a button
  needs interactivity.
- AI provider keys are read only inside the route handler. They are never
  imported into a client component and never prefixed `NEXT_PUBLIC_`.
- Every database write goes through a server action or a route handler. The
  browser never writes directly.

## Database

Nine tables, all prefixed `edu_`, all with row-level security enabled:

`edu_profiles`, `edu_teachers`, `edu_students`, `edu_courses`,
`edu_enrollments`, `edu_assessments`, `edu_scores`, `edu_attendance`,
`edu_ai_insights`.

Policies are expressed through `SECURITY DEFINER` helper functions
(`edu_role()`, `edu_student_id()`, `edu_teacher_id()`, `edu_teaches_course()`,
`edu_teaches_student()`) so that a policy on `edu_profiles` can ask "what is my
role?" without recursively invoking itself.

Integrity that does not depend on the application being correct:

- `edu_scores` has a trigger rejecting any score above the assessment's
  `max_score`.
- Unique constraints make attendance idempotent per (student, course, date) and
  marks idempotent per (assessment, student).
- A trigger on `auth.users` creates a profile for every new signup with the role
  hard-coded to `student`; a second trigger blocks any role change not made by
  an administrator.

## Environment variables

Names only — values live in `.env.local` locally and in Vercel project settings
in production. `.env*` is gitignored.

| Name | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Publishable key; safe in the browser because RLS is the real boundary |
| `GEMINI_API_KEY` | server only | Primary AI provider |
| `GROQ_API_KEY` | server only | Fallback AI provider when Gemini rate-limits |

The Supabase service-role key is not used by this application at all.
