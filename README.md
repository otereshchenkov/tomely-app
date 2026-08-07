# Tomely

A home library, catalogued. Private project — track the books you own, organise them
onto shelves, and share a page with a friend without making them sign up for anything.

## Layout

```
tomely-app/
├── app/                 # Web app: TanStack Start (React 19, Router, Query, Mantine)
├── src/                 # API: axum + SeaORM, one Rust crate
│   ├── main.rs          #   bin "server"
│   ├── bin/migrate.rs   #   bin "migrate" — the schema CLI
│   ├── migrations/      #   the source of truth for the database
│   └── entities/        #   generated from the migrated schema, never hand-written
├── Cargo.toml           # The API crate lives at the root
├── package.json         # npm workspace, with app/ as the only member
└── docker-compose.yml   # Postgres
```

Both halves get their own container eventually; for now they run natively against
the Postgres in compose.

## Running it

Three terminals, from the repository root:

```bash
cp .env.example .env
# The API signs its tokens with this and refuses to start without it.
echo "JWT_SECRET=$(openssl rand -base64 48)" >> .env
docker compose up -d           # Postgres on :5432

cargo run --bin migrate -- up  # apply migrations
cargo run                      # API on :8080

npm install
npm run dev                    # web app on :3000
```

The dev server proxies `/api` to the API, so the browser stays on one origin and
CORS never comes up.

`http://localhost:3000` on a fresh database redirects to `/setup`, which is where
you create the instance owner: an instance with no users has not been claimed yet.
Once it has, `/setup` is gone and `/login` takes over.

## Why the Web App Renders on the Server

Most pages sit behind a login, but shelf, book, author and series pages are meant
to be shared with people who have no account. The crawlers behind WhatsApp,
Telegram, Signal and Slack do not run JavaScript, so under a client-only app every
shared link would preview with the same generic title and no cover. TanStack Start
renders those pages on the server, and a route's `head()` puts the real title and
image into the HTML. `app/src/routes/demo.$id.tsx` is the worked example.

## Common Tasks

```bash
# API
cargo run                                  # serve
cargo run --bin migrate -- up|down|status  # migrations
cargo test
cargo clippy --all-targets -- -D warnings
cargo fmt

# Web app
npm run dev            # dev server on :3000
npm run build          # -> app/.output/server/index.mjs
npm start              # run that build
npm test
npm run lint
npm run format
```

### Changing the schema

1. Add `src/migrations/mXXXX_what_it_does.rs` and register it in `src/migrations/mod.rs`.
2. `cargo run --bin migrate -- up`
3. Regenerate the entities:
   ```bash
   sea-orm-cli generate entity -u "$DATABASE_URL" -o src/entities --with-serde both
   ```

Migrations are the source of truth. Entities are generated output — apply the
migration first, then regenerate.
