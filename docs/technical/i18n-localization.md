# i18n / Localization

## Overview

The application uses **vue-i18n v9.14.5** in Composition API mode (`legacy: false`) to support three languages:

| Code | Language | Locale File |
|------|----------|-------------|
| `ru` | Russian (default) | `src/locales/ru.js` |
| `en` | English | `src/locales/en.js` |
| `zh` | Chinese | `src/locales/zh.js` |

## Configuration

The i18n instance is created in `src/i18n.js`:

- **Mode**: Composition API (`legacy: false`)
- **Default locale**: Detected from `localStorage('locale')` → browser language → `'ru'`
- **Fallback locale**: `'ru'`
- **Global injection**: Enabled (`$t` available in templates)

## Locale File Structure

All three locale files (`ru.js`, `en.js`, `zh.js`) export a default object with identical key structure:

```
common          — shared buttons and labels (save, cancel, delete, edit, etc.)
topMenu         — top navigation menu items
viewMenu        — view settings panel
projectMenu     — project operations (save, load, export, share)
toolsMenu       — tools panel (selection, hierarchy, drawing modes)
discussionMenu  — discussion panel (notes, comments, stickers, anchors)
board           — board/structure operations and relative dates
auth            — authentication forms (login, register, password reset)
verification    — email verification flow
profile         — profile dropdown menu
userProfile     — user profile page (form labels, tabs, placeholders)
structureModal  — structure naming modal
comments        — personal comments panel
stickers        — sticker messages panel
limits          — usage limits display
imageLibrary    — image library (upload, delete, errors)
toolbar         — canvas toolbar buttons
card            — card editing
mobile          — mobile toolbar (theme, zoom, version toggle)
notifications   — toast notifications
editor          — editor controls
```

## Usage in Components

### Composition API (recommended)

```vue
<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <h1>{{ t('auth.loginTitle') }}</h1>
  <input :placeholder="t('auth.enterCode')" />
  <button :aria-label="t('common.save')">{{ t('common.save') }}</button>
</template>
```

### Parameterized Translations

Some keys support interpolation parameters:

```js
// In locale file:
// minutesAgo: '{n} min ago'
t('board.minutesAgo', { n: 5 })  // → "5 min ago"

// filesTitle: 'Files: {used} of {total}'
t('limits.filesTitle', { used: 3, total: 10 })  // → "Files: 3 of 10"

// currentZoom: 'Current zoom: {zoom}%'
t('mobile.currentZoom', { zoom: 125 })  // → "Current zoom: 125%"
```

### In Script Logic (alerts, confirms, computed)

```js
const { t } = useI18n()

// In confirm dialogs
if (!confirm(t('stickers.deleteConfirm'))) return

// In alert messages
alert(t('stickers.contentEmpty'))

// In computed properties
const saveTooltip = computed(() =>
  isSaveAvailable.value ? t('common.save') : t('board.savePrompt')
)
```

## Internationalized Components

The following user-facing components use `useI18n()`:

### Authentication
- `src/components/LoginForm.vue`
- `src/components/RegisterForm.vue`
- `src/components/ForgotPasswordForm.vue`
- `src/components/ResetPasswordForm.vue`
- `src/views/EmailVerification.vue`

### Board & Structures
- `src/components/Board/BoardsModal.vue`
- `src/components/Board/StructureNameModal.vue`

### Panels
- `src/components/Panels/UserComments.vue`
- `src/components/Panels/StickerMessages.vue`

### Profile
- `src/components/UserProfile.vue`

### Layout
- `src/components/Layout/MobileToolbar.vue`

### Images
- `src/components/Images/MyLibraryTab.vue`
- `src/components/Images/SharedLibraryTab.vue`

### Notifications
- `src/components/ToastNotification.vue`

## Components NOT Internationalized

The following are intentionally excluded from i18n:

- `src/components/Admin/*` — admin panel (internal use only)
- Email templates — server-side rendered
- Telegram integration templates — bot-specific

## Adding a New Language

1. Create a new locale file `src/locales/{code}.js` with the same key structure
2. Import it in `src/i18n.js` and add to the `messages` object
3. Add the code to the allowed list in `getDefaultLocale()`
4. Add the language option to the language switcher UI

## Adding New Translation Keys

1. Add the key to **all three** locale files (`ru.js`, `en.js`, `zh.js`) to keep them in sync
2. Use the appropriate section based on the feature area
3. Use the `t('section.key')` pattern in the component
4. For parameterized strings, use `{paramName}` in the locale value and pass params as the second argument to `t()`

## Language Switching

The language switcher is in the View menu. When a user changes language:

1. The `locale` value is updated in the vue-i18n instance
2. The selected locale is saved to `localStorage('locale')`
3. All `t()` calls reactively update to show the new language
4. Date formatting in components uses `locale.value` for locale-aware output
