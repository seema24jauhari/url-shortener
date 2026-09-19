# URL Shortener (NestJS)

A distributed URL shortener built with NestJS, MongoDB, and Redis — supports high-throughput redirects, click analytics, and link expiration. Includes a working AWS ECS Fargate deployment (used for learning/testing; not permanently hosted).

## Screenshots

### AWS ECS Cluster (Fargate)
![ECS Cluster](docs/screenshots/ecs-cluster.png)

### CloudWatch Logs (debugging DocumentDB TLS connection)
![CloudWatch Logs](docs/screenshots/cloudwatch-logs.png)

### k6 Load Test Results
![Load Test](docs/screenshots/k6-results.png)

### Admin Dashboard
![Dashboard](docs/screenshots/dashboard.png)

## Features

- ✅ Short link creation (nanoid, 7-char codes)
- ✅ 302 redirect with Redis cache-aside pattern
- ✅ Async click count tracking (never blocks the redirect)
- ✅ Full click analytics — hashed IP, referrer, device, browser, country
- ✅ Link expiration (Mongo TTL index + matching Redis cache TTL)
- ✅ Cache invalidation on delete
- ✅ Request validation via DTOs (`class-validator`)
- ✅ JWT auth (in progress)
- ✅ Custom aliases
- ✅ QR code generation
- ✅ Admin dashboard (React)
- ✅ Deployed and load tested on AWS (ECS Fargate, DocumentDB, ECR) — deployment torn down after testing to avoid ongoing cost
- ✅ k6 load testing (local) — cache stampede, connection pool, and
     single-core bottleneck found and fixed via clustering (pm2-runtime)
- ✅ k6 load testing against a live AWS deployment — see Performance section below
- ✅ ALB integrated for backend (stable routing, resolves changing Fargate task IPs on redeploy)

## Architecture

```
Client → API (NestJS)
              ├─ GET /:code   → Redis (cache-aside) → MongoDB (fallback) → 302 redirect
              │                                                  ↓
              │                                    async: click count + click analytics
              └─ POST /links  → MongoDB (create)
```

**Why Redis sits in front of Mongo:** at high read volume, hitting Mongo on every redirect doesn't scale. Redis serves cached lookups in sub-millisecond time; Mongo is only queried on a cache miss, and the result is cached immediately after so subsequent requests skip Mongo entirely.

**Why click tracking is fire-and-forget:** the redirect response must never wait on an analytics write. Click count increments and click event logging both fire without `await` on the hot path — a slow or failed analytics write can't add latency or break a redirect.

## Tech stack

- **Framework:** NestJS (TypeScript)
- **Database:** MongoDB (via Mongoose) / Amazon DocumentDB in the AWS deployment
- **Cache:** Redis (via ioredis)
- **ID generation:** nanoid
- **Validation:** class-validator / class-transformer
- **Analytics parsing:** ua-parser-js (device/browser), geoip-lite (country)
- **Infrastructure (AWS deployment):** ECS (Fargate), ECR, DocumentDB, CloudWatch, IAM

## Project structure

```
src/
  main.ts                    # app bootstrap, global ValidationPipe
  app.module.ts               # root module — Mongo connection, ConfigModule
  links/
    links.module.ts
    links.controller.ts       # POST /links, GET /:code, DELETE /:code
    links.service.ts          # cache-aside logic, create/find/delete
    dto/create-link.dto.ts    # request validation
    schemas/link.schema.ts    # short_code, long_url, clicks, expires_at
  cache/
    cache.module.ts
    cache.service.ts          # Redis client, get/set/del with TTL support
  analytics/
    analytics.module.ts
    analytics.service.ts      # click logging: IP hash, device, browser, country
    schemas/click.schema.ts

frontend/
  src/                        # React admin dashboard (Vite)
  nginx.conf.template         # Nginx reverse proxy config, env-substituted at container start
  Dockerfile                  # production build (Vite build + Nginx serve)
```

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally (or a connection string)
- Redis running locally (or a connection string)
- Docker + Docker Compose (for containerized local setup)

### Install

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root for local development:

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/url_shortener
REDIS_URI=redis://localhost:6379
BASE_URL=http://localhost:3000
JWT_SECRET=change_this_to_a_real_secret
```

For the AWS deployment (DocumentDB), the backend additionally requires:

```
DATABASE_URI=mongodb://<user>:<url-encoded-password>@<docdb-endpoint>:27017/?tls=true&tlsCAFile=global-bundle.pem&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false
DB_TLS=true
DB_TLS_CA_FILE=/app/certs/global-bundle.pem
```

> Note: passwords containing special characters (`#`, `@`, `%`, etc.) must be URL-encoded before being placed in `DATABASE_URI`, or the MongoDB driver will throw a `Password contains unescaped characters` error.

The frontend reads its backend URL as a **build-time** Vite variable (`VITE_API_URL`), not a runtime env var, since Vite bakes it into the compiled JS bundle:

```
# frontend/.env.production
VITE_API_URL=http://<backend-address>:3000
```

For local development, `frontend/.env.production.local` (gitignored) overrides this with `http://localhost:3000`, so the same Dockerfile produces the correct build for both environments without manual edits or `--build-arg` flags.

