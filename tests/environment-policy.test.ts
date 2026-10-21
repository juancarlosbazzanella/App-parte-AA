// @vitest-environment node
import { describe, expect, it } from "vitest";
import { environments, migrationArguments, validateFrontendEnvironment } from "../scripts/environment-policy.mjs";
import { buildDevelopmentSnapshot } from "../scripts/development-snapshot.mjs";

const env = (ref: string) => ({ NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" });

describe("environment isolation", () => {
  it("rejects production in local development and Vercel previews", () => {
    expect(() => validateFrontendEnvironment(env(environments.production.projectRef), { development: true })).toThrow();
    expect(() => validateFrontendEnvironment({ ...env(environments.production.projectRef), VERCEL_ENV: "preview" })).toThrow();
  });
  it("rejects development in Vercel production", () => {
    expect(() => validateFrontendEnvironment({ ...env(environments.development.projectRef), VERCEL_ENV: "production" })).toThrow();
  });
  it("accepts the dedicated development project and local containers", () => {
    expect(validateFrontendEnvironment(env(environments.development.projectRef), { development: true })).toBe(environments.development.projectRef);
    expect(validateFrontendEnvironment({ ...env("unused"), NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }, { development: true })).toBe("local");
  });
  it("rejects secret and legacy keys, unknown projects, and URLs containing credentials", () => {
    for (const key of ["", "sb_secret_test", "eyJhbGciOiJIUzI1NiJ9"]) {
      expect(() => validateFrontendEnvironment({ ...env(environments.development.projectRef), NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key })).toThrow();
    }
    expect(() => validateFrontendEnvironment(env("unknown"))).toThrow();
    expect(() => validateFrontendEnvironment({ ...env(environments.development.projectRef), NEXT_PUBLIC_SUPABASE_URL: `https://user:password@${environments.development.projectRef}.supabase.co` })).toThrow();
  });
  it("uses explicit refs for planning and prevents accidental production applies", () => {
    expect(migrationArguments("development", "plan")).toContain("--dry-run");
    expect(migrationArguments("production", "status")).toEqual(["migration", "list", "--project-ref", environments.production.projectRef]);
    expect(() => migrationArguments("production", "apply")).toThrow();
    expect(() => migrationArguments("development", "reset")).toThrow();
    expect(migrationArguments("production", "apply", `--confirm-production=${environments.production.projectRef}`)).not.toContain("--include-seed");
  });
  it("refuses snapshot generation for production and malformed exports", () => {
    expect(() => buildDevelopmentSnapshot({ format: 1 }, environments.production.projectRef)).toThrow(/desarrollo/);
    expect(() => buildDevelopmentSnapshot({ format: 1 }, environments.development.projectRef)).toThrow(/incompatible/);
  });
  it("creates independent accounts and preserves safety checks and triggers", () => {
    const snapshot = {
      format: 1, users: [], organizations: [{ id: "00000000-0000-4000-8000-000000000001", name: "Test", timezone: "Europe/Madrid", work_order_prefix: "PT", next_work_order_number: 8 }],
      organization_members: [], clients: [], machines: [], work_order_corrections: [],
      work_orders: [{ id: "00000000-0000-4000-8000-000000000002", organization_id: "00000000-0000-4000-8000-000000000001", sequence_number: 7, reference: "PT-0007", status: "open", source: "office", technician_user_id: "old" }],
    };
    const result = buildDevelopmentSnapshot(snapshot, environments.development.projectRef);
    expect(result.credentials.map((user: { role: string }) => user.role)).toEqual(["admin", "office", "technician"]);
    expect(new Set(result.credentials.map((user: { password: string }) => user.password)).size).toBe(3);
    expect(result.sql).toContain("Import refused");
    expect(result.sql).toContain("jsonb_populate_record(null::public.work_orders");
    expect(result.sql).not.toMatch(/disable trigger|session_replication_role|truncate/i);
    expect(result.sql.trim()).toMatch(/^begin;[\s\S]*commit;$/);
    expect(snapshot.work_orders[0].technician_user_id).toBe("old");
  });
});
