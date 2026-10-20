-- Apply the live-session check to the personal profile as well as company data.
grant execute on function private.current_session_is_active() to authenticated;
drop policy profiles_select_shared_organization on public.profiles;
create policy profiles_select_shared_organization on public.profiles for select to authenticated
using ((select private.current_session_is_active()) and (
  id=(select auth.uid()) or (select private.shares_organization_with(id))
));
drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using (id=(select auth.uid()) and (select private.current_session_is_active()))
with check (id=(select auth.uid()) and (select private.current_session_is_active()));

-- Match the organization-first lock order used by invitation preparation.
create or replace function private.complete_member_invitation(p_invitation_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_inv public.member_invitations;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' then raise exception 'Acceso denegado.' using errcode='42501'; end if;
  select * into strict v_inv from public.member_invitations where id=p_invitation_id;
  perform 1 from public.organizations where id=v_inv.organization_id for update;
  select * into strict v_inv from public.member_invitations where id=p_invitation_id for update;
  if not private.member_has_role(v_inv.organization_id,v_inv.invited_by,'admin') then raise exception 'La invitación ya no está autorizada.'; end if;
  if not exists(select 1 from auth.users where id=p_user_id and lower(email)=v_inv.email and invited_at is not null) then
    raise exception 'La cuenta no coincide con la invitación.';
  end if;
  insert into public.organization_members(organization_id,user_id,role,is_active)
  values(v_inv.organization_id,p_user_id,v_inv.role,true);
  update public.profiles set full_name=v_inv.full_name where id=p_user_id;
  update public.member_invitations set user_id=p_user_id,status='sent',updated_at=now() where id=p_invitation_id;
  insert into public.member_access_events(organization_id,actor_id,user_id,new_role,new_active)
  values(v_inv.organization_id,v_inv.invited_by,p_user_id,v_inv.role,true);
end;
$$;
