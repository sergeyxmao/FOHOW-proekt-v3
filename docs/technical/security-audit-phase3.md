# Security Audit Phase 3: Hardening

**Дата:** 2026-02-06

## Overview

Phase 3 addressed 5 security issues: missing rate limiting, open CORS, limited MIME validation, a test endpoint in production, and a secret token leaked through module exports.

---

## 3.1: Rate Limiting on Auth Endpoints

**Package:** `@fastify/rate-limit` (installed as dependency)

**Registration:** `api/server.js` — registered globally with `{ global: false }` to avoid affecting non-auth routes.

**Protected endpoints:**

| Endpoint | Max Requests | Time Window | Rationale |
|---|---|---|---|
| `POST /api/login` | 5 | 15 minutes | Brute-force password guessing |
| `POST /api/register` | 3 | 15 minutes | Spam account creation |
| `POST /api/verification-code` | 3 | 5 minutes | Anti-bot code flooding |
| `POST /api/resend-verification-code` | 3 | 5 minutes | Email spam prevention |
| `POST /api/forgot-password` | 3 | 15 minutes | Email enumeration / spam |
| `POST /api/verify-email` | 5 | 5 minutes | Code brute-force |

**Response on limit exceeded:** HTTP 429 with `{ error: 'Слишком много попыток. Попробуйте позже.' }`

**How to modify limits:** Edit the `config.rateLimit` object on each route in `api/routes/auth.js`. Each route has its own `max` and `timeWindow` values.

**How to add rate limiting to a new route:**
```javascript
app.post('/api/some-route', {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '10 minutes',
      errorResponseBuilder: () => ({ error: 'Слишком много попыток. Попробуйте позже.' })
    }
  }
}, async (req, reply) => { ... });
```

---

## 3.2: CORS Restriction

**File:** `api/server.js`

**Before:** `origin: true` — accepts requests from any origin.

**After:** Whitelist of allowed origins:
- `https://interactive.marketingfohow.ru` — production frontend
- `https://1508.marketingfohow.ru` — secondary production domain
- `http://localhost:5173` — only in development (`NODE_ENV=development`)

**How to add a new domain:** Add the domain string to the `origin` array in `server.js`.

---

## 3.3: MIME Type Validation for Image Uploads

**Files:** `api/routes/images/myLibrary.js`, `api/routes/admin/images.js`

**Before:** Only `image/webp` was accepted. The frontend converts images to WebP before upload, but the API can be called directly (e.g., via curl or scripts).

**After:** Expanded whitelist:
- `image/webp`
- `image/jpeg`
- `image/png`
- `image/gif`

**Explicitly excluded:**
- `image/svg+xml` — SVG files can contain embedded JavaScript, making them a vector for stored XSS attacks.

**Error response:** HTTP 400 with `{ error: 'Недопустимый формат файла. Разрешены: webp, jpeg, png, gif.' }`

---

## 3.4: Test Endpoint Removed

**File:** `api/routes/auth.js`

**Removed:** `GET /api/test-auth` — a debug route that returned `{ ok: true, message: 'Auth routes работают!' }`. This endpoint was accessible without authentication and leaked internal information about the server structure.

---

## 3.5: Secret Token Export Removed

**File:** `api/services/yandexDiskService.js`

**Removed:** `YANDEX_DISK_TOKEN` from the `export` block. The Yandex Disk OAuth token was unnecessarily exported from the module, making it accessible to any importing module. The token is only used internally within `makeYandexDiskRequest()`.

Other files that need the token (e.g., `boards.js`, `profile.js`, `proxy.js`) correctly read it from `process.env.YANDEX_DISK_TOKEN` directly.

**Principle:** Secrets should have minimal scope. Export only what consumers need (functions, path constants), never the credentials themselves.

---

## Files Changed

| File | Changes |
|---|---|
| `api/server.js` | Added `@fastify/rate-limit` import + registration; CORS whitelist |
| `api/routes/auth.js` | Rate limits on 6 endpoints; removed test route |
| `api/routes/images/myLibrary.js` | Expanded MIME whitelist |
| `api/routes/admin/images.js` | Expanded MIME whitelist |
| `api/services/yandexDiskService.js` | Removed `YANDEX_DISK_TOKEN` from export |
| `api/package.json` | Added `@fastify/rate-limit` dependency |
