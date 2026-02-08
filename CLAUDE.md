# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FOHOW Interactive Board is an interactive canvas application for visualizing MLM (multi-level marketing) structures and partnership networks. Users can create boards with user cards (partners), connections between them, images, stickers, and notes.

**Tech Stack:**
- Frontend: Vue.js 3 (Composition API), Pinia (state management), Vue Router, Vite
- Backend: Node.js, Fastify, PostgreSQL, Redis
- Integrations: Yandex.Disk (image storage), Telegram Bot (notifications), SMTP (email verification)

## Essential Commands

### Frontend Development
```bash
# Start development server (port 5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test
```

### Backend Development
```bash
# Start API server (port 4000)
cd api && npm start

# Run database migration
cd api && node run-migration.js
```

### Deployment
```bash
# Build and deploy to GitHub Pages
npm run deploy         # Linux/Mac
npm run deploy:windows # Windows
```

## Project Architecture

### Monorepo Structure
```
FOHOW-proekt-v3/
├── src/              # Vue.js frontend
│   ├── components/   # Vue components (Canvas, Panels, Admin, Images, etc.)
│   ├── composables/  # Reusable logic (useCanvasDrag, usePanZoom, etc.)
│   ├── stores/       # Pinia stores (auth, board, cards, connections, etc.)
│   ├── views/        # Page components (HomeView, AdminPanel, etc.)
│   ├── router/       # Vue Router configuration
│   ├── services/     # API client services
│   ├── locales/      # i18n translations
│   └── utils/        # Utility functions
│
├── api/              # Fastify backend
│   ├── server.js     # Entry point, middleware, WebSocket, cron jobs
│   ├── routes/       # API endpoints (auth, boards, images, admin, etc.)
│   ├── services/     # Business logic (yandexDiskService, emailVerificationService, etc.)
│   ├── middleware/   # Auth, admin checks, feature gates, usage limits
│   ├── bot/          # Telegram bot integration
│   ├── cron/         # Background tasks
│   └── db.js         # PostgreSQL connection pool
│
└── docs/             # Comprehensive documentation
    ├── ARCHITECTURE.md
    ├── technical/    # Detailed technical docs
    └── guides/       # User guides
```

### Key Architectural Patterns

1. **Canvas-based Rendering**: The core feature is `CanvasBoard.vue`, which orchestrates multiple composables for different canvas interactions (drag, zoom, selection, connections, image rendering, etc.)

2. **Composable-driven Logic**: Heavy use of Vue composables for reusable functionality:
   - `useCanvasImageRenderer.js` (~700 lines) - Canvas2D rendering with LRU caching
   - `useAvatarConnections.js` (~688 lines) - Bezier curve connections between user cards
   - `useCanvasDrag.js` (~636 lines) - Drag & drop with guides integration
   - `useActivePv.js` (~450 lines) - Active PV logic and balance propagation
   - `useCanvasSelection.js` (~373 lines) - Multi-selection with rectangular selection
   - `usePanZoom.js` - Viewport pan and zoom
   - `useBezierCurves.js` - Bezier curve mathematics

3. **Pinia Stores as Single Source of Truth**: All application state managed through Pinia stores:
   - `auth.js` - Authentication, user session
   - `board.js` - Current board state, work modes
   - `cards.js` - User cards on canvas (CRUD operations)
   - `connections.js` - Connections between cards
   - `images.js` - Images on canvas
   - `stickers.js` - Stickers/notes
   - `viewport.js` - Canvas viewport state (zoom, position)
   - `history.js` - Undo/Redo functionality

4. **Backend is Stateless**: All state persisted in PostgreSQL; backend only handles API requests and business logic

5. **Board Data Format**: Boards are stored in PostgreSQL with JSONB `content` field containing:
   - User cards (partners) with positions and metadata
   - Connections between cards (Bezier curves)
   - Images with positions and sizes
   - Stickers with content and positions
   - Canvas settings (background, grid, guides)

### API Proxy Configuration

