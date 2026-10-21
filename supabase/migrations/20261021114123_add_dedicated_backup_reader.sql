-- Runtime passwords are provisioned separately in the backup runner's private
-- configuration. This migration never grants API roles access to backup data.
create role climagest_backup_reader
  nologin nosuperuser nocreatedb nocreaterole noreplication
  inherit bypassrls connection limit 3;

grant pg_read_all_data to climagest_backup_reader;
grant connect on database postgres to climagest_backup_reader;

alter role climagest_backup_reader set default_transaction_read_only = on;
alter role climagest_backup_reader set statement_timeout = '10min';
alter role climagest_backup_reader set lock_timeout = '15s';
alter role climagest_backup_reader set idle_in_transaction_session_timeout = '10min';
alter role climagest_backup_reader set search_path = pg_catalog;

comment on role climagest_backup_reader is
  'Dedicated backup reader. BYPASSRLS and pg_read_all_data include sensitive Auth data. PUBLIC privileges still apply; read-only is a session default, not an absolute write barrier. Never grant this role to authenticator, anon or authenticated.';
