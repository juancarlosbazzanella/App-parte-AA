-- A dedicated non-member Auth user can download Storage objects for backups.
-- The operator registers its user ID separately; no generated IDs or secrets
-- are embedded in migration history. API roles cannot edit this allowlist.
create table private.backup_storage_readers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true
);
alter table private.backup_storage_readers enable row level security;
revoke all on private.backup_storage_readers from public, anon, authenticated;

create function private.is_backup_storage_reader()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.backup_storage_readers r
    join auth.sessions s on s.user_id = r.user_id
    where r.enabled
      and r.user_id = (select auth.uid())
      and s.id::text = (select auth.jwt() ->> 'session_id')
      and (s.not_after is null or s.not_after > now())
  );
$$;
revoke all on function private.is_backup_storage_reader() from public, anon;
grant execute on function private.is_backup_storage_reader() to authenticated;

create policy backup_reader_downloads on storage.objects
for select to authenticated
using ((select private.is_backup_storage_reader()));

comment on table private.backup_storage_readers is
  'Operator-managed Storage download-only identities. No company membership; no write policies. Disable or delete the row and revoke Auth sessions to retire an identity.';
comment on function private.is_backup_storage_reader() is
  'Checks the private operator allowlist and the live Auth session. Does not trust user_metadata or grant application membership.';
