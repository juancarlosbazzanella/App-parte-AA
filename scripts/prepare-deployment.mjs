import { access, lstat, symlink } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const guide = resolve(root, "CLAUDE.md");

// ZIP uploads omit symbolic links; recreate only a missing guide before checks.
// An existing file or incorrect link is left intact for docs:check to reject.
try {
  await lstat(guide);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await access(resolve(root, "AGENTS.md"));
  await symlink("AGENTS.md", guide);
}
