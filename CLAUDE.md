# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project overview

Tomely is a private home-library application. It was previously built as a SaaS on
AWS (SST, Lambda, Aurora, API Gateway, CloudFront, Clerk); that stack has been
removed and the project rebuilt as something self-hosted. The old version is still
in the `main` branch's history if you need to see how something used to work.

- **Web app** (`app/`) — TanStack Start (React 19, TanStack Router, TanStack Query),
  Mantine v9, server-rendered, built by Nitro to a plain Node server.
- **API** (`src/`) — a single Rust crate at the repository root: axum + SeaORM.
- **Database** — Postgres, run locally via `docker-compose.yml`.
- **Auth** — local accounts, JWT bearer tokens. Clerk is gone, not ported.

Both halves are meant to run as containers eventually. Nothing here should
reintroduce a dependency on a specific cloud provider.

## Commands

From the repository root.

```bash
# Database
docker compose up -d
docker compose exec postgres psql -U postgres -d tomely

# API
cargo run                                  # bin "server", :8080
cargo run --bin migrate -- up              # also: down, status, fresh
cargo test
cargo clippy --all-targets -- -D warnings
cargo fmt

# Web app
npm install                    # workspace install, from the root
npm run dev                    # :3000
npm run build                  # -> app/.output/server/index.mjs
npm start                      # run the built server
npm test
npm run lint
npm run format
```

## Architecture

### API (`src/`)

One crate, `tomely-api`, with two binaries sharing `src/lib.rs`:

| Path                 | What it is                                                                         |
| -------------------- | ---------------------------------------------------------------------------------- |
| `src/main.rs`        | bin `server` — tracing, DB connect, router, CORS, `axum::serve` on `0.0.0.0:$PORT` |
| `src/bin/migrate.rs` | bin `migrate` — `sea_orm_migration::cli::run_cli`                                  |
| `src/db.rs`          | `connect()` — the pool, sized for a long-lived server                              |
| `src/state.rs`       | `AppState { db }`, the axum `State`                                                |
| `src/error.rs`       | `ApiError` + `IntoResponse` + `From<DbErr>`                                        |
| `src/auth/`          | password hashing, JWT issue/verify, the `CurrentUser` extractor                    |
| `src/routes/`        | the router; `/health`, `/setup*`, `/auth/*`                                        |
| `src/migrations/`    | schema migrations — the source of truth                                            |
| `src/entities/`      | generated SeaORM entities — never hand-edit                                        |

Conventions:

- Handlers return `Result<Json<T>, ApiError>` and use `?`. Do not hand-build error
  responses.
- `From<DbErr>` already maps unique-constraint and foreign-key violations to 409/400
  and `RecordNotFound` to 404. Let it. A `DbErr` that reaches the client as a 500 is
  a bug worth fixing at the source.
- `ApiError::Internal` is logged in full and returned as a fixed string — never leak
  database detail to the caller.
- Response DTOs are `#[serde(rename_all = "camelCase")]`. The JSON contract is
  camelCase.
- IDs are UUIDv7 (`Uuid::now_v7()`), timestamps are `TIMESTAMPTZ`.
- The server binds `0.0.0.0`, not `127.0.0.1` — it has to be reachable from outside
  its container.

### Changing the schema

1. Add `src/migrations/mXXXX_what_it_does.rs`, declare the module and register it in
   `migrations()` in `src/migrations/mod.rs`. The house style is raw SQL through
   `manager.get_connection().execute_unprepared(...)`, not the schema-builder DSL.
2. `cargo run --bin migrate -- up`
3. `sea-orm-cli generate entity -u "$DATABASE_URL" -o src/entities --with-serde both`

Always migrate first, then regenerate. Entities are output, not input.

### Auth

A user is a row in `users`. The ways they can prove they are that user are rows in
`user_identities`, one per method — today only `provider = 'local'`, whose
`credentials` blob holds `{"password_hash": "$argon2id$…"}`. OIDC and passkeys are
meant to arrive as new `provider` values, not as new columns on `users`.

- **Setup.** An instance with no rows in `users` has not been claimed.
  `GET /setup/status` says so, `POST /setup` creates the one instance admin, and
  after that it answers 409 forever. The check-then-insert is guarded by a Postgres
  advisory lock, so two simultaneous requests cannot both claim it.
