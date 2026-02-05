# Security Audit Phase 1: Critical Fixes

## Overview

Phase 1 of the security audit addressed 3 critical vulnerabilities and 1 bug identified during code review.

## Vulnerabilities Fixed

### 1. Hardcoded JWT Secret Fallback (Critical)

**File:** `api/socket.js` (line 4)

**Problem:** The JWT secret had a hardcoded fallback value `'your-secret-key-change-in-production'`. If the `JWT_SECRET` environment variable was not set, the application would silently use a predictable key, allowing attackers to forge valid JWT tokens.

**Fix:** Removed the fallback. The service now throws an `Error` at startup if `JWT_SECRET` is not defined, preventing the application from running with an insecure configuration.

```javascript
// Before (vulnerable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// After (secure)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

### 2. SQL Injection in checkUsageLimit Middleware (Critical)

**File:** `api/middleware/checkUsageLimit.js` (line 32)

**Problem:** The `limitFeatureName` parameter was interpolated directly into a SQL query via a template string (`sp.features->'${limitFeatureName}'`). Although this parameter comes from server-side route definitions (not user input), it violated the principle of defense in depth — any future misuse or dynamic assignment could lead to SQL injection.

**Fix:** Added a whitelist validation before the SQL query. Only pre-approved feature names are accepted:

```javascript
const ALLOWED_FEATURES = ['max_boards', 'max_stickers', 'max_notes', 'max_comments', 'max_licenses'];
if (!ALLOWED_FEATURES.includes(limitFeatureName)) {
  return reply.code(400).send({ error: 'Invalid feature name' });
}
```

**Whitelist rationale:** The allowed values were determined by searching all `checkUsageLimit()` calls in the codebase:

| Route File | Call | limitFeatureName |
|---|---|---|
| `api/routes/boards.js:163` | `checkUsageLimit('boards', 'max_boards')` | `max_boards` |
| `api/routes/boards.js:197` | `checkUsageLimit('cards', 'max_licenses')` | `max_licenses` |
| `api/routes/notes.js:49` | `checkUsageLimit('notes', 'max_notes')` | `max_notes` |
| `api/routes/stickers.js:73` | `checkUsageLimit('stickers', 'max_stickers')` | `max_stickers` |
| `api/routes/comments.js:33` | `checkUsageLimit('comments', 'max_comments')` | `max_comments` |

When adding new feature limits, the `ALLOWED_FEATURES` array in `checkUsageLimit.js` must be updated accordingly.

### 3. JWT Payload Field Mismatch (Bug — Broken WebSocket Auth)

**File:** `api/socket.js` (line 24)

**Problem:** JWT tokens are generated with the payload field `userId` (in `api/routes/auth.js`), but the WebSocket authentication middleware was reading `decoded.id`. This caused `socket.userId` to always be `undefined`, breaking all WebSocket features that depend on user identification (personal rooms, typing indicators, chat join/leave).

**Fix:** Changed `decoded.id` to `decoded.userId` to match the JWT payload structure.

```javascript
// Before (broken)
socket.userId = decoded.id;

// After (correct)
socket.userId = decoded.userId;
```

## JWT Payload Format (Canonical)

All JWT tokens in the application use the following payload structure:

```javascript
{
  userId: number,  // User's database ID
  email: string,   // User's email address
  role: string     // User's role ('user' | 'admin')
}
```

Generated in `api/routes/auth.js` across login, email verification, and password reset flows. All consumers of JWT tokens must use `decoded.userId`, not `decoded.id`.

## Files Changed

| File | Changes |
|---|---|
| `api/socket.js` | Removed JWT secret fallback; fixed `decoded.id` to `decoded.userId` |
| `api/middleware/checkUsageLimit.js` | Added whitelist validation for `limitFeatureName` |

## Notes

- `api/routes/admin/users.js` line 31 was reviewed for a reported tagged template literal syntax error, but the code was found to already have correct syntax (`push(` with proper function call).
- No database migrations required.
- No changes to frontend code.
