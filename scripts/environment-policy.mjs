import { readFileSync } from "node:fs";

export const environments = JSON.parse(readFileSync(new URL("../supabase/environments.json", import.meta.url), "utf8"));

export function validateFrontendEnvironment(env, { development = false } = {}) {
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "http://missing.invalid");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  const target = development || env.VERCEL_ENV === "preview" ? "development"
    : env.VERCEL_ENV === "production" ? "production" : null;
  const ref = url.hostname.split(".")[0];
  const known = Object.values(environments).some((entry) => entry.projectRef === ref);
  if ((!local && (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co") || !known))
    || (target && !(local && target === "development") && ref !== environments[target].projectRef)) {
    throw new Error(`Supabase incorrecto para ${target ?? "este proyecto"}. Consulta docs/environments.md.`);
  }
  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("La URL de Supabase debe contener únicamente el origen.");
  }
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!key.startsWith("sb_publishable_")) {
    throw new Error("Usa una clave sb_publishable_ en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  return local ? "local" : ref;
}

export function migrationArguments(environment, operation, confirmation) {
  const target = environments[environment];
  if (!target || !["development", "production"].includes(environment)) throw new Error("Indica development o production.");
  if (environments.development.projectRef === environments.production.projectRef) throw new Error("Los entornos deben ser distintos.");
  const destination = ["--project-ref", target.projectRef];
  if (operation === "status") return ["migration", "list", ...destination];
  if (operation === "plan") return ["db", "push", ...destination, "--skip-vault", "--dry-run"];
  if (operation !== "apply") throw new Error("Operación válida: status, plan o apply.");
  if (environment === "production" && confirmation !== `--confirm-production=${target.projectRef}`) {
    throw new Error(`Producción requiere --confirm-production=${target.projectRef} y autorización del responsable.`);
  }
  return ["db", "push", ...destination, "--skip-vault"];
}
