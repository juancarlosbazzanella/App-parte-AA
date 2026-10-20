# Repository Guidelines

## Project Structure & Module Organization

ClimaGest is a Next.js 16/React 19 TypeScript application backed by Supabase. Routes and styles live in `src/app/`; feature UI in `src/components/`; domain mapping and Supabase access in `src/lib/climagest.ts`. Keep `src/components/ui/` close to upstream. Database migrations live in `supabase/migrations/`; generated database types live in `src/lib/database.types.ts`. The old `src/db/`, `drizzle/`, and `drizzle.config.ts` scaffolding is inactive. Use `public/` for assets, `tests/` for checks, and `docs/` for maintained knowledge. `dist/` and `.next/` are generated.

## Build, Test, and Development Commands

- `corepack enable && pnpm install --frozen-lockfile`: install locked dependencies with the pinned pnpm 11.25.0; Node.js 22.13+ is required.
- `pnpm dev`: start the server at `http://localhost:5173`.
- `pnpm docs:check`: verify required documentation and the synchronized agent guides.
- `pnpm lint`: run Next.js and TypeScript ESLint rules.
- `pnpm exec tsc --noEmit --pretty false --incremental false`: run a strict type-check.
- `pnpm build`: create the production bundle in `dist/`.
- `pnpm start`: serve an existing build locally through Wrangler.
- `pnpm db:generate -- <name>`: create a timestamped Supabase migration before editing its SQL.
- `pnpm test`: run the isolated Vitest repository and React behavior tests without credentials.
- `pnpm test:watch`: rerun affected tests while editing.
- `pnpm test:coverage`: run tests and write an HTML report to `coverage/`.
- `pnpm test:numbering`: execute the numbering migration in isolated PostgreSQL via PGlite, without Docker or credentials.
- `pnpm test:permissions`: run the rollback-based SQL permission suite against local Supabase (requires Docker or Podman).
- `pnpm security:audit`: fail when the dependency graph contains a high or critical advisory.

Before submitting, run the documentation check, tests, lint, the clean type-check, and the production build.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, double quotes, and semicolons. Name components and exported types in PascalCase (`SignaturePad`, `WorkOrder`), variables and functions in camelCase (`climagestRepository`), and hooks with a `use` prefix. Use `@/` for `src/` imports. Keep persistence behind `src/lib/climagest.ts`, permission enforcement in RLS, and generated database types synchronized with the remote schema. Avoid hand-editing vendored UI files.

## Testing Guidelines

Vitest and React Testing Library cover critical repository contracts and interface behavior. Add focused regression tests as `tests/**/*.test.ts(x)` for business rules, failure paths, and role-sensitive flows. Tests mock Supabase at its client boundary and block fetch; never use production credentials or send real emails. The numbering suite executes its actual migration and trigger in isolated PostgreSQL via PGlite. Run `pnpm test:permissions` against local Supabase for full RLS/RPC checks; mocks and the minimal numbering schema do not establish database authorization. See `docs/testing.md` for scope and commands. Also exercise affected office and technician flows at desktop and mobile widths: jsdom does not verify layout, touch drawing, or real integrations.

## Documentation Discipline

Every code or configuration change must update its corresponding documentation in the same change. Always refresh `docs/current-state.md`; update `docs/architecture.md` when boundaries or data flow change, and add a numbered ADR under `docs/decisions/` for durable technical choices. `AGENTS.md` is canonical and `CLAUDE.md` is its symbolic link; never replace the link with a separate file. Run `pnpm docs:check` after documentation edits.

## Commit & Pull Request Guidelines

Always work on `main`. All authorized repository uploads must target `main`; never create another branch or a branch-based worktree unless the user explicitly asks for it. If the checkout is on another branch, stop before editing and ask how to proceed rather than switching or creating branches automatically. Use focused commits with imperative subjects when authorized, for example `Fix technician work-order filtering`. Highlight fixture, storage-format, or migration changes in any authorized delivery.

### Mandatory Git Authorization

Never run `git add`, `git commit`, or `git push`, and never upload or publish anything to any local or remote repository through Git, a CLI, an API, a browser, or any other mechanism, unless the user has given explicit authorization for that specific operation. A request to edit, implement, test, review, or prepare changes does not imply authorization to stage, commit, push, or otherwise publish them. Leave completed changes unstaged until that authorization is given. Authorization for one operation does not authorize the others.

## Security & Local Data

The included accounts and records are fictitious demo data. Never commit real customer data, credentials, signatures, photos, secret keys, or a Supabase `service_role` key. Only the publishable key may be exposed to the browser. Version every schema, RLS, function, and Storage-policy change in `supabase/migrations/`.

### Dependency Supply Chain

Use only the SHA-512-pinned pnpm version declared in `package.json`; do not use npm, Yarn, `npx`, or create another lockfile. Install with `pnpm install --frozen-lockfile`, keep `pnpm-lock.yaml` committed, preserve the seven-day minimum package age and exotic-transitive-source blocking in `pnpm-workspace.yaml`, and explicitly review every dependency allowed to run installation scripts. Never disable these controls to make an install pass. Run `pnpm security:audit` before delivery and investigate every high or critical advisory.
