# Resolution Gamedev Shop

A SvelteKit credit-shop app: members log in with Hack Club Auth, spend credits
from their balance on items, and admins fulfill orders and issue credits.
Data lives in a local SQLite database (via `bun:sqlite`) and uploaded item
images are stored on disk.

## Developing

This project uses [Bun](https://bun.sh) — install dependencies and start a
dev server with:

```sh
bun install
bun run dev

# or start the server and open a browser tab
bun run dev -- --open
```

Copy `.env.example` to `.env` and fill in your [Hack Club Auth](https://auth.hackclub.com)
app credentials before logging in. For quick local testing without a Hack
Club Auth app, set `DEV_BYPASS_AUTH=1` in `.env` — this is **only** honored
under `bun run dev` and is compiled out of production builds.

## Building

```sh
bun run build
```

`bun run preview` serves that build locally. This repo currently uses
`@sveltejs/adapter-auto`, which picks an adapter based on the platform it
detects your build running on (Vercel, Cloudflare, Netlify, etc.). Because
this app depends on `bun:sqlite` (a Bun-only API) and stores its database and
uploads on the local filesystem, **it cannot run on serverless/edge
platforms** — those provide a Node or edge runtime, not Bun, and give you no
persistent disk. See below for adapters that actually work here.

## Deploying

### Runtime requirements

- **Bun, not Node.** `src/lib/server/db/index.ts` imports `bun:sqlite`
  directly, so the built server must be started with `bun`, not `node`
  — even if you build with `@sveltejs/adapter-node`.
- **Persistent disk.** The SQLite database (`DATABASE_URL`, default
  `./data/shop.db`) and uploaded item images (`UPLOADS_DIR`, default
  `./data/uploads`) are plain files on disk. Any platform that wipes the
  filesystem between deploys or restarts (most serverless/container
  platforms without a volume) will silently lose orders, balances, and
  images. Mount a persistent volume at `./data` (or wherever `DATABASE_URL`
  / `UPLOADS_DIR` point).
- **HTTPS.** SvelteKit marks the session cookie `secure` for any host other
  than `localhost`, so the app must be served over HTTPS in production or
  logins will silently fail to persist. Terminate TLS at your host/platform
  or a reverse proxy in front of it.

### 1. Pick a real adapter

Swap `adapter-auto` for `@sveltejs/adapter-node`, which produces a plain
Node-compatible server you run yourself (Bun can execute it directly):

```sh
bun add -d @sveltejs/adapter-node
bun remove @sveltejs/adapter-auto
```

Then in `vite.config.ts`, change the import from `@sveltejs/adapter-auto` to
`@sveltejs/adapter-node`. Rebuild with `bun run build` — this produces a
`build/` directory with an `index.js` entrypoint.

### 2. Environment variables

Set these wherever you run the built server (systemd unit, Docker
`--env-file`, platform dashboard, etc.) — see `.env.example` for the full
list with comments:

| Variable | Required | Notes |
|---|---|---|
| `HCA_CLIENT_ID` | yes | From your Hack Club Auth app registration |
| `HCA_CLIENT_SECRET` | yes | Keep this out of source control / logs |
| `HCA_REDIRECT_URI` | yes | Must exactly match the redirect URI registered on the HCA app — use your production HTTPS URL, e.g. `https://shop.example.com/auth/callback` |
| `HCA_ISSUER` | no | Defaults to `https://auth.hackclub.com` |
| `ADMIN_EMAILS` | yes | Comma-separated, case-insensitive |
| `DATABASE_URL` | no | Defaults to `./data/shop.db` — point this at your persistent volume |
| `UPLOADS_DIR` | no | Defaults to `./data/uploads` — same volume as above |
| `DEV_BYPASS_AUTH` | no | Leave unset/`0` in production — even if set, `adapter-node`'s build has `dev` compiled to `false`, so this has no effect outside `bun run dev` |

`@sveltejs/adapter-node` also reads a few of its own env vars at runtime that
matter once you're behind a reverse proxy (nginx, Caddy, a platform's load
balancer):

| Variable | Purpose |
|---|---|
| `PORT` | Port to listen on (default `3000`) |
| `ORIGIN` | Public origin the app is served at, e.g. `https://shop.example.com`. Set this if requests reach the app pre-proxy — without it, SvelteKit's form-action origin check and cookie handling can end up looking at the proxy's internal host/protocol instead of the real one. |
| `ADDRESS_HEADER` / `XFF_DEPTH` | Needed if your proxy sets `X-Forwarded-For` and you want correct client IPs |

Full list: [adapter-node docs](https://svelte.dev/docs/kit/adapter-node).

### 3. Run it

```sh
bun run build
bun ./build/index.js
```

Put this behind a process manager (systemd, pm2, or your platform's
supervisor) so it restarts on crash/boot, and behind a reverse proxy that
terminates TLS and forwards to `PORT`.

### Example: Docker

```Dockerfile
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1
WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
ENV PORT=3000
VOLUME ["/app/data"]
CMD ["bun", "./build/index.js"]
```

Run with `-v shop-data:/app/data` (or a bind mount) so the database and
uploads survive container restarts, and pass the environment variables from
the table above.

### Database schema

There's no separate migration step to run: `src/lib/server/db/index.ts`
creates all tables with `CREATE TABLE IF NOT EXISTS` the first time the
server starts against a given `DATABASE_URL`. `drizzle-kit` (see
`drizzle.config.ts`) is only needed as a dev tool, e.g. `bunx drizzle-kit
studio` to browse the local database.