The Vite dev server proxies `/api/*` requests to the backend at `http://127.0.0.1:4000` (configured in [vite.config.js:34-39](vite.config.js#L34-L39)). This solves CORS issues in development.

## Important Implementation Details

### Board Save/Load Flow

**Saving**: Frontend collects state from all stores → sends JSON to `PUT /api/boards/:id` → backend validates and saves to PostgreSQL `boards.content` (JSONB) → creates thumbnail

**Loading**: Frontend fetches from `GET /api/boards/:id` → receives JSON with full board state → dispatches to each store via `applyState()` methods

### Authentication Flow

- JWT tokens stored in localStorage
- Refresh tokens for session management
- Email verification required for new accounts
- Forced logout mechanism with auto-save before logout ([FORCED_LOGOUT_FLOW.md](docs/technical/FORCED_LOGOUT_FLOW.md))
- Global fetch interceptor in [src/utils/apiFetch.js](src/utils/apiFetch.js) handles token refresh and forced logout

### Image Handling

- User uploads → backend receives via multipart
- Backend uploads to Yandex.Disk
- Metadata (URL, dimensions) stored in PostgreSQL `images` table
- Frontend proxies images through backend for CORS
- Canvas uses Canvas2D API for image rendering with LRU caching

### Subscription/Feature System

- Plans: GUEST (1 board), DEMO (7 days, 3 boards), INDIVIDUAL (10 boards), PREMIUM (unlimited)
- Feature gates check subscription level via middleware
- Usage limits enforced at API level

### WebSocket Integration

Real-time updates for:
- Chat messages
- Board locks (prevent concurrent editing)
- Notifications

### Admin Panel

Located at `/admin` route (requires admin role). Features:
- User management
- Image moderation (Yandex Vision API)
- Usage statistics
- Transaction history
- Verification requests

## Common Development Patterns

### Adding a New Composable

1. Create file in `src/composables/useXxxYyy.js`
2. Export function: `export function useXxxYyy(options) { ... }`
3. Import and call in component (typically in `<script setup>`)
4. Return reactive state and methods

### Adding a New API Endpoint

1. Find or create route file in `api/routes/` (e.g., `api/routes/boards.js`)
2. Register route in `api/server.js` if new file
3. Use middleware for auth: `{ preHandler: authenticateToken }`
4. Use middleware for admin: `{ preHandler: [authenticateToken, checkAdmin] }`
5. Restart backend: `cd api && npm start`

### Adding a New Store

1. Create file in `src/stores/xxxYyy.js`
2. Define with `defineStore('xxxYyy', () => { ... })`
3. Return reactive state and methods
4. Implement `applyState(state)` method for board loading
5. Export state in board save flow (see [src/App.vue:712-750](src/App.vue#L712-L750))

### Working with Canvas

- Main orchestrator: [src/components/Canvas/CanvasBoard.vue](src/components/Canvas/CanvasBoard.vue)
- Canvas rendering happens in `useCanvasImageRenderer.js`
- All canvas objects (cards, images, stickers) use absolute positioning
- Viewport coordinates managed by `viewport` store
- Pan/zoom affects transform matrix

### Database Queries

- Use parameterized queries: `pool.query('SELECT * FROM users WHERE id = $1', [userId])`
- Connection pool managed in [api/db.js](api/db.js)
- Migrations in `api/migrations/`

## Testing

- Frontend tests use Node.js test runner: `node --test tests/*.spec.js`
- Test files located in `tests/` directory
- Examples: [tests/activePv.spec.js](tests/activePv.spec.js), [tests/pencilOverlayImages.spec.js](tests/pencilOverlayImages.spec.js)

## Documentation Resources

**Primary documentation**: [docs/technical/INDEX.md](docs/technical/INDEX.md) - comprehensive technical map

**Key documents**:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture overview
- [docs/technical/FORCED_LOGOUT_FLOW.md](docs/technical/FORCED_LOGOUT_FLOW.md) - Forced logout with auto-save
- [docs/technical/BOARD_LOCK_SYSTEM.md](docs/technical/BOARD_LOCK_SYSTEM.md) - Concurrent editing prevention
- [docs/technical/image-library.md](docs/technical/image-library.md) - Image upload and library system
- [docs/technical/composables.md](docs/technical/composables.md) - Composables documentation

## Special Considerations

### Canvas Performance

- Virtual rendering used for images (only visible images rendered)
- LRU cache for loaded images
- Drag operations use requestAnimationFrame
- Guides only computed for nearby objects during drag

### Security

- JWT authentication with refresh tokens
- bcrypt password hashing
- Rate limiting on API endpoints
- CORS configured for specific origins
- Helmet security headers
- Input validation and sanitization
- SQL injection prevention via parameterized queries

### Internationalization

- Vue i18n for translations
- Locale files in `src/locales/`
- Language switcher in header

### Mobile Support

- Responsive design with mobile-specific components
- Touch gesture support for pan/zoom
- Mobile toolbar and sidebar
- Pinch-to-zoom via `useMobileUIScaleGesture.js`

## Important Notes

- The README.md incorrectly mentions React - this is a Vue.js 3 project
- CanvasBoard.vue is the orchestrator; actual logic lives in composables
- Stores are the single source of truth for all data
- Backend is stateless; all state in PostgreSQL
- Images stored on Yandex.Disk, only metadata in database
- Board content stored as JSONB in PostgreSQL for flexibility
## Code Style Rules

- **JavaScript only** — NO TypeScript
- **Composition API** with `<script setup>` — NO Options API
- **CSS Modules** or scoped CSS — NO Tailwind
- **NO class components**
- Write simple, readable code that a junior developer can understand

## Swagger/OpenAPI Requirements

Project uses @fastify/swagger + @fastify/swagger-ui (Swagger UI at `/api/docs`, admin only).

**Every new/changed API endpoint MUST have a `schema` object:**
```javascript
app.get('/api/example', {
  schema: {
    tags: ['GroupName'],
    summary: 'Описание эндпоинта',
    security: [{ bearerAuth: [] }],
    querystring: {
      type: 'object',
      properties: {
        page: { type: 'integer', default: 1 }
      }
    },
    response: {
      200: { type: 'object', properties: { success: { type: 'boolean' } } },
      401: { type: 'object', properties: { error: { type: 'string' } } }
    }
  },
  preHandler: [authenticateToken]
}, async (req, reply) => { ... })
```

**⚠️ `nullable: true` MUST always be used together with `type` (AJV strict mode in Fastify 5)**

**Existing Swagger tags (23):**
Auth, Profile, Users, Boards, Board Folders, Board Partners, Stickers, Notes, Comments, Anchors, Images, Partners, Relationships, Favorites, Chats, Notifications, Telegram, Plans, Promo, Verification, Tribute, Admin, System

## Database Rules

- ⛔ **DO NOT** execute SQL migrations (ALTER TABLE, CREATE TABLE, DROP, etc.)
- ⛔ Database migrations are done ONLY manually by the project owner via Adminer
- If DB changes are needed — describe required SQL and stop, wait for confirmation
- Use parameterized queries only: `pool.query('SELECT ... WHERE id = $1', [id])`

## Documentation Rules

- 📄 Documentation is a MANDATORY part of every task
- Before making changes — check if docs exist in `docs/technical/` for the affected feature
- If docs exist → update them
- If docs don't exist → create them
- Task is NOT complete without documentation

## Restrictions

- ⛔ DO NOT modify `index.html` in root (Vite template)
- ⛔ DO NOT execute database migrations
- ⛔ DO NOT install unnecessary dependencies
- ✅ Minimal changes, don't break existing functionality
- ✅ Always create/update documentation
- ✅ New/changed API endpoints MUST have Swagger schema

## Servers

- **Production:** https://interactive.marketingfohow.ru — branch `main` — ⛔ DO NOT TOUCH
- **Staging:** https://1508.marketingfohow.ru — branch `dev` — ✅ for development