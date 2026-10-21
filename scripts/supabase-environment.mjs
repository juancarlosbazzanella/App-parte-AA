import { spawnSync } from "node:child_process";
import { migrationArguments } from "./environment-policy.mjs";

const [environment, operation, confirmation, ...extra] = process.argv.slice(2);
if (extra.length) throw new Error("No se admiten argumentos adicionales.");
if (confirmation && !(environment === "production" && operation === "apply")) throw new Error("Confirmación inesperada.");
const args = migrationArguments(environment, operation, confirmation);
console.error(`Supabase ${environment}: ${operation}. El destino se selecciona explícitamente.`);
const result = spawnSync("corepack", ["pnpm", "exec", "supabase", ...args], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
