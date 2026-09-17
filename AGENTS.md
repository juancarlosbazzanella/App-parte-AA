# Repository Guidelines

## Project Structure & Module Organization

ClimaGest is a Next.js 16/React 19 TypeScript application backed by Supabase. Routes and styles live in `src/app/`; feature UI in `src/components/`; domain mapping and Supabase access in `src/lib/climagest.ts`. Keep `src/components/ui/` close to upstream. Database migrations live in `supabase/migrations/`; generated database types live in `src/lib/database.types.ts`. The old `src/db/`, `drizzle/`, and `drizzle.config.ts` scaffolding is inactive. Use `public/` for assets, `tests/` for checks, and `docs/` for maintained knowledge. `dist/` and `.next/` are generated.

## Build, Test, and Development Commands

- `npm install`: install locked dependencies; Node.js 22.13+ is required.
- `npm run dev`: start the server at `http://localhost:5173`.
- `npm run docs:check`: verify required documentation and the synchronized agent guides.
- `npm run lint`: run Next.js and TypeScript ESLint rules.
- `npx tsc --noEmit --pretty false --incremental false`: run a strict type-check.
- `npm run build`: create the production bundle in `dist/`.
- `npm start`: serve an existing build locally through Wrangler.
- `npm run db:generate -- <name>`: create a timestamped Supabase migration before editing its SQL.

Before submitting, run the documentation check, lint, the clean type-check, and the production build.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, double quotes, and semicolons. Name components and exported types in PascalCase (`SignaturePad`, `WorkOrder`), variables and functions in camelCase (`climagestRepository`), and hooks with a `use` prefix. Use `@/` for `src/` imports. Keep persistence behind `src/lib/climagest.ts`, permission enforcement in RLS, and generated database types synchronized with the remote schema. Avoid hand-editing vendored UI files.

## Testing Guidelines

No automated test framework is configured. Exercise affected office and technician flows at desktop and mobile widths. When relevant, verify role isolation, persistence, machine history, both closure paths, and data restoration. Add future tests as `*.test.ts(x)` and expose their runner in `package.json`.

## Documentation Discipline

Every code or configuration change must update its corresponding documentation in the same change. Always refresh `docs/current-state.md`; update `docs/architecture.md` when boundaries or data flow change, and add a numbered ADR under `docs/decisions/` for durable technical choices. `AGENTS.md` is canonical and `CLAUDE.md` is its symbolic link; never replace the link with a separate file. Run `npm run docs:check` after documentation edits.

## Commit & Pull Request Guidelines

The repository uses `main` as its primary branch. Use focused commits with imperative subjects, for example `Fix technician work-order filtering`. Pull requests should explain behavior, list verification, link issues, and include screenshots for UI changes. Highlight fixture, storage-format, or migration changes.

### Mandatory Git Authorization

Never run `git add`, `git commit`, or `git push`, and never upload or publish changes to any local or remote repository, unless the user has given explicit authorization for that specific Git operation. A request to edit, implement, test, review, or prepare changes does not imply authorization to stage, commit, push, or otherwise publish them. Leave completed changes unstaged until that authorization is given.

## Security & Local Data

The included accounts and records are fictitious demo data. Never commit real customer data, credentials, signatures, photos, secret keys, or a Supabase `service_role` key. Only the publishable key may be exposed to the browser. Version every schema, RLS, function, and Storage-policy change in `supabase/migrations/`.