### Run (local, without Docker)

```bash
npm run start:dev
```

Server starts on `http://localhost:3000`.

### Run (local, with Docker Compose)

```bash
docker compose up --build
```

This starts the API, MongoDB, Redis, and the frontend (served via Nginx) together, networked via Docker Compose's internal DNS.

## API

### Create a short link
```bash
curl -X POST http://localhost:3000/links \
  -H "Content-Type: application/json" \
  -d '{"long_url": "https://example.com/some/long/path", "expires_at": "2026-12-01T00:00:00.000Z"}'
```
`expires_at` is optional — omit it for a link that never expires.

### Use a short link
```bash
curl -i http://localhost:3000/<short_code>
```
Returns a `302` redirect. Increments click count and logs a click analytics event, both asynchronously.

### Delete a link
```bash
curl -X DELETE http://localhost:3000/<short_code>
```
Removes the link from MongoDB and invalidates its Redis cache entry.

## Performance & Load Testing

Load tested using k6 with 50 concurrent virtual users against a live AWS ECS deployment (single Fargate task, 0.25 vCPU / 0.5GB, API and Redis co-located in the same task):

| Metric | Result |
|---|---|
| Throughput | 130 req/s |
| Failure rate | 0.00% |
| P90 latency | 399ms |
| P95 latency | 502ms (target: <200ms) |

**Findings:** all requests returned correct `302` redirects with zero failures, confirming functional correctness under sustained load. P95 latency exceeded the target threshold, primarily attributable to constrained Fargate task sizing shared between the API and Redis containers.

**Identified next steps:**
- Increase Fargate task CPU/memory allocation and re-test
- Confirm click-analytics writes are fully off the redirect critical path (BullMQ queue)
- Introduce an Application Load Balancer for stable routing, and CloudFront for edge caching of repeat lookups
- Separate Redis into its own task (or managed ElastiCache) so it no longer competes with the API for CPU

## Deployment (AWS)

> This project was deployed temporarily on AWS for hands-on learning and load testing, then torn down afterward to avoid ongoing infrastructure costs. The architecture below reflects the setup used during that deployment; it is not permanently hosted.

- **IAM:** dedicated IAM user with scoped access for deployment operations
- **Image registry:** Amazon ECR — separate repositories for API and frontend images
- **Compute:** ECS on Fargate — a single task definition running both the `api` and `redis` containers (shared task network via `localhost`)
- **Database:** Amazon DocumentDB (MongoDB-compatible), TLS-enforced connection using a downloaded CA bundle (`global-bundle.pem`)
- **Networking:** default VPC, public subnets, security groups scoped per port (3000 for API, 80 for frontend, 27017 for DocumentDB — each restricted to the minimum required source)
- **Frontend:** Nginx-served static build, reverse-proxying `/api/` to the backend; backend address is injected into the Nginx config at container startup via `envsubst`, so the same image can point at different backend hosts without rebuilding
- **Logs:** CloudWatch Logs, used throughout for debugging container startup and connection failures

### Deployment flow

```
Local build → docker build → docker tag → docker push → ECR
                                                            │
                                                            ▼
                                          ECS Task Definition (pulls image)
                                                            │
                                                            ▼
                                        ECS Service (runs task, Fargate)
                                                            │
                                       ┌────────────────────┼────────────────────┐
                                       ▼                                         ▼
                              api + redis (same task)                  DocumentDB (TLS)
```

## Design notes / tradeoffs

- **Cache correctness on delete:** there's a small race window between the Mongo delete and the Redis cache invalidation where a concurrent read could serve a stale cached copy. Acceptable at this scale; a stricter guarantee would need a distributed lock or a different invalidation strategy.
- **Expiry checked on Mongo path, not on every cache hit:** re-validating `expires_at` on every cache hit would cost a comparison per request. Instead, the Redis TTL is set to match the link's remaining lifetime, so expired entries fall out of the cache on their own.
- **IP addresses are hashed (SHA-256), never stored raw** — click analytics are useful for aggregate patterns (device, referrer, country) without retaining identifiable IPs.
- **Redis co-located in the same ECS task, not ElastiCache:** chosen to avoid additional ongoing cost during a learning deployment. Cache data loss on task restart is acceptable since MongoDB/DocumentDB remains the source of truth — Redis only serves as a lookup accelerator. A production deployment would use a managed ElastiCache cluster instead, so Redis scales and persists independently of the API task.
- **Backend address passed to the frontend at container runtime, not baked into backend code:** since ECS Fargate assigns a new IP on every task restart, the Nginx proxy target is templated (`${BACKEND_HOST}:${BACKEND_PORT}`) and resolved via `envsubst` at container startup, rather than hardcoded — this is also exactly the problem an Application Load Balancer is meant to solve permanently.

## Roadmap

1. JWT auth — links scoped to authenticated users
2. ALB + CloudFront in front of the backend for stable routing and edge caching
3. Increase Fargate task sizing and re-run load test to close the P95 gap
4. CI gate — wire k6 into pipeline to auto-fail deploys on threshold breach
5. QR code generation per link
6. k6 load test targeting 10k redirects/sec, wired into CI