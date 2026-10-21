import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { environments } from "./environment-policy.mjs";

const columns = {
  organizations: ["id", "name", "timezone", "work_order_prefix", "next_work_order_number"],
  organization_members: ["organization_id", "user_id", "role", "is_active"],
  clients: ["id", "organization_id", "name", "email", "phone", "created_by_user_id", "archived_at"],
  machines: ["id", "organization_id", "client_id", "brand", "model", "serial_number", "installation_address", "created_by_user_id", "archived_at"],
  work_orders: ["id", "organization_id", "client_id", "machine_id", "technician_user_id", "created_by_user_id", "closed_by_user_id", "sequence_number", "reference", "type", "status", "source", "scheduled_date", "scheduled_time", "request", "work_done", "hours", "materials", "observations", "closed_at", "signer_name", "signature_storage_path", "no_signature_reason", "version"],
  work_order_corrections: ["id", "organization_id", "work_order_id", "corrected_by_user_id", "summary", "changed_fields", "version_before", "version_after"],
};

const literal = (value) => `'${value.replaceAll("'", "''")}'`;

export function buildDevelopmentSnapshot(snapshot, projectRef) {
  if (projectRef !== environments.development.projectRef || projectRef === environments.production.projectRef) {
    throw new Error("La importación solo admite el proyecto de desarrollo registrado.");
  }
  if (snapshot.format !== 1 || snapshot.organizations?.length !== 1 || !Array.isArray(snapshot.users)) {
    throw new Error("Snapshot incompatible: revisar el exportador antes de importar.");
  }
  const users = snapshot.users.map((user) => {
    if (!/^[^@]+@dev\.climagest\.invalid$/.test(user.email)) throw new Error("El snapshot contiene una dirección no ficticia.");
    return { ...user, password: `Aa9!${randomBytes(24).toString("base64url")}` };
  });
  const organizationId = snapshot.organizations[0].id;
  const qaUsers = ["admin", "office", "technician"].map((role) => ({
    id: randomUUID(), email: `${role}@dev.climagest.invalid`, full_name: `Pruebas ${role}`,
    disabled: false, password: `Aa9!${randomBytes(24).toString("base64url")}`, role,
  }));
  users.push(...qaUsers);
  const data = structuredClone(snapshot);
  data.organization_members.push(...qaUsers.map((user) => ({ organization_id: organizationId, user_id: user.id, role: user.role, is_active: true })));
  // Give the dedicated technician existing office assignments to exercise RLS.
  const technician = qaUsers.find((user) => user.role === "technician");
  for (const order of data.work_orders) {
    if (order.status === "open" && order.source === "office") order.technician_user_id = technician.id;
  }
  const statements = [
    "begin;",
    // A second import must fail, including if accidentally directed at production.
    `do $$ begin
      if exists(select 1 from auth.users where email not like '%@climagest.demo')
        or exists(select 1 from storage.objects) then
        raise exception 'Import refused: target is not a fresh migrated demo database';
      end if;
    end $$;`,
    "delete from public.member_access_events; delete from public.member_invitations;",
    "delete from public.work_order_photos; delete from public.work_order_corrections;",
    "delete from public.work_orders; delete from public.machines; delete from public.clients;",
    "delete from public.organization_members; delete from public.organizations;",
    "delete from auth.users where email like '%@climagest.demo';",
  ];
  for (const user of users) {
    statements.push(`insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
      confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,
      raw_app_meta_data,raw_user_meta_data,created_at,updated_at,is_sso_user,is_anonymous,banned_until)
      values ('00000000-0000-0000-0000-000000000000',${literal(user.id)},'authenticated','authenticated',
      ${literal(user.email)},extensions.crypt(${literal(user.password)},extensions.gen_salt('bf')),now(),
      '','','','','','{"provider":"email","providers":["email"]}',
      ${literal(JSON.stringify({ full_name: user.full_name }))}::jsonb,now(),now(),false,false,
      ${user.disabled ? "now()+interval '100 years'" : "null"});`);
    statements.push(`insert into auth.identities (id,provider_id,user_id,identity_data,provider,created_at,updated_at)
      values (gen_random_uuid(),${literal(user.id)},${literal(user.id)},
      ${literal(JSON.stringify({ sub: user.id, email: user.email, email_verified: true }))}::jsonb,'email',now(),now());`);
  }
  for (const [table, names] of Object.entries(columns)) {
    if (!Array.isArray(data[table])) throw new Error(`Falta la tabla ${table}.`);
    for (const row of data[table]) {
      if (Object.keys(row).some((name) => !names.includes(name))) throw new Error(`Columna inesperada en ${table}.`);
    }
    if (table === "work_orders") {
      // Reproduce historical allocations without disabling any trigger or constraint.
      for (const order of data.work_orders) {
        statements.push(`update public.organizations set next_work_order_number=${literal(String(order.sequence_number))}::bigint
          where id=${literal(order.organization_id)}::uuid;`);
        statements.push(`insert into public.work_orders (${names.join(",")})
          select ${names.join(",")} from jsonb_populate_record(null::public.work_orders, ${literal(JSON.stringify(order))}::jsonb);`);
      }
    } else {
      statements.push(`insert into public.${table} (${names.join(",")})
        select ${names.join(",")} from jsonb_populate_recordset(null::public.${table}, ${literal(JSON.stringify(data[table]))}::jsonb);`);
    }
  }
  statements.push(`update public.organizations o set next_work_order_number=greatest(o.next_work_order_number,
    (select x.next_work_order_number from jsonb_populate_recordset(null::public.organizations,
      ${literal(JSON.stringify(data.organizations))}::jsonb) x where x.id=o.id),
    coalesce((select max(w.sequence_number)+1 from public.work_orders w where w.organization_id=o.id),1));`);
  statements.push("commit;");
  return { sql: statements.join("\n"), credentials: qaUsers.map(({ email, password, role }) => ({ email, password, role })) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error("Uso: pnpm db:dev:prepare-copy <snapshot.json>");
  const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const snapshot = Array.isArray(input) ? input[0]?.snapshot : input;
  const result = buildDevelopmentSnapshot(snapshot, environments.development.projectRef);
  const directory = new URL("../outputs/supabase-environments/prepared/", import.meta.url);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  // Never overwrite a prior set of credentials or a reviewed import.
  writeFileSync(new URL("import-development.sql", directory), result.sql, { flag: "wx", mode: 0o600 });
  writeFileSync(new URL("development-credentials.json", directory), JSON.stringify(result.credentials, null, 2), { flag: "wx", mode: 0o600 });
  console.log("Importación preparada para desarrollo en outputs/supabase-environments/prepared/. Revisa el SQL antes de ejecutarlo.");
}
