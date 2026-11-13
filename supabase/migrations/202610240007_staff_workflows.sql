begin;

create table public.case_meetings (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.parent_applications(id) on delete restrict,
  child_id uuid not null references public.children(id) on delete restrict,
  starts_at timestamptz not null,
  meeting_type text not null check (meeting_type in ('counselling', 'meeting')),
  location text not null default '' check (length(location) <= 240),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.compatibility_notes (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.parent_applications(id) on delete restrict,
  child_id uuid not null references public.children(id) on delete restrict,
  note text not null check (length(trim(note)) between 1 and 4000),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index case_meetings_application_time_idx on public.case_meetings(application_id, starts_at);
create index compatibility_notes_application_idx on public.compatibility_notes(application_id, created_at desc);

alter table public.case_meetings enable row level security;
alter table public.compatibility_notes enable row level security;

revoke all on table public.case_meetings from anon, authenticated;
revoke all on table public.compatibility_notes from anon, authenticated;
grant select, insert, update on table public.case_meetings to authenticated;
grant select, insert on table public.compatibility_notes to authenticated;

create policy case_meetings_parent_read
on public.case_meetings for select to authenticated
using (
  (select app_private.current_role()) = 'parent'
  and exists (select 1 from public.parent_applications a where a.id = case_meetings.application_id and a.user_id = (select auth.uid()))
  and exists (select 1 from public.parent_child_referrals r where r.application_id = case_meetings.application_id and r.child_id = case_meetings.child_id)
);
create policy case_meetings_caseworker_read
on public.case_meetings for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'caseworker'
  and (select app_private.staff_mfa_verified())
  and (select app_private.is_assigned_to_parent(case_meetings.application_id))
);
create policy case_meetings_caseworker_insert
on public.case_meetings for insert to authenticated
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'caseworker'
  and (select app_private.staff_mfa_verified())
  and created_by = (select auth.uid())
  and (select app_private.is_assigned_to_parent(case_meetings.application_id))
  and exists (select 1 from public.parent_child_referrals r where r.application_id = case_meetings.application_id and r.child_id = case_meetings.child_id)
);
create policy case_meetings_caseworker_update
on public.case_meetings for update to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'caseworker'
  and (select app_private.staff_mfa_verified())
  and (select app_private.is_assigned_to_parent(case_meetings.application_id))
)
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'caseworker'
  and (select app_private.staff_mfa_verified())
  and (select app_private.is_assigned_to_parent(case_meetings.application_id))
  and exists (select 1 from public.parent_child_referrals r where r.application_id = case_meetings.application_id and r.child_id = case_meetings.child_id)
);

create policy compatibility_notes_caseworker_read
on public.compatibility_notes for select to authenticated
using (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'caseworker'
  and (select app_private.staff_mfa_verified())
  and (select app_private.is_assigned_to_parent(compatibility_notes.application_id))
);
create policy compatibility_notes_caseworker_insert
on public.compatibility_notes for insert to authenticated
with check (
  (select app_private.current_role()) = 'staff'
  and (select app_private.current_sub_role()) = 'caseworker'
  and (select app_private.staff_mfa_verified())
  and created_by = (select auth.uid())
  and (select app_private.is_assigned_to_parent(compatibility_notes.application_id))
  and exists (select 1 from public.parent_child_referrals r where r.application_id = compatibility_notes.application_id and r.child_id = compatibility_notes.child_id)
);

create trigger case_meetings_updated_at before update on public.case_meetings for each row execute function public.set_updated_at();
create trigger case_meetings_audit after insert or update on public.case_meetings for each row execute function public.audit_sensitive_change();
create trigger compatibility_notes_audit after insert on public.compatibility_notes for each row execute function public.audit_sensitive_change();
create trigger compatibility_notes_append_only before update or delete on public.compatibility_notes for each row execute function public.prevent_append_only_mutation();

create or replace function public.record_complaint_update_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if new.status is distinct from old.status then
    insert into public.complaint_events(complaint_id, event_type, event_summary, is_child_visible, actor_user_id)
    values (new.id, 'status_changed', 'Report status updated.', true, coalesce((select auth.uid()), new.outcome_recorded_by, new.reporter_user_id));
  end if;
  if new.outcome_contacted is distinct from old.outcome_contacted
    or new.outcome_contacted_at is distinct from old.outcome_contacted_at
    or new.outcome_method is distinct from old.outcome_method then
    insert into public.complaint_events(complaint_id, event_type, event_summary, is_child_visible, actor_user_id)
    values (new.id, 'outcome_recorded', 'Emergency response outcome recorded.', false, coalesce((select auth.uid()), new.outcome_recorded_by));
  end if;
  return new;
end;
$$;
revoke all on function public.record_complaint_update_event() from public, anon, authenticated;
create trigger complaints_update_event after update on public.complaints for each row execute function public.record_complaint_update_event();

create or replace function public.log_case_record_view(p_entity_table text, p_entity_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth, app_private
as $$
declare
  actor uuid := (select auth.uid());
  allowed boolean := false;
begin
  if actor is null then raise exception 'Not authorized.' using errcode = '42501'; end if;
  if p_entity_table = 'case_meetings' then
    allowed := exists (
      select 1 from public.case_meetings m join public.parent_applications a on a.id = m.application_id
      where m.id = p_entity_id and (
        (app_private.current_role() = 'parent' and a.user_id = actor)
        or (app_private.current_role() = 'staff' and app_private.current_sub_role() = 'caseworker' and app_private.staff_mfa_verified() and app_private.is_assigned_to_parent(m.application_id))
      )
    );
  elsif p_entity_table = 'compatibility_notes' then
    allowed := app_private.current_role() = 'staff'
      and app_private.current_sub_role() = 'caseworker'
      and app_private.staff_mfa_verified()
      and exists (select 1 from public.compatibility_notes n where n.id = p_entity_id and app_private.is_assigned_to_parent(n.application_id));
  end if;
  if not allowed then raise exception 'Not authorized.' using errcode = '42501'; end if;
  insert into public.audit_log(actor_id, entity_table, entity_id, action)
  values (actor, p_entity_table, p_entity_id, 'view');
end;
$$;
revoke all on function public.log_case_record_view(text, uuid) from public, anon;
grant execute on function public.log_case_record_view(text, uuid) to authenticated;

commit;
