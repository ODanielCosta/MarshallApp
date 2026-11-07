grant delete on public.marshall_records to authenticated;

create policy "Delete today's own records" on public.marshall_records
  for delete to authenticated
  using (user_id = (select auth.uid()) and work_day = (now() at time zone 'Europe/Lisbon')::date);