- **Tokens.** One HS256 JWT, no refresh pair. `JWT_SECRET` is required and has no
  default — the server refuses to start without it. "Remember me" only picks between
  a 12-hour and a 30-day lifetime.
- **Client side.** The browser keeps the token in `localStorage` (remembered) or
  `sessionStorage` (not) via `app/src/lib/token.ts`, and `apiFetch` attaches it as
  `Authorization: Bearer`. `getToken()` returns null under SSR, which is what makes
  server-rendered requests anonymous by construction.
- **Guarding routes.** The root route's `beforeLoad` redirects to `/setup` while the
  instance is unclaimed and away from it once it is not — public information, so it
  is safe to do on the server. Private routes wrap their content in
  `RequireAuth`, which decides on the client once the session resolves. Do not put
  auth in a route `beforeLoad`; the token does not exist there.
- **Claims are a convenience, not an authority.** Anything acting on a user's current
  name, admin flag or active status reads the row — see `routes/auth.rs::me`.

### Web app (`app/`)

- File-based routes in `app/src/routes/`; `routeTree.gen.ts` is generated — never
  edit it.
- `app/src/routes/__root.tsx` is document scaffolding only (`<html>`, `<head>`,
  `HeadContent`, `Scripts`). The provider stack lives in `app/src/App.tsx`.
- `app/src/lib/api.ts` is the only place that knows the API's address.
- Server state goes through TanStack Query. Prefetch in a route `loader` via
  `context.queryClient.ensureQueryData` so the data is in the server-rendered HTML.

### Why SSR, and what it demands

Public pages — shelf, book, author, series — get shared with people who have no
account, and link-preview crawlers do not run JavaScript. Server rendering plus a
per-route `head()` is what makes a shared link preview with the real title and
cover. `app/src/routes/demo.$id.tsx` is the reference implementation; delete it once
a real public page follows the same shape.

That choice comes with rules:

- No `window`, `document` or `localStorage` at module scope or during render. Put
  them in effects.
- Public routes must render with no auth token. SSR happens before any client
  session exists. Private routes render their shell on the server and fetch after
  the client authenticates — that is what keeps SSR ignorant of auth entirely.
- Only public `VITE_*` values may reach `import.meta.env`; they are baked into the
  browser bundle.

### Reaching the API from two sides

The app runs on both sides of the wire, so the API has two addresses:

| Caller                | Value                                               | When it is read |
| --------------------- | --------------------------------------------------- | --------------- |
| Browser               | `VITE_API_URL`, default `/api`                      | build time      |
| Server (SSR, loaders) | `API_INTERNAL_URL`, default `http://localhost:8080` | runtime         |

In development both land on `localhost:8080` — the browser through the Vite dev
proxy (`app/vite.config.ts`), which keeps it same-origin so CORS never applies. In
containers `API_INTERNAL_URL` is the compose service name and `VITE_API_URL` is the
API's public origin; that is when the axum `CorsLayer` (`CORS_ORIGIN`) matters.

## Code style

### TypeScript / React

- No semicolons, single quotes, trailing commas (Prettier, config at the root).
- ESLint extends `@tanstack/eslint-config` with relaxed import ordering.
- Import alias `#/*` → `./src/*`.

### Rust

- `cargo fmt` and `cargo clippy --all-targets -- -D warnings` both clean.
- Errors via `thiserror` in `src/error.rs`.

## Environment

Root `.env` (see `.env.example`) — read by the API and by docker compose:

- `DATABASE_URL` — Postgres connection string
- `JWT_SECRET` — token signing secret; required, no default, the server exits without it
- `PORT` — API port, default 8080
- `CORS_ORIGIN` — comma-separated allowed browser origins; unset means any
- `RUST_LOG`
- `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` — compose overrides

`app/.env` (see `app/.env.example`) — `VITE_API_URL`, `API_INTERNAL_URL`, `PORT`,
`VITE_APP_VERSION`.

## Status

Working: the compose Postgres, the migration CLI, the axum server, the `users` /
`user_identities` schema, first-run setup, password sign-in, and a server-rendered
web app with `/setup`, `/login` and a placeholder `/dashboard`.

Not built yet: every domain endpoint (books, shelves, authors, series), password
change and user management, OIDC and passkey providers, and the Dockerfiles for the
two services.
