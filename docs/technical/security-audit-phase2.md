# Security Audit Phase 2: Bug Fixes

**Дата:** 2026-02-05

## Overview

Phase 2 addressed several runtime bugs across cron tasks, Telegram templates, Yandex Disk service, and environment configuration.

## Tagged Template Literal Check (Phase 1.5)

A full byte-level scan (`od`, `perl`, `grep -P`) was performed across all `api/**/*.js` files to search for tagged template literal misuse (pattern: `function\`template\`` instead of `function(\`template\``)).

**Result:** No tagged template literal bugs found. All 23 flagged locations across 4 files (`yandexDiskService.js`, `emailTemplates.js`, `refresh_public_urls.js`, `boardLockService.js`) already have correct function call syntax with `0x28` (opening parenthesis) before `0x60` (backtick).

**Search command used:**
```bash
grep -Prn '(console\.(log|error|warn)|new Error|\.push)`' api/ --include="*.js" | grep -v node_modules
# Exit code: 1 (no matches)
```

---

## B.1: Cron Schedule Fix — handleSubscriptionExpiry

**File:** `api/cron/tasks.js` (line 766)

**Problem:** The `handleSubscriptionExpiry` task was scheduled at `'0 9 * * *'` (09:00), conflicting with `notifyExpiringSubscriptions` which also runs at 09:00. The function docstring states it should run at 01:00.

**Fix:** Changed cron schedule from `'0 9 * * *'` to `'0 1 * * *'` and updated the corresponding console.log message.

**Reason:** Subscription expiry processing should complete before users receive notifications. Running both at 09:00 creates a race condition where users might receive "expiring" notifications for already-expired subscriptions.

---

## B.2: guestPlanId Reference Error — switchDemoToGuest

**File:** `api/cron/tasks.js` (line 557)

**Problem:** The `switchDemoToGuest` function queries the guest plan into `guestPlan` (line 513: `const guestPlan = guestPlanResult.rows[0]`), but later references `guestPlanId` (line 557) which is undefined in this scope.

This caused `subscription_history` inserts to fail with a ReferenceError for every demo-to-guest transition, meaning subscription history was not recorded.

**Fix:** Changed `guestPlanId` to `guestPlan.id`.

**Note:** The `handleSubscriptionExpiry` function (line 177) uses `const guestPlanId = guestPlanResult.rows[0].id` — a different variable naming pattern. The bug was likely a copy-paste error from that function.

---

## B.3: Telegram Template URL Fixes

**File:** `api/templates/telegramTemplates.js`

### Changes:

| Location | Old Value | New Value | Reason |
|---|---|---|---|
| `getWelcomeMessage` default param (line 119) | `https://fohow.ru/dashboard` | `https://interactive.marketingfohow.ru/boards` | Old domain, non-existent page |
| Inline keyboard button (line 162) | `📚 Обучающие материалы` → `https://fohow.ru/tutorials` | **Removed entirely** | Page does not exist |
| Inline keyboard button (line 166) | `https://t.me/fohow_support` | `https://t.me/FOHOWadmin` | Old support channel, now redirects to FOHOWadmin |

---

## B.4: YandexDiskService — API Response Handling

**File:** `api/services/yandexDiskService.js`

### Context: How `makeYandexDiskRequest` works

The internal helper `makeYandexDiskRequest` handles all HTTP communication with Yandex Disk API. Its return contract:

| Scenario | Return value |
|---|---|
| Success (2xx with body) | Parsed JSON object |
| Success (204 No Content) | `null` |
| Error (4xx/5xx) | Throws `Error` with `.status` property |
| Network error | Throws `Error` with message |

### Bugs fixed

Three functions (`checkPathExists`, `listFolderContents`, `deleteFolder`) were written as if `makeYandexDiskRequest` returns a raw `fetch` Response object, calling `.ok`, `.json()`, `.statusText` on already-parsed JSON data.

**checkPathExists:** Was checking `response.ok` (always `undefined` on a plain object → falsy). This made it always return `false` even for existing paths. Fixed to check `data !== null`.

**listFolderContents:** Was checking `response.ok` then calling `response.json()`. Since `makeYandexDiskRequest` already parses JSON, calling `.json()` on a plain object throws. Fixed to use the returned data directly.

**deleteFolder:** Was checking `response.ok` and `response.status` on the return value. Since DELETE returns 204 (mapped to `null`), and errors are thrown, the old code's error handling was unreachable. Fixed to use try/catch with `error.status === 404` for graceful handling of already-deleted folders.

---

## B.5: .env.example Updated

**File:** `api/.env.example`

Added missing environment variables:

```
YANDEX_DISK_TOKEN    — OAuth token for Yandex Disk API
YANDEX_DISK_BASE_DIR — Base directory on Yandex Disk (e.g. /fohow-interactive)
REDIS_URL            — Redis connection URL
```

These variables are required by `yandexDiskService.js` (which crashes at startup without them) and Redis-based caching, but were missing from the example configuration.

---

## Files Changed

| File | Changes |
|---|---|
| `api/cron/tasks.js` | Cron schedule `0 9` → `0 1` for task 2; `guestPlanId` → `guestPlan.id` |
| `api/templates/telegramTemplates.js` | Dashboard URL updated; tutorials button removed; support URL fixed |
| `api/services/yandexDiskService.js` | `checkPathExists`, `listFolderContents`, `deleteFolder` rewritten to match `makeYandexDiskRequest` contract |
| `api/.env.example` | Added `YANDEX_DISK_TOKEN`, `YANDEX_DISK_BASE_DIR`, `REDIS_URL` |
