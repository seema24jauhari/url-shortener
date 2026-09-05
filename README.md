# URL Shortener (NestJS)

A distributed URL shortener built with NestJS, MongoDB, and Redis — supports high-throughput redirects, click analytics, and link expiration.

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
- ⬜ k6 load testing + CI gate

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
- **Database:** MongoDB (via Mongoose)
- **Cache:** Redis (via ioredis)
- **ID generation:** nanoid
- **Validation:** class-validator / class-transformer
- **Analytics parsing:** ua-parser-js (device/browser), geoip-lite (country)

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
```

## Setup

### Prerequisites
- Node.js 18+
- MongoDB running locally (or a connection string)
- Redis running locally (or a connection string)

### Install

```bash
npm install
```

### Environment variables

Create a `.env` file in the project root:

```
PORT=3000
MONGO_URI=mongodb://localhost:27017/url_shortener
REDIS_URI=redis://localhost:6379
BASE_URL=http://localhost:3000
JWT_SECRET=change_this_to_a_real_secret
```

### Run

```bash
npm run start:dev
```

Server starts on `http://localhost:3000`.

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

## Design notes / tradeoffs

- **Cache correctness on delete:** there's a small race window between the Mongo delete and the Redis cache invalidation where a concurrent read could serve a stale cached copy. Acceptable at this scale; a stricter guarantee would need a distributed lock or a different invalidation strategy.
- **Expiry checked on Mongo path, not on every cache hit:** re-validating `expires_at` on every cache hit would cost a comparison per request. Instead, the Redis TTL is set to match the link's remaining lifetime, so expired entries fall out of the cache on their own.
- **IP addresses are hashed (SHA-256), never stored raw** — click analytics are useful for aggregate patterns (device, referrer, country) without retaining identifiable IPs.

## Roadmap

1. JWT auth — links scoped to authenticated users
2. Custom aliases
3. QR code generation per link
4. Admin dashboard (React) — stats, link management
5. k6 load test targeting 10k redirects/sec, wired into CI