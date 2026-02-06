# Security Audit Phase 4: Stability & Reliability

**Дата:** 2026-02-06

## Overview

Phase 4 addressed stability and data-safety issues: cron task concurrency, Telegram delivery reliability, stale data cleanup, and `SELECT *` data leaks.

---

## 4.1: Advisory Locks for Cron Tasks

**File:** `api/cron/tasks.js`

**Problem:** If a cron task takes longer than its schedule interval, the next run starts in parallel, leading to duplicate operations (e.g., double subscription downgrades, duplicate Telegram notifications).

**Solution:** All cron tasks are wrapped in `withAdvisoryLock(lockId, fn)` which uses PostgreSQL `pg_try_advisory_lock()`. If the lock is already held (previous run still in progress), the new run is skipped with a log message.

### Lock ID Table

| Lock ID | Task | Schedule |
|---|---|---|
| 100001 | notifyExpiringSubscriptions | Daily 09:00 MSK |
| 100002 | handleSubscriptionExpiry | Daily 01:00 MSK |
| 100003 | handleGracePeriodExpiry | Daily 01:30 MSK |
| 100004 | cleanupOldSessions | Hourly |
| 100005 | cleanupInactiveSessions | Every 5 min |
| 100006 | closeDemoPeriods | Daily 02:00 MSK |
| 100007 | switchDemoToGuest | Daily 02:30 MSK |
| 100008 | deleteLockedBoardsAfter14Days | Daily 03:00 MSK |
| 100009 | cleanupExpiredVerificationCodes | Hourly |
| 100010 | processDailyLocks | Daily 03:30 MSK |
| 100011 | cleanupTelegramLinkCodes | Hourly |

### How to add a new cron task with advisory lock

1. Add a new entry to `LOCK_IDS` with a unique number (100012+)
2. Wrap the cron callback:
```javascript
cron.schedule('...', () => {
  withAdvisoryLock(LOCK_IDS.YOUR_TASK, async () => {
    await yourTaskFunction();
  });
});
```

---

## 4.2: Telegram Retry Logic

**File:** `api/utils/telegramService.js`

**Problem:** When Telegram API returns a temporary error (502, 503, network timeout), the notification is lost permanently.

**Solution:** Added `withRetry(fn, maxRetries, baseDelay)` wrapper with exponential backoff. Applied to the `sendMessage` call inside `sendTelegramMessage()`.

### Parameters

| Parameter | Default | Description |
|---|---|---|
| maxRetries | 3 | Maximum number of retry attempts |
| baseDelay | 1000ms | Base delay (doubles each attempt: 1s, 2s, 4s) |

### Retryable errors

Only these errors trigger a retry:
- No `.status` property (network-level errors)
- HTTP status >= 500 (server errors: 500, 502, 503)
- `ECONNRESET` — connection reset by server
- `ETIMEDOUT` — connection timed out

Non-retryable errors (thrown immediately):
- HTTP 400 (bad request — malformed message)
- HTTP 401/403 (auth errors — invalid token)
- HTTP 429 (rate limited by Telegram — already has its own backoff)

---

## 4.3: Cleanup for telegram_link_codes

**File:** `api/cron/tasks.js`

Added new cron task (task 9) that runs hourly to delete expired or used Telegram link codes:

```sql
DELETE FROM telegram_link_codes WHERE expires_at < NOW() OR used = true
```

Protected by advisory lock `LOCK_IDS.CLEANUP_TELEGRAM_CODES` (100011).

---

## 4.5: SELECT * Replacement

### Critical: Password Hash Leak in users.js

**File:** `api/routes/users.js:14`

`GET /api/users/me` used `SELECT * FROM users` and returned the full row to the client, **including the bcrypt password hash**. This is a critical data leak — any authenticated user could see their own password hash.

**Fix:** Replaced with explicit field list excluding `password`.

### Other files

| File | Line | Change |
|---|---|---|
| `api/routes/users.js:14` | `SELECT *` → explicit fields (no `password`) | **Critical fix** |
| `api/routes/profile.js:141` | `SELECT *` → explicit fields (no `password`) | Used for internal profile update logic |
| `api/routes/auth.js:272` | `SELECT *` kept | Password needed for `bcrypt.compare`; `delete user.password` called before response. Comment added explaining why. |
| `api/routes/boards.js:117` | `SELECT *` → explicit board fields | First occurrence (GET board) |
| `api/routes/boards.js:377` | `SELECT *` → explicit board fields | Second occurrence (duplicate board) |

### Excluded fields

**users table:** `password` — never sent to client (except auth.js where it's deleted before response)

**boards table:** Using explicit fields ensures only known columns are returned, preventing accidental exposure if new sensitive columns are added later.

---

## Files Changed

| File | Changes |
|---|---|
| `api/cron/tasks.js` | Advisory lock utility + LOCK_IDS constants; all 8 cron tasks wrapped; new task 9 (telegram_link_codes cleanup) |
| `api/utils/telegramService.js` | `withRetry` utility; retry logic on `sendMessage` |
| `api/routes/users.js` | `SELECT *` → explicit fields (password excluded) |
| `api/routes/profile.js` | `SELECT *` → explicit fields (password excluded) |
| `api/routes/auth.js` | Comment added explaining SELECT * necessity |
| `api/routes/boards.js` | Two `SELECT *` → explicit board fields |
