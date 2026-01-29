# Deployment Settings

## Cloudflare Integration

This project requires **two** separate Cloudflare Git integrations connected to the `main` branch:

### 1. Website (Cloudflare Pages)

- **Repo**: estivanayramia/portfolio-site
- **Branch**: `main`
- **Build command**: `npm run build`
- **Output directory**: `.` (root) or explicit assets check
- **Root directory**: `/` (default)
- **Environment variables**: None required for static site.

### 2. Chat Worker (Cloudflare Workers)

- **Service Name**: `portfolio-chat`
- **Repo**: estivanayramia/portfolio-site
- **Branch**: `main`
- **Root directory**: `/` (repo root)
- **Build command**: `npx wrangler deploy --config worker/wrangler.chat.toml`
- **Secrets**:
  - `GEMINI_API_KEY`

### 3. Debugger/Errors Worker (Cloudflare Workers)

- **Service Name**: `portfolio-worker`
- **Repo**: estivanayramia/portfolio-site
- **Branch**: `main`
- **Root directory**: `/` (repo root)
- **Build command**: `npx wrangler deploy --config worker/wrangler.debugger.toml`
- **Secrets**:
  - `DASHBOARD_PASSWORD` (plain) OR `DASHBOARD_PASSWORD_HASH` (sha256 hex)

## Deployment Workflow

1. Push changes to `main`.
2. Cloudflare Pages automatically rebuilds the static site.
3. Cloudflare Workers deploy each worker using explicit `--config` (no Wrangler auto-discovery).

## Manual Deployment (Fallback)

If auto-deploy fails:

```bash
npm run deploy:chat-worker
npm run deploy:debugger-worker
```

But prefer the CI/CD pipeline.

