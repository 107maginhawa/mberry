# Phase 10: Deploy Platform Decision - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Choose deploy platforms and replace placeholder deploy commands in `.github/workflows/deploy.yml` with real commands. API deploys via Docker image, frontends deploy as static assets.

</domain>

<decisions>
## Implementation Decisions

### Deploy Platform Selection
- API + Postgres: Railway (Docker container deploy, Postgres addon)
- Frontends (memberry, admin, account): Cloudflare Pages (static CDN)
- Split architecture: Railway for backend, Cloudflare Pages for frontend
- Railway CLI command: `railway up --image $IMAGE_TAG`
- Cloudflare CLI command: `wrangler pages deploy <dist-dir> --project-name <name>`

### Claude's Discretion
- Exact secret/variable names for Railway and Cloudflare tokens in GitHub Actions
- Whether to use `wrangler pages deploy` directly or Cloudflare GitHub integration
- Health check endpoint paths and retry timing (existing `/readyz` and `/livez` are fine)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.github/workflows/deploy.yml` — complete scaffold with build, staging, production jobs
- Docker image already built and pushed to ghcr.io in the build job
- Frontend artifacts already uploaded via actions/upload-artifact
- Health check logic already implemented (just needs real URLs)

### Established Patterns
- GitHub Actions with environment-based secrets (`staging`, `production` environments)
- `vars.STAGING_API_URL` and `vars.PRODUCTION_API_URL` already referenced
- Image tag passed between jobs via outputs

### Integration Points
- Replace 4 TODO blocks in deploy.yml (staging API, staging frontends, production API, production frontends)
- Add `RAILWAY_TOKEN` and `CLOUDFLARE_API_TOKEN` as GitHub secrets
- Set `STAGING_API_URL` and `PRODUCTION_API_URL` as GitHub vars

</code_context>

<specifics>
## Specific Ideas

User confirmed this can be adjusted later — keep implementation simple and swappable.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
