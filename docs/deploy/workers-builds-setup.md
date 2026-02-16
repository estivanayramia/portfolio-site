# cloudflare workers builds setup

This site deploys workers exclusively via **Cloudflare Workers Builds**
(the Git integration on the Cloudflare dashboard).

The previous `deploy-workers.yml` GitHub Actions workflow was removed to
eliminate duplicate deployment methods and their conflicting check statuses.

## workers in this repository

| Dashboard name       | Wrangler config              | Entry file                  | Routes                                                         |
|----------------------|------------------------------|-----------------------------|----------------------------------------------------------------|
| `portfolio-chat`     | `worker/wrangler.chat.toml`  | `worker/chat-worker.js`     | `/api/chat`, `/chat`                                           |
| `portfolio-worker`   | `worker/wrangler.toml`       | `worker/debugger-worker.js` | `/api/error-report`, `/api/errors*`, `/api/auth`, `/api/health`|

> The legacy name `portfolio-api-debugger` (`worker/wrangler.debugger.toml`)
> deploys the same debugger code to a separate worker via manual
> `npx wrangler deploy --config worker/wrangler.debugger.toml`. If you no
> longer need the duplicate, delete it from the dashboard.

## configure workers builds (one-time)

Both workers live in the `worker/` directory. The Cloudflare monorepo
pattern requires setting **Root directory** to `worker` for each.

### portfolio-worker (debugger / error API)

1. Go to **Workers & Pages** → select **portfolio-worker**.
2. Select **Settings** → **Builds**.
3. If not yet connected, select **Connect** and choose the
   `estivanayramia/portfolio-site` repository, branch `main`.
4. Set these build settings:

   | Setting             | Value                            |
   |---------------------|----------------------------------|
   | Git branch          | `main`                           |
   | Build command       | *(leave empty)*                  |
   | Deploy command      | `npx wrangler deploy`            |
   | Root directory      | `worker`                         |

   > `worker/wrangler.toml` has `name = "portfolio-worker"` which matches
   > the dashboard name, so the default deploy command works.

5. **Save** and select **Retry build** (or push a commit) to verify.

### portfolio-chat

1. Go to **Workers & Pages** → select **portfolio-chat**.
2. Select **Settings** → **Builds**.
3. If not yet connected, select **Connect** and choose the
   `estivanayramia/portfolio-site` repository, branch `main`.
4. Set these build settings:

   | Setting             | Value                                             |
   |---------------------|---------------------------------------------------|
   | Git branch          | `main`                                            |
   | Build command       | *(leave empty)*                                   |
   | Deploy command      | `npx wrangler deploy --config wrangler.chat.toml` |
   | Root directory      | `worker`                                          |

   > The deploy command must point to `wrangler.chat.toml` because the
   > default `wrangler.toml` in this directory targets `portfolio-worker`.

5. **Save** and select **Retry build** (or push a commit) to verify.

## why builds were failing

Workers Builds defaults to running `npx wrangler deploy` from the **repo root**.
The root contains `wrangler.jsonc` (a Cloudflare Pages config with
`name = "portfolio-site"`), which does not match either worker name.
Setting `Root directory = worker` tells Workers Builds to look in that
subdirectory instead, where it finds the correct wrangler configs.

See [Troubleshooting: Workers name requirement](https://developers.cloudflare.com/workers/ci-cd/builds/troubleshoot/#workers-name-requirement)
and [Advanced setups: Monorepos](https://developers.cloudflare.com/workers/ci-cd/builds/advanced-setups/#monorepos).

## secrets

Worker secrets (not build secrets) are managed in the Cloudflare dashboard or via
`wrangler secret put`:

| Worker              | Secrets needed                                            |
|---------------------|-----------------------------------------------------------|
| `portfolio-chat`    | `GEMINI_API_KEY`                                          |
| `portfolio-worker`  | `DASHBOARD_PASSWORD` or `DASHBOARD_PASSWORD_HASH`         |

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

| Check                              | Source              | Expected result                   |
|------------------------------------|---------------------|-----------------------------------|
| `ci / smoke`                       | GitHub Actions      | Pass                              |
| `verify-pages / verify`            | GitHub Actions      | Pass                              |
| `Workers Builds: portfolio-chat`   | Cloudflare App      | Pass (after dashboard config)     |
| `Workers Builds: portfolio-worker` | Cloudflare App      | Pass (after dashboard config)     |
| `Cloudflare Pages`                 | Cloudflare App      | Pass (already passing)            |
