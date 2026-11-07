create table public.marshall_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  work_day date generated always as ((recorded_at at time zone 'Europe/Lisbon')::date) stored,
  mode text not null check (mode in ('t1', 't10', 'shotgun')),
  start_hole smallint not null check (start_hole between 1 and 18),
  tee_time time not null,
  hole smallint not null check (hole between 1 and 18),
  delay_seconds integer not null check (delay_seconds between 1 and 86400),
  buggy_number text not null default '' check (buggy_number ~ '^[0-9]{0,12}$'),
  warned boolean not null default false,
  notes text not null default '' check (char_length(notes) <= 1000),
  revision integer not null default 1 check (revision > 0)
);

create index marshall_records_account_day_idx
  on public.marshall_records (user_id, work_day, recorded_at desc);

alter table public.marshall_records enable row level security;
revoke all on public.marshall_records from anon, authenticated;
grant select on public.marshall_records to authenticated;
grant insert (id, mode, start_hole, tee_time, hole, delay_seconds, buggy_number, warned, notes)
  on public.marshall_records to authenticated;
grant update (buggy_number, warned, notes, revision) on public.marshall_records to authenticated;

create policy "Read today's own records" on public.marshall_records
  for select to authenticated
  using (user_id = (select auth.uid()) and work_day = (now() at time zone 'Europe/Lisbon')::date);

create policy "Add today's own records" on public.marshall_records
  for insert to authenticated
  with check (user_id = (select auth.uid()) and work_day = (now() at time zone 'Europe/Lisbon')::date);

create policy "Update today's own records" on public.marshall_records
  for update to authenticated
  using (user_id = (select auth.uid()) and work_day = (now() at time zone 'Europe/Lisbon')::date)
  with check (user_id = (select auth.uid()) and work_day = (now() at time zone 'Europe/Lisbon')::date);

alter publication supabase_realtime add table public.marshall_records;
