[![Proprietary License](https://img.shields.io/badge/License-Proprietary-red.svg)](#license)
[![GitHub stars](https://img.shields.io/github/stars/blackboxprogramming/blackroad-alfred.svg?style=social&label=Star)](https://github.com/blackboxprogramming/blackroad-alfred)
[![GitHub forks](https://img.shields.io/github/forks/blackboxprogramming/blackroad-alfred.svg?style=social&label=Fork)](https://github.com/blackboxprogramming/blackroad-alfred/fork)
[![Auto Deploy](https://github.com/blackboxprogramming/blackroad-alfred/actions/workflows/auto-deploy.yml/badge.svg)](https://github.com/blackboxprogramming/blackroad-alfred/actions/workflows/auto-deploy.yml)
[![Security Scan](https://github.com/blackboxprogramming/blackroad-alfred/actions/workflows/security-scan.yml/badge.svg)](https://github.com/blackboxprogramming/blackroad-alfred/actions/workflows/security-scan.yml)
[![Self-Healing](https://github.com/blackboxprogramming/blackroad-alfred/actions/workflows/self-healing.yml/badge.svg)](https://github.com/blackboxprogramming/blackroad-alfred/actions/workflows/self-healing.yml)

# BlackRoad Alfred

Automated deployment, monitoring, and task orchestration platform by **BlackRoad OS, Inc.**

## Architecture

```
GitHub (push) --> Auto Deploy Workflow --> Cloudflare Workers / Railway
                                     \--> Health Check --> Self-Healing
                                                      \--> Auto-Rollback
```

**Deployment Targets:**
- **Cloudflare Workers** — API routing, task queues, webhooks, scheduled jobs
- **Cloudflare Pages** — NextJS and static site hosting
- **Railway** — Docker, Node.js, and Python services

## Quick Start

```bash
# Install dependencies
npm install

# Run worker locally
npm run dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:production
```

## Cloudflare Worker Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check and service status |
| `POST` | `/api/tasks` | Queue a long-running task (requires auth) |
| `GET` | `/api/tasks/:id` | Get task status by ID |
| `POST` | `/api/webhook/deploy` | Deployment webhook receiver |
| `POST` | `/api/webhook/stripe` | Stripe webhook receiver |

### Health Check

```bash
curl https://your-worker.workers.dev/api/health
```

```json
{
  "status": "ok",
  "service": "blackroad-alfred",
  "timestamp": "2026-03-05T00:00:00.000Z",
  "version": "1.0.0"
}
```

### Queue a Task

```bash
curl -X POST https://your-worker.workers.dev/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_SECRET" \
  -d '{"type": "deploy", "payload": {"service": "my-app"}}'
```

## Workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **Auto Deploy** | Push to main/master | Detects service type and deploys to Cloudflare or Railway |
| **Security Scan** | Push, PR, weekly schedule | CodeQL analysis and dependency auditing |
| **Self-Healing** | Every 30 min, post-deploy | Health monitoring with auto-rollback |
| **Automerge** | Dependabot PRs | Auto-approves and merges patch/minor dependency updates |

All GitHub Actions are **pinned to specific commit hashes** for supply-chain security.

## Required Secrets

Configure these in your GitHub repository settings:

| Secret | Required For | Description |
|--------|-------------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare deploy | Cloudflare API token with Workers/Pages permissions |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare deploy | Cloudflare account identifier |
| `RAILWAY_TOKEN` | Railway deploy | Railway project deployment token |
| `DEPLOY_URL` | Health checks | Base URL of deployed service |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Auth (NextJS) | Clerk authentication public key |
| `STRIPE_WEBHOOK_SECRET` | Stripe integration | Stripe webhook signing secret |

## Project Structure

```
blackroad-alfred/
├── .github/
│   ├── dependabot.yml          # Automated dependency updates
│   └── workflows/
│       ├── auto-deploy.yml     # Multi-platform deployment
│       ├── automerge.yml       # Dependabot PR automerge
│       ├── security-scan.yml   # CodeQL + dependency scanning
│       └── self-healing.yml    # Health monitoring + rollback
├── workers/
│   └── alfred-worker.js        # Cloudflare Worker (API + task queue)
├── tests/
│   └── worker.test.js          # Worker unit tests
├── wrangler.toml               # Cloudflare Worker configuration
├── package.json                # Node.js project configuration
├── workflow.sh                 # CLI workflow dispatcher
└── LICENSE                     # BlackRoad OS, Inc. Proprietary License
```

## Security

- All GitHub Actions pinned to commit SHAs (not mutable tags)
- Weekly CodeQL security scanning
- Automated dependency auditing via `npm audit`
- Dependabot configured for npm and GitHub Actions
- API endpoints require Bearer token authentication
- CORS headers on all Worker responses

## License

**Proprietary** — Copyright (c) 2024-2026 BlackRoad OS, Inc. All Rights Reserved.

This software is the exclusive property of BlackRoad OS, Inc. and Alexa Louise Amundson.
Unauthorized use, reproduction, or distribution is strictly prohibited.
See [LICENSE](LICENSE) for the complete terms.

This is **not** open source software.
