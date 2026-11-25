create table if not exists public.events (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.events enable row level security;
-- Configuration de démonstration publique. À durcir avant un usage sensible.
create policy "read events" on public.events for select using (true);
create policy "insert events" on public.events for insert with check (true);
create policy "update events" on public.events for update using (true) with check (true);
