# cloudflare workers builds setup

This site deploys workers exclusively via **Cloudflare Workers Builds**
(the Git integration on the Cloudflare dashboard).

The previous `deploy-workers.yml` GitHub Actions workflow was removed to
eliminate duplicate deployment methods and their conflicting check statuses.

## workers in this repository

| Worker name (dashboard) | Wrangler config                  | Entry file              | Routes                                 |
|--------------------------|----------------------------------|-------------------------|----------------------------------------|
| `portfolio-chat`         | `worker/wrangler.chat.toml`      | `worker/chat-worker.js` | `/api/chat`, `/chat`                   |
| `portfolio-api-debugger` | `worker/wrangler.debugger.toml`  | `worker/debugger-worker.js` | `/api/error-report`, `/api/errors*`, `/api/auth`, `/api/health` |

## configure workers builds (one-time)

For **each** worker listed above, follow these steps in the Cloudflare dashboard:

### portfolio-chat

1. Go to **Workers & Pages** → select **portfolio-chat**.
2. Select **Settings** → **Builds**.
3. If not yet connected, select **Connect** and choose the
   `estivanayramia/portfolio-site` GitHub repository.
4. Set these build settings:

   | Setting             | Value                                                  |
   |---------------------|--------------------------------------------------------|
   | Git branch          | `main`                                                 |
   | Build command       | `npm ci`                                               |
   | Deploy command      | `npx wrangler deploy --config worker/wrangler.chat.toml` |
   | Root directory      | *(leave empty — repo root)*                            |

5. Save and push a commit to verify the build passes.

### portfolio-api-debugger

1. Go to **Workers & Pages** → select **portfolio-api-debugger**.
2. Select **Settings** → **Builds**.
3. If not yet connected, select **Connect** and choose the
   `estivanayramia/portfolio-site` GitHub repository.
4. Set these build settings:

   | Setting             | Value                                                        |
   |---------------------|--------------------------------------------------------------|
   | Git branch          | `main`                                                       |
   | Build command       | `npm ci`                                                     |
   | Deploy command      | `npx wrangler deploy --config worker/wrangler.debugger.toml` |
   | Root directory      | *(leave empty — repo root)*                                  |

5. Save and push a commit to verify the build passes.

### portfolio-worker (legacy — disconnect or rename)

The Cloudflare dashboard currently has a worker named `portfolio-worker` with Workers Builds
connected to this repository. **This name does not match any wrangler config** in the repo
(the workers are `portfolio-chat` and `portfolio-api-debugger`).

**Options:**
- **Disconnect**: Go to **Workers & Pages** → **portfolio-worker** → **Settings** → **Builds** → **Disconnect**.
  This stops Workers Builds from failing on every push.
- **Rename to match**: If this worker should be `portfolio-api-debugger`, rename it in the
  dashboard, then configure the build settings as shown above.

## secrets

Worker secrets (not build secrets) are managed in the Cloudflare dashboard or via
`wrangler secret put`:

| Worker                  | Secrets needed           |
|-------------------------|--------------------------|
| `portfolio-chat`        | `GEMINI_API_KEY`         |
| `portfolio-api-debugger`| `DASHBOARD_PASSWORD` or `DASHBOARD_PASSWORD_HASH` |

These are runtime secrets, not build-time. Set them in **Workers & Pages** →
*[worker]* → **Settings** → **Variables and Secrets**.

## local deployment (optional)

For manual deploys outside Workers Builds:

```bash
# Authenticate locally (one-time)
npx wrangler login

# Deploy chat worker
npm run deploy:chat-worker

# Deploy debugger worker
npm run deploy:debugger-worker
```

## ci checks after this change

| Check                          | Source                    | Expected result |
|--------------------------------|---------------------------|-----------------|
| `ci / smoke`                   | GitHub Actions (`ci.yml`) | Pass (npm ci)   |
| `verify-pages / verify`        | GitHub Actions            | Pass (validates _redirects in repo root) |
| `Workers Builds: portfolio-chat` | Cloudflare App           | Pass (after dashboard config) |
| `Workers Builds: portfolio-api-debugger` | Cloudflare App  | Pass (after dashboard rename + config) |
| `Cloudflare Pages`             | Cloudflare App            | Pass (already passing) |
