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
- **Root directory**: `worker` (Important!)
- **Build command**: `npx wrangler deploy` (or `npm run deploy:worker` if using root package, but Cloudflare Workers Git integration runs inside the worker directory context usually, or allows root specification)
- **Environment Variables**:
  - `GEMINI_API_KEY`: [Start with "AIza..."] (Set this in Cloudflare Dashboard > Settings > Variables)

## Deployment Workflow
1. Push changes to `main`.
2. Cloudflare Pages automatically rebuilds the static site.
3. Cloudflare Workers (connected via Git) automatically redeploys the Worker logic from the `worker/` directory.

## Manual Deployment (Fallback)
If auto-deploy fails:
```bash
npm run deploy:worker
```
But prefer the CI/CD pipeline.
