import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";
import { projectRoot } from "./sites-env.mjs";
import { readExecutionProfile } from "./execution-profile.mjs";

if (!process.env.npm_execpath || !process.env.npm_config_user_agent?.startsWith("pnpm/")) {
  throw new Error("Run this installer with pnpm run install:ci.");
}

if (![
  "SHARP_IGNORE_GLOBAL_LIBVIPS",
  "SHARP_FORCE_GLOBAL_LIBVIPS",
  "npm_config_build_from_source",
  "NPM_CONFIG_BUILD_FROM_SOURCE",
].some((key) => key in process.env)) {
  process.env.SHARP_IGNORE_GLOBAL_LIBVIPS = "1";
}

if (readExecutionProfile() === "managed-linux") {
  const result = spawnSync("bash", [path.join(projectRoot, "scripts/install-pnpm.sh")], {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

// Invoke pnpm's JavaScript entrypoint, avoiding platform-specific shell shims.
const installed = spawnSync(
  process.execPath,
  [
    process.env.npm_execpath, "install", "--frozen-lockfile", "--prod=false",
    "--prefer-offline",
  ],
  { cwd: projectRoot, stdio: "inherit" },
);
if (installed.error) throw installed.error;
if (installed.status !== 0) process.exit(installed.status ?? 1);

try {
  accessSync(
    path.join(
      projectRoot, "node_modules", ".bin",
      process.platform === "win32" ? "vinext.cmd" : "vinext",
    ),
    process.platform === "win32" ? constants.F_OK : constants.X_OK,
  );
} catch {
  console.error("pnpm install exited successfully but the local vinext executable is unavailable.");
  process.exitCode = 69;
}
