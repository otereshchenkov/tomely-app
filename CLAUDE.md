# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project Overview

Tomely is a private home-library application. It was previously built as a SaaS on
AWS (SST, Lambda, Aurora, API Gateway, CloudFront, Clerk); that stack has been
removed and the project rebuilt as something self-hosted. The old version is still
in the `main` branch's history if you need to see how something used to work.

- **Web app** (`app/`) — TanStack Start (React 19, TanStack Router, TanStack Query),
  Mantine v9, server-rendered, built by Nitro to a plain Node server.
- **API** (`src/`) — a single Rust crate at the repository root: axum + SeaORM.
- **Database** — Postgres, run locally via `docker-compose.yml`.
- **Auth** — local accounts, JWT bearer tokens.

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
| `src/state.rs`       | `AppState { db, jwt }`, the axum `State`                                           |
| `src/error.rs`       | `ApiError` + `IntoResponse` + `From<DbErr>`                                        |
| `src/auth/`          | password hashing, JWT issue/verify, the `CurrentUser` extractor                    |
| `src/routes/`        | the router; `/health`, `/setup*`, `/auth/*`, `/libraries*`                         |
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

### Libraries and membership

A library is the container everything else hangs off. Who may see one is a row in
`library_memberships` and nothing else — there is deliberately no "instance admin
sees everything" shortcut, because administering an instance is not the same as
reading somebody's shelves. A non-member asking for a library by id gets a 404
rather than a 403, so ids cannot be probed for.

- **Roles are rows, not an enum.** `roles` ships with `owner`, `editor` and
  `viewer` marked `is_system`, seeded by m0003. Their ids are minted when the
  migration runs, so no two installations share one and nothing can come to
  depend on a particular id — always resolve a system role by name, as
  `OWNER_ROLE` in `routes/libraries.rs` does. Renaming one of the three breaks
  that lookup; adding a role does not. Users defining their own roles is the
  reason this is a table at all.
- **Roles now gate something.** Only an `owner` membership may rename or delete a
  library. A member who is not one gets a 403, not the 404 a stranger gets: by
  then they have already been shown the library exists, so naming the rule tells
  them nothing they could not see, and it is the only answer they can act on.
  `visible_one` and `require_owner` in `routes/libraries.rs` are the pair every
  future write should go through.
- **The primary owner is recorded twice.** `libraries.owner_id` is the thing that
  cannot be revoked; the same person also gets an ordinary membership with the
  `owner` role and a null `invited_by` — nobody invited them. Permission checks
  read the membership, so a primary owner and an owner are the same to everything
  except `POST /libraries`. Keep it that way: the moment a check special-cases
  `owner_id`, every future one has to as well.
- `isPrimaryOwner` and `role` on the API's library responses are properties of the
  _caller_, not of the row. That is what lets a card draw the crown without a
  second request.

### Web app (`app/`)

- File-based routes in `app/src/routes/`; `routeTree.gen.ts` is generated — never
  edit it.
- `app/src/routes/__root.tsx` is document scaffolding only (`<html>`, `<head>`,
  `HeadContent`, `Scripts`). The provider stack lives in `app/src/App.tsx`.
- `app/src/lib/api.ts` is the only place that knows the API's address.
- Server state goes through TanStack Query. Prefetch in a route `loader` via
  `context.queryClient.ensureQueryData` so the data is in the server-rendered HTML.

#### The signed-in shell

`app/src/components/layout/AppLayout.tsx` is the frame every signed-in page hangs
in: navigation on the left, a title bar across the top of the content, a version
strip at the foot. A page renders `<AppLayout title=…>` and puts `RequireAuth`
_inside_ it, so the shell is part of the server-rendered HTML and only the content
waits for the client to work out who is asking.

- `md` is the one breakpoint that matters. Below it the navigation is a `Drawer`
  behind a burger and the content is a single column; above it the navbar is
  permanent and the content splits. Mantine's own mobile navbar is full-width,
  which reads as a page rather than as a menu, hence the separate drawer.
- `AppNav` holds the destinations. Everything except the dashboard is a disabled
  item marked "Soon" — the shape of the navigation is part of the design, and an
  item that goes nowhere should say so rather than 404.
- The colour-scheme control lives in the user panel, which only renders once the
  session has resolved. That is deliberate: its label comes from `localStorage`,
  so rendering it on the server would mean a hydration mismatch.

#### The dashboard

`app/src/lib/dashboard.ts` is the seam. It declares what the page shows and hands
back an empty summary, so every card renders its empty state; the cards take their
data as props and know nothing about where it comes from. When `GET /dashboard`
exists, `useDashboard` becomes a query and nothing above it changes.

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
- **TypeScript is pinned to 5.9 on purpose.** On 7.x, `npm run lint` does not run at
  all: `ts-api-utils` reads `ts.TypeFlags` at module load, TypeScript 7 does not
  expose it, and every ESLint invocation dies before linting a single file. There is
  no released `typescript-eslint` that supports 7 yet. Nothing in the codebase needs
  7 — `tsc`, the Vite build and the tests all pass identically on 5.9. Lift the pin
  once `typescript-eslint` ships TypeScript 7 support, not before.

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
web app with `/setup`, `/login` and a `/dashboard` — the signed-in shell and the
dashboard layout, drawn against an empty summary. Libraries end to end: the
`roles` / `libraries` / `library_memberships` schema, `GET`/`POST /libraries` and
`GET`/`PUT`/`DELETE /libraries/{id}`, a `/libraries` page that lists and creates
them — each card carrying a menu to edit or delete it — and a
`/libraries/{id}/settings` page that renames one, changes its description or
deletes it, read-only for a member who is not an owner.

Not built yet: sharing a library — the roles and the membership table are there,
but there is no endpoint to invite anyone, so every membership is its owner's,
and the `owner`-only rule on writing to one has nobody to exclude yet. Handing a
library over to a new primary owner. Every other domain endpoint (books, shelves,
authors, series) and so the data behind the dashboard and behind
`/libraries/{id}/books`, which is a stub. Password change and user management,
OIDC and passkey providers, and the Dockerfiles for the two services.
