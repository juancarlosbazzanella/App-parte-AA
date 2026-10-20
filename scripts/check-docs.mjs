import { lstat, readFile, readlink } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "docs/architecture.md",
  "docs/current-state.md",
  "docs/decisions/001-database.md",
  "docs/decisions/002-authentication.md",
  "docs/decisions/003-supabase-persistence.md",
  "docs/decisions/004-supabase-auth-rls.md",
  "docs/decisions/005-pnpm-supply-chain.md",
  "docs/security-audit-2026-09-23.md",
];

await Promise.all(requiredFiles.map((file) => readFile(resolve(root, file))));

const claudePath = resolve(root, "CLAUDE.md");
const claudeStats = await lstat(claudePath);
if (!claudeStats.isSymbolicLink()) {
  throw new Error("CLAUDE.md must remain a symbolic link to AGENTS.md.");
}

const linkTarget = await readlink(claudePath);
if (resolve(root, linkTarget) !== resolve(root, "AGENTS.md")) {
  throw new Error("CLAUDE.md must point to AGENTS.md.");
}

const [agents, claude] = await Promise.all([
  readFile(resolve(root, "AGENTS.md"), "utf8"),
  readFile(claudePath, "utf8"),
]);
if (agents !== claude) {
  throw new Error("AGENTS.md and CLAUDE.md are not synchronized.");
}

console.log("Documentation structure and agent guides are synchronized.");
