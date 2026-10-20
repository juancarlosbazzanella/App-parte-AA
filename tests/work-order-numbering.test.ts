// @vitest-environment node

import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

// PostgreSQL executes the real migration and trigger. This minimal schema
// isolates numbering; full Supabase authorization remains in authorization.sql.
let database: PGlite;
const organizationId = "00000000-0000-4000-8000-000000000001";
const otherOrganizationId = "00000000-0000-4000-8000-000000000002";
const newOrganizationId = "00000000-0000-4000-8000-000000000003";

type NumberedPart = { id: string; reference: string; sequence_number: number };

async function createPart(source = "office", organization = organizationId, id = crypto.randomUUID()) {
  const result = await database.query<NumberedPart>(`
    insert into public.work_orders (id, organization_id, source)
    values ($1, $2, $3) returning id, reference, sequence_number
  `, [id, organization, source]);
  return result.rows[0];
}

beforeAll(async () => {
  database = new PGlite();
  await database.exec(`
    create role authenticated;
    create schema private;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
    create table public.organizations (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      timezone text not null default 'Europe/Madrid',
      work_order_prefix text not null default 'PT',
      next_work_order_number bigint not null default 1 check (next_work_order_number > 0)
    );
    create table public.work_orders (
      id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id),
      sequence_number bigint not null,
      reference text not null,
      source text not null check (source in ('office', 'urgent')),
      unique (organization_id, sequence_number),
      unique (organization_id, reference)
    );
    grant update (name, timezone, work_order_prefix) on public.organizations to authenticated;
    insert into public.organizations (id, name, work_order_prefix, next_work_order_number)
    values ('${organizationId}', 'Fixture with custom prefix', 'PT2', 1),
           ('${otherOrganizationId}', 'Fixture with reserved numbers', 'OLD', 500);
  `);

  const originalSchema = await readFile(new URL("../supabase/migrations/20260917094424_create_climagest_schema.sql", import.meta.url), "utf8");
  const originalTrigger = originalSchema.match(/create or replace function private\.set_work_order_reference\(\)[\s\S]+?execute function private\.set_work_order_reference\(\);/);
  if (!originalTrigger) throw new Error("The original numbering trigger was not found.");
  await database.exec(originalTrigger[0]);
  await database.exec(`
    insert into public.work_orders (organization_id, sequence_number, reference, source)
    values ('${organizationId}', 1001, 'PT2-1001', 'office'),
           ('${otherOrganizationId}', 7, 'OLD-0007', 'urgent');
  `);

  const migration = await readFile(new URL("../supabase/migrations/20261020105413_fixed_work_order_numbering.sql", import.meta.url), "utf8");
  await database.exec(migration);
}, 20_000);

beforeEach(async () => {
  await database.exec("begin;");
});

afterEach(async () => {
  await database.exec("rollback;");
});

afterAll(async () => {
  await database?.close();
});

it("normalizes the configured prefix without changing historical parts", async () => {
  const organizations = await database.query<{ work_order_prefix: string; next_work_order_number: number }>("select work_order_prefix, next_work_order_number from public.organizations order by id");
  expect(organizations.rows).toEqual([
    { work_order_prefix: "PT", next_work_order_number: 1002 },
    { work_order_prefix: "PT", next_work_order_number: 500 },
  ]);
  const parts = await database.query("select reference, sequence_number from public.work_orders order by organization_id");
  expect(parts.rows).toEqual([{ reference: "PT2-1001", sequence_number: 1001 }, { reference: "OLD-0007", sequence_number: 7 }]);
});

it("continues after the largest historical sequence when its counter was behind", async () => {
  expect(await createPart()).toMatchObject({ reference: "PT-1002", sequence_number: 1002 });
  expect(await createPart()).toMatchObject({ reference: "PT-1003", sequence_number: 1003 });
});

it("shares one consecutive sequence between planned work and urgent work", async () => {
  const parts = [await createPart("office"), await createPart("urgent"), await createPart("office")];
  expect(parts.map((part) => part.reference)).toEqual(["PT-1002", "PT-1003", "PT-1004"]);
});

it("overrides supplied prefixes and numbers on every new insert", async () => {
  const part = await database.query<NumberedPart>(`
    insert into public.work_orders (organization_id, source, sequence_number, reference)
    values ($1, 'office', 9999, 'CUSTOM-9999') returning reference, sequence_number
  `, [organizationId]);
  expect(part.rows[0]).toEqual({ reference: "PT-1002", sequence_number: 1002 });
});

it("does not reuse a counter that is ahead of the historical maximum", async () => {
  expect(await createPart("office", otherOrganizationId)).toMatchObject({ reference: "PT-0500", sequence_number: 500 });
});

it("starts a new company at PT-0001 without changing another company's counter", async () => {
  await database.query("insert into public.organizations (id, name) values ($1, 'New fixture')", [newOrganizationId]);
  expect(await createPart("office", newOrganizationId)).toMatchObject({ reference: "PT-0001", sequence_number: 1 });
  expect(await createPart()).toMatchObject({ reference: "PT-1002", sequence_number: 1002 });
});

it("keeps all digits after PT-9999", async () => {
  await database.query("update public.organizations set next_work_order_number=9999 where id=$1", [organizationId]);
  const parts = [await createPart(), await createPart(), await createPart()];
  expect(parts.map((part) => part.reference)).toEqual(["PT-9999", "PT-10000", "PT-10001"]);
});

it("rolls back the counter when an insert fails", async () => {
  const first = await createPart();
  await database.exec("savepoint failed_insert;");
  await expect(createPart("office", organizationId, first.id)).rejects.toThrow(/duplicate key/);
  await database.exec("rollback to savepoint failed_insert;");
  expect(await createPart()).toMatchObject({ reference: "PT-1003", sequence_number: 1003 });
});

it("assigns a unique consecutive number to each part in a batch", async () => {
  const parts = await database.query<{ sequence_number: number }>(`
    insert into public.work_orders (organization_id, source)
    select $1, 'office' from generate_series(1, 20) returning sequence_number
  `, [organizationId]);
  expect(parts.rows.map((part) => part.sequence_number)).toEqual(Array.from({ length: 20 }, (_, index) => 1002 + index));
  expect(await createPart()).toMatchObject({ reference: "PT-1022", sequence_number: 1022 });
});

it("rejects configuration with a prefix other than PT", async () => {
  await expect(database.query("update public.organizations set work_order_prefix='OTHER' where id=$1", [organizationId])).rejects.toThrow(/organizations_fixed_work_order_prefix/);
});

it("revokes prefix changes from authenticated users", async () => {
  const privileges = await database.query("select has_column_privilege('authenticated', 'public.organizations', 'work_order_prefix', 'UPDATE') as prefix, has_column_privilege('authenticated', 'public.organizations', 'name', 'UPDATE') as name");
  expect(privileges.rows).toEqual([{ prefix: false, name: true }]);
});

it("rejects parts for a nonexistent company", async () => {
  await expect(createPart("office", newOrganizationId)).rejects.toThrow("La empresa indicada no existe.");
});
