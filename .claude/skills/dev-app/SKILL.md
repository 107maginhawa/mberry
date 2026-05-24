---
name: dev-app
description: Start the memberry app development server on port 3004. Use when you need the frontend running for development or testing.
---

# dev-app

Start the memberry app development server.

## Workflow

### Start Server

```bash
cd apps/memberry && bun dev
```

- **Port**: 3004

### Troubleshooting

**API connection failed**:
Check `apps/memberry/.env`:
```
VITE_API_URL=http://localhost:7213
```
Ensure the API server is running first (`/dev-api`).

**Stale Vite cache**:
```bash
rm -rf node_modules/.vite && bun dev
```

**TypeScript errors after API changes**:
```bash
cd specs/api && bun run build
cd ../../apps/memberry && bun dev
```
