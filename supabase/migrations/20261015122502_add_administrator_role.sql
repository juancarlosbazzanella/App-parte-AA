-- A separate migration commits the enum value before it is used by policies.
alter type public.member_role add value if not exists 'admin';
