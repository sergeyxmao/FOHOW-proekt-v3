# Security Audit Phase 5: Frontend Cleanup

**Дата:** 2026-02-06

## Overview

Phase 5 addressed frontend quality issues: missing 404 handling, no lazy loading for routes, excessive debug logging in production, and an orphaned example file.

---

## 5.1: 404 Page & Catch-All Route

**Files:** `src/views/NotFound.vue` (new), `src/router/index.js`

**Problem:** Navigating to a non-existent URL showed a blank page with no feedback.

**Solution:**
- Created `NotFound.vue` component with 404 message and a link back to home.
- Added catch-all route `/:pathMatch(.*)*` as the last entry in the routes array.
- Route uses `meta: { layout: 'public' }` so it renders without requiring authentication.

---

## 5.2: Lazy Loading for Route Components

**File:** `src/router/index.js`

**Problem:** All page components were statically imported, increasing the initial bundle size. Users downloading the admin panel or pricing page code even when they never visit those pages.

**Solution:** Replaced static imports with dynamic `() => import(...)` for all pages except `HomeView` (which is the landing page and should load immediately).

| Component | Before | After |
|---|---|---|
| `HomeView` | Static import | Static import (unchanged) |
| `PricingPage` | `import PricingPage from ...` | `() => import('../views/PricingPage.vue')` |
| `EmailVerification` | `import EmailVerification from ...` | `() => import('../views/EmailVerification.vue')` |
| `BoardsList` | `import BoardsList from ...` | `() => import('../components/Board/BoardsList.vue')` |
| `AdminPanel` | `import AdminPanel from ...` | `() => import('../views/AdminPanel.vue')` |
| `NotFound` | N/A (new) | `() => import('../views/NotFound.vue')` |

---

## 5.3: Debug console.log Cleanup

**Problem:** Production code contained debug `console.log` statements that leak internal state to browser DevTools. This includes authentication data, user roles, animation states, and internal IDs.

**Rule:** Removed `console.log` only. Kept `console.error` and `console.warn` as they indicate real problems.

### Router (4 removed)

| File | Lines | Content |
|---|---|---|
| `src/router/index.js` | 55 | Navigation logging |
| `src/router/index.js` | 71-72 | User/role logging after loadUser |
| `src/router/index.js` | 81 | Admin access granted |

### Stores (11 removed, excluding drawing.usage.example.js)

| File | Count | Content |
|---|---|---|
| `src/stores/auth.js` | 4 | Token decode, init, finalizeAuth, profile update |
| `src/stores/admin.js` | 1 | Image rename success |
| `src/stores/images.js` | 1 | Blob URL success |
| `src/stores/stickers.js` | 2 | Sticker delete/load success |
| `src/stores/connections.js` | 1 | Duplicate connection warning |

### Composables (92 removed)

| File | Count | Content |
|---|---|---|
| `src/composables/useProjectActions.js` | 32 | Export/print progress logging |
| `src/composables/useUserCardConnections.js` | 24 | Animation sequence/DOM logging |
| `src/composables/useActivePv.js` | 22 | Balance animation logging |
| `src/composables/useCanvasImageRenderer.js` | 5 | Image cache/render logging |
| `src/composables/useCanvasConnections.js` | 5 | Connection draw/delete logging |
| `src/composables/useMobileUIScaleGesture.js` | 4 | Touch/gesture logging |

**Total removed:** ~107 console.log statements.

---

## 5.4: Example File Deletion

**File:** `src/stores/drawing.usage.example.js` (deleted)

**Problem:** An example/documentation file was left in the production source tree. It contained no functional code — only usage examples for the drawing store with `console.log` calls.

**Verification:** Grep confirmed no imports of this file exist anywhere in the project.

---

## 5.5: Исправление двойного хеша в именах lazy-loaded чанков Vite

**Файл:** `vite.config.js`

**Проблема:** На production (interactive.marketingfohow.ru) не загружались lazy-loaded страницы (NotFound, AdminPanel, BoardsList, PricingPage, EmailVerification). Vite при сборке генерировал файлы с двойным хешем в имени (например `NotFound-Di_yQy91-B5_9iTXN.js`), но в основном бандле (`index-*.js`) записывал ссылку с одинарным хешем (`NotFound-Di_yQy91.js`). Браузер запрашивал несуществующий файл, Nginx возвращал `index.html` вместо JS-модуля, что приводило к ошибке:

```
Failed to load module script: Expected a JavaScript-or-Wasm module script
but the server responded with a MIME type of "text/html".
```

**Причина:** Без явного указания формата `chunkFileNames` Vite/Rollup использовал шаблон по умолчанию, который в определённых версиях мог генерировать двойной хеш для динамически импортируемых чанков.

**Решение:** Добавлена секция `build` в `vite.config.js` с явным форматом имён чанков:

```js
build: {
  rollupOptions: {
    output: {
      chunkFileNames: 'assets/[name]-[hash].js'
    }
  }
}
```

**Проверка:**

```bash
rm -rf dist node_modules/.vite && pnpm run build
grep -oE "(AdminPanel|BoardsList|PricingPage|EmailVerification|NotFound)[^\"']*\.js" dist/assets/index-*.js | sort
ls dist/assets/{AdminPanel,BoardsList,PricingPage,EmailVerification,NotFound}*.js
# Оба списка ДОЛЖНЫ совпадать — каждый чанк имеет одинарный хеш
```

---

## Files Changed

| File | Changes |
|---|---|
| `src/views/NotFound.vue` | New file — 404 page component |
| `src/router/index.js` | Lazy loading for 4 components; catch-all route; 4 console.log removed |
| `src/stores/auth.js` | 4 console.log removed |
| `src/stores/admin.js` | 1 console.log removed |
| `src/stores/images.js` | 1 console.log removed |
| `src/stores/stickers.js` | 2 console.log removed |
| `src/stores/connections.js` | 1 console.log removed |
| `src/composables/useProjectActions.js` | 32 console.log removed |
| `src/composables/useUserCardConnections.js` | 24 console.log removed |
| `src/composables/useActivePv.js` | 22 console.log removed |
| `src/composables/useCanvasImageRenderer.js` | 5 console.log removed |
| `src/composables/useCanvasConnections.js` | 5 console.log removed |
| `src/composables/useMobileUIScaleGesture.js` | 4 console.log removed |
| `src/stores/drawing.usage.example.js` | Deleted |
| `vite.config.js` | Added `build.rollupOptions.output.chunkFileNames` to fix double-hash in lazy-loaded chunks |
