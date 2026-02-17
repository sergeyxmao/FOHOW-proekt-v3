# Top Menu — Architecture & Structure

## Overview

The top menu provides navigation across the application's main feature groups. It is implemented as a 3-tab system with an additional standalone language button.

**Structure (3 tabs + language button):**

| Tab | Key | Component | Description |
|-----|-----|-----------|-------------|
| Проект | `project` | `ProjectMenu.vue` | Export, clear canvas, new structure, admin save/load |
| Вид | `view` | `ViewMenu.vue` | Drawing/hierarchy/guides modes, lines, animation, background, header color |
| Элементы | `elements` | `DiscussionMenu.vue` | Partners, calendar, images, notes, geolocation, stickers |
| 🌐 (button) | — | Inline in `TopMenuButtons.vue` | Language switcher (ru/en/zh) |

## File Locations

### Desktop Menu

| File | Role |
|------|------|
| `src/components/Layout/TopMenuButtons.vue` | Orchestrator — renders tabs, undo/redo, language button |
| `src/components/Layout/ProjectMenu.vue` | Project menu dropdown |
| `src/components/Layout/ViewMenu.vue` | View menu dropdown |
| `src/components/Layout/DiscussionMenu.vue` | Elements menu dropdown |

### Mobile Menu

| File | Role |
|------|------|
| `src/components/Layout/MobileFullMenu.vue` | Full-screen slide-out panel with accordion sections |

### Locales

| File | Relevant sections |
|------|-------------------|
| `src/locales/ru.js` | `topMenu`, `projectMenu`, `viewMenu`, `elementsMenu`, `mobileMenu` |
| `src/locales/en.js` | Same sections |
| `src/locales/zh.js` | Same sections |

## Tab Details

### Project (`ProjectMenu.vue`)

Menu items:
- **Export as PNG** — emits `request-close`, triggers PNG export
- **Export as SVG** — emits `request-close`, triggers SVG export
- **Export as HTML** — emits `request-close`, triggers HTML export
- *separator*
- **Clear Canvas** — confirmation dialog (Teleport), emits `clear-canvas`
- **New Structure** — confirmation dialog (Teleport), emits `new-structure`
- *separator (admin only)*
- **Save JSON** — admin-only, emits save-json
- **Load JSON** — admin-only, emits load-json

Events emitted: `request-close`, `clear-canvas`, `new-structure`

### View (`ViewMenu.vue`)

Toggle items (top section):
- **Drawing Mode** — emits `activate-pencil`
- **Hierarchy Mode** — toggles `canvasStore.isHierarchicalDragMode`
- **Show Guides** — toggles `canvasStore.guidesEnabled`

Settings subsections:
- **Lines** — global line mode toggle, color picker, thickness slider
- **Animation** — enable/disable, interval seconds
- **Background** — preset colors, custom color picker
- **Header Color** — color picker, cycle button

Events emitted: `activate-pencil`

### Elements (`DiscussionMenu.vue`)

Items open/toggle side panels:
- Partners (`sidePanelsStore.openPartners()`)
- Calendar/Notes (`sidePanelsStore.openNotes()`)
- Images (`sidePanelsStore.openImages()`)
- Comments (`sidePanelsStore.openComments()`)
- Geolocation (`sidePanelsStore.openAnchors()`)
- Stickers (`sidePanelsStore.openStickerMessages()`)

Events emitted: `request-close`

### Language Button

Located in `TopMenuButtons.vue` between undo/redo buttons and the tab bar. Renders a `🌐` button that opens a dropdown with language options (ru, en, zh). Changes `locale.value` from vue-i18n and persists to `localStorage`.

## Mobile Menu (`MobileFullMenu.vue`)

Full-screen overlay panel with accordion-style sections mirroring the desktop structure:

### Sections
1. **Project** (📋) — Clear canvas, New structure
2. **View** (👁️) — Drawing mode button, then Lines/Animation/Background/Header color subsections
3. **Elements** (📦) — Partners, Notes, Images, Comments, Geolocation (+add), Stickers (+add)

### Bottom Actions
- Language switcher (🇷🇺 🇬🇧 🇨🇳 chips)
- Aurora design toggle
- Light/Dark theme toggle
- Desktop version toggle

### Events Emitted
`close`, `activate-pencil`, `toggle-theme`, `clear-canvas`, `new-structure`

## Event Flow (Desktop)

```
TopMenuButtons.vue
  ├── @activate-pencil ──→ forwarded to parent (CanvasBoard)
  ├── @clear-canvas ──→ forwarded to parent
  ├── @new-structure ──→ forwarded to parent
  └── Language change ──→ locale.value = newLocale (vue-i18n)

ProjectMenu.vue
  ├── @request-close ──→ TopMenuButtons closes dropdown
  ├── @clear-canvas ──→ TopMenuButtons forwards up
  └── @new-structure ──→ TopMenuButtons forwards up

ViewMenu.vue
  └── @activate-pencil ──→ TopMenuButtons forwards up

DiscussionMenu.vue
  └── @request-close ──→ TopMenuButtons closes dropdown
```

## Locale Key Structure

```
topMenu.project      — "Проект" tab label
topMenu.view         — "Вид" tab label
topMenu.elements     — "Элементы" tab label
topMenu.language     — "Язык" standalone button tooltip

projectMenu.*        — All project menu item labels, tooltips, dialog texts
viewMenu.*           — All view menu item labels and tooltips
elementsMenu.*       — All elements menu item labels (title, partners, calendar, etc.)
mobileMenu.*         — Mobile-specific labels (drawing, allLines, on/off, etc.)
```

## Change History

| Date | Change |
|------|--------|
| 2026-02-18 | Restructured from 4 tabs to 3 tabs. Removed "Инструменты" (Tools) tab — moved drawing/hierarchy/guides to View, clear canvas/new structure to Project. Renamed "Обсуждения" → "Элементы". Moved language switcher from View menu to standalone 🌐 button. Deleted `ToolsMenu.vue`. Renamed locale section `discussionMenu` → `elementsMenu`, deleted `toolsMenu` section. |
