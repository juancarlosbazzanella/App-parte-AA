-- Check live sessions as well as membership: logout and revocation also stop old JWTs.
create function private.current_session_is_active()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.sessions s where s.id::text=auth.jwt()->>'session_id'
      and s.user_id=auth.uid() and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function private.current_session_is_active() from public, anon, authenticated;

create or replace function private.current_user_is_member(p_organization_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select private.current_session_is_active() and exists (
    select 1 from public.organization_members m where m.organization_id=p_organization_id
      and m.user_id=auth.uid() and m.is_active
  );
$$;
create or replace function private.current_user_has_role(p_organization_id uuid, p_role public.member_role)
returns boolean language sql stable security definer set search_path='' as $$
  select private.current_session_is_active() and exists (
    select 1 from public.organization_members m where m.organization_id=p_organization_id
      and m.user_id=auth.uid() and m.is_active
      and (m.role=p_role or (p_role='office' and m.role='admin'))
  );
$$;
create or replace function private.shares_organization_with(p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.organization_members a join public.organization_members b
    on a.organization_id=b.organization_id where a.user_id=auth.uid() and a.is_active
    and b.user_id=p_user_id and private.current_user_is_member(a.organization_id));
$$;

-- Old public demo passwords must never become usable through account reactivation.
create function private.guard_legacy_membership()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.is_active and exists(select 1 from auth.users where id=new.user_id and lower(email) like '%@climagest.demo') then
    raise exception 'Las cuentas de demostración no se pueden reactivar.';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_legacy_membership() from public, anon, authenticated;
create trigger organization_members_guard_legacy before insert or update on public.organization_members
for each row execute function private.guard_legacy_membership();
