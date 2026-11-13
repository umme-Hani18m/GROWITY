-- Persistent child-code lockout. This is additive and does not alter existing child credentials.
create table if not exists public.child_pin_lockouts (
  child_id uuid primary key references public.children(id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.child_pin_lockouts enable row level security;
revoke all on table public.child_pin_lockouts from public, anon, authenticated;

create or replace function public.is_child_pin_locked(p_child_id uuid)
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.child_pin_lockouts
    where child_id = p_child_id and locked_at is not null
  );
$$;

create or replace function public.record_child_pin_failure(p_child_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  currently_locked boolean;
begin
  if p_child_id is null then return true; end if;
  insert into public.child_pin_lockouts(child_id, failed_attempts, locked_at)
  values (p_child_id, 1, null)
  on conflict (child_id) do update
    set failed_attempts = case
      when public.child_pin_lockouts.locked_at is not null then public.child_pin_lockouts.failed_attempts
      else public.child_pin_lockouts.failed_attempts + 1
    end,
    locked_at = case
      when public.child_pin_lockouts.locked_at is not null then public.child_pin_lockouts.locked_at
      when public.child_pin_lockouts.failed_attempts + 1 >= 10 then now()
      else null
    end,
    updated_at = now()
  returning locked_at is not null into currently_locked;
  return coalesce(currently_locked, true);
end;
$$;

create or replace function public.reset_child_pin_lockout(p_child_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if p_child_id is null then return false; end if;
  delete from public.child_pin_lockouts where child_id = p_child_id;
  return found;
end;
$$;

revoke all on function public.is_child_pin_locked(uuid) from public, anon, authenticated;
revoke all on function public.record_child_pin_failure(uuid) from public, anon, authenticated;
revoke all on function public.reset_child_pin_lockout(uuid) from public, anon, authenticated;
grant execute on function public.is_child_pin_locked(uuid) to service_role;
grant execute on function public.record_child_pin_failure(uuid) to service_role;
grant execute on function public.reset_child_pin_lockout(uuid) to service_role;
