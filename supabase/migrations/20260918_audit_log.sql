-- Append-only record of every institutional mutation, so a change to a mark or
-- an attendance row can always be traced back to the person who made it.
--
-- This is what makes the AI command bar safe to ship: a natural-language
-- instruction that writes to the database leaves the same trail as a form
-- submission, tagged with source = 'ai_command'.

create table if not exists public.edu_audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid references public.edu_profiles(id) on delete set null,
  actor_name    text not null default 'unknown',
  actor_role    text not null default 'unknown',
  action        text not null,
  entity        text not null,
  entity_id     uuid,
  summary       text not null,
  detail        jsonb not null default '{}'::jsonb,
  source        text not null default 'ui' check (source in ('ui', 'ai_command')),
  created_at    timestamptz not null default now()
);

create index if not exists edu_audit_log_created_idx on public.edu_audit_log (created_at desc);
create index if not exists edu_audit_log_actor_idx   on public.edu_audit_log (actor_id, created_at desc);
create index if not exists edu_audit_log_entity_idx  on public.edu_audit_log (entity, entity_id);

alter table public.edu_audit_log enable row level security;

-- Anyone signed in may record their own action; the actor cannot be forged
-- because the policy pins actor_id to the caller.
drop policy if exists edu_audit_insert_self on public.edu_audit_log;
create policy edu_audit_insert_self
  on public.edu_audit_log for insert to authenticated
  with check (actor_id = auth.uid());

-- Teachers see what they did; admins see everything. Students see nothing:
-- the trail is an administrative artefact, not part of a student's record.
drop policy if exists edu_audit_read on public.edu_audit_log;
create policy edu_audit_read
  on public.edu_audit_log for select to authenticated
  using (public.edu_role() = 'admin' or actor_id = auth.uid());

-- Append-only: no update or delete policy exists, so the trail cannot be
-- rewritten through the API by any role.
revoke update, delete on public.edu_audit_log from authenticated, anon;
