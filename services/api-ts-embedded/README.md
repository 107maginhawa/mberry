# @monobase/api-ts-embedded

A Rust crate that bundles `@monobase/api-ts` into a [QuickJS](https://bellard.org/quickjs/) runtime so the Hono + Drizzle API can run **in-process inside a Tauri app**, with no server, no port binding, and no PostgreSQL — SQLite via the host's native bindings.

Used by `apps/account/src-tauri` to give the desktop / mobile shell an offline-first backend that speaks the same wire shape as the cloud `services/api-ts`.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ apps/account/src-tauri (Rust)                       │
│                                                     │
│  ApiTsEmbedded::new(db_path)                        │
│    └──> spawns 64 MB-stack thread                   │
│         └──> QuickJsEngine::new()                   │
│              ├──> rusqlite (native SQLite)          │
│              ├──> bcrypt (native bcrypt)            │
│              └──> ctx.eval(BUNDLE_GZ)               │
│                                                     │
│  api.request(method, path, body, headers)           │
│    └──> mpsc → JS thread → __dispatch(...)          │
│         └──> app.fetch(req) → __res                 │
└─────────────────────────────────────────────────────┘
                       │
                       ▼ at compile time
┌─────────────────────────────────────────────────────┐
│ src-js/entry.ts                                     │
│  ├─ drizzle({callback that calls __db.execute /     │
│  │            __db.select to bridge to Rust SQLite})│
│  ├─ createApp({ database: { instance: drizzle, …}, │
│  │              storage:{}, email:{}, push:{},     │
│  │              billing:{}, betterAuth:{password:  │
│  │                hash/verify via __bcrypt}})      │
│  └─ globalThis.__dispatch = (m, u, b, h) =>        │
│       app.fetch(req).then(r => __res = …)           │
│                                                     │
│  bundled by src-js/build.ts (esbuild + 24 shims +  │
│  unenv) -> dist/bundle.js.gz (~800 KB gzipped)     │
└─────────────────────────────────────────────────────┘
```

## Public API

```rust
use api_ts_embedded::{ApiTsEmbedded, ApiTsResponse};

let api = ApiTsEmbedded::new("/path/to/account.db")?;
let res = api.request(
    "POST",
    "/auth/sign-in/email",
    Some(r#"{"email":"x@y.z","password":"..."}"#),
    vec![("Content-Type", "application/json")],
)?;
// res: ApiTsResponse { status, body, headers, logs, timings }
```

## Build

The JS bundle is generated at compile time by `build.rs` running `bun run src-js/build.ts`. You don't have to run anything manually — `cargo check` / `cargo build` triggers it.

```bash
# Build the crate (rebuilds JS bundle if src-js/ changed)
cargo build --release

# Force-rebuild only the JS bundle
bun run src-js/build.ts
bun run src-js/build.ts --no-minify   # for debugging

# Skip JS bundle build during cargo (if dist/bundle.js.gz already exists)
API_TS_EMBEDDED_SKIP_JS_BUILD=1 cargo build
```

Bundle stats: ~3.5 MB ungzipped, ~800 KB gzipped.

## How api-ts plugs in

The bundle imports `createApp` from `@monobase/api-ts/app` (NOT `@monobase/api-ts` — that pulls `index.ts` which has top-level `await` not supported by QuickJS's ES2017 target). It builds a Drizzle/sqlite-proxy instance, then:

```typescript
const app = createApp({
  database: {
    url: "sqlite://:embedded:",
    instance: drizzle,   // <-- short-circuits createDatabase + skips runMigrations
  },
  // ...stubs for storage, email, push, billing
})
```

The `database.instance` field is the Phase C addition to `services/api-ts/src/core/database.ts` — when set, `createApp` skips its own `createDatabase` and `runMigrations`, deferring schema management to the embedded host.

## Shim chain

esbuild can't bundle most Node.js / cloud SDKs straight into QuickJS. The shim chain in `src-js/shims/` covers:

- **Node.js builtins** (`events`, `stream`, `buffer`, `process`, `util`, `crypto`)
- **npm packages** (`pg`, `pg-boss`, `pino`, `nodemailer`, `bcryptjs`, `bun:sqlite`, `readable-stream`, `through2`, `from2`, `concat-stream`, `jimp`, `ajv`)
- **Cloud SDKs** (`@aws-sdk/client-s3`, `@smithy/smithy-client`, `@google-cloud/storage`, `stripe`, `firebase-admin`)
- **Fallback stub** for unaliased `@aws-sdk/*`, `@smithy/*`, `@google-cloud/*`, `@puppeteer/*`, `firebase-admin/*` — provides empty constructors with no-op methods so imports resolve.

Most shims came verbatim from mycure's `services/hapihub-embedded`. They're conservative: when an external service isn't reachable (because we're offline), the shim returns an empty/default value rather than throwing.

## When to update the bundle

- TypeSpec changes that affect handlers → `cd services/api-ts && bun run generate` then rebuild this crate
- New api-ts dependency → may need a shim entry in `src-js/build.ts` if it pulls in something QuickJS can't handle
- bcrypt or SQLite native binding changes → audit `src/db.rs` and `src-js/entry.ts`'s `__bcrypt` consumer

## Notes

- The Tauri host (`apps/account/src-tauri/src/mobile.rs::setup_api_ts`) must spawn the runtime on a 64 MB stack thread. QuickJS needs the headroom for the full bundle.
- `src/engine.rs` runs the JS thread via mpsc; requests are dispatched as `JsRequest { method, url, body, headers }` and the response is polled out of the `__res` global.
- WebSocket routes from `services/api-ts/src/core/ws.ts` (which uses `Bun.serve`) are not exercised in embedded mode — the Hono router still registers them, but `app.fetch` doesn't upgrade.
