-- Retire only the fictitious shared demo accounts, never real customer accounts.
-- Preserve their IDs so historical authorship and assignments remain intact.
update auth.users set
  banned_until = now() + interval '100 years',
  encrypted_password = extensions.crypt(encode(extensions.gen_random_bytes(32), 'hex'), extensions.gen_salt('bf')),
  updated_at = now()
where lower(email) like '%@climagest.demo';

delete from auth.sessions where user_id in (
  select id from auth.users where lower(email) like '%@climagest.demo'
);
