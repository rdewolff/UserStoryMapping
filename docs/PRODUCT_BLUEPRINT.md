# User Story Mapping App Blueprint (MVP)

## 1. Vision
Build a beautiful, clean, and highly visual web app to manage product work through user story mapping.

The core model:
- Horizontal axis: `Modules / Features` (editable columns).
- Vertical axis: `Priority Lanes`.
- Priority lanes for MVP:
1. `Skeleton` (highest priority)
2. `MVP`
3. `Lovable` (nice-to-have)

Cards are post-it style, easy to move, quick to read, and easy to edit.

## 2. Product Goals
1. Make story mapping fast and intuitive.
2. Support drag-and-drop across modules and lanes with immediate persistence.
3. Keep information density low by default (title-first cards), with optional detail on demand.
4. Provide lightweight filtering for planning discussions.
5. Ship a production-ready MVP with simple auth and SQLite.
6. Avoid ambiguous behavior by defining strict API and data rules upfront.

## 3. Non-Goals (Phase 1)
1. Full CSV import/export flow (planned for phase 2).
2. Complex role-based permissions.
3. Real-time multi-user collaboration.
4. Full calendar planning engine.

## 4. MVP Scope
### In Scope
1. Authentication:
- Simple login/password.
- Session cookies.
2. Board experience:
- Create/edit module names (columns).
- Three fixed priority lanes (`Skeleton`, `MVP`, `Lovable`).
- Create/edit/delete cards.
- Drag-and-drop cards across columns and lanes.
- Zoom in/out and fit-to-board.
- Pan canvas.
3. Card fields:
- `title` (required)
- `description` (optional)
- `priority_lane` (`skeleton|mvp|lovable`)
- `effort` (`xs|s|m|l|xl`)
- `week_target` (optional, nullable ISO week string like `2026-W09`)
4. Board utilities:
- Search by title/description.
- Filter by lane, effort, module.
- Clear visual status when saving/saved.

### Out of Scope for MVP (but designed for)
1. CSV import/export UI and parser.
2. Dedicated timeline planner view.
3. Advanced analytics/reporting.

## 5. UX / UI Direction
Reference direction: `beta.whisperit.ch` style family (clean, premium, calm).

### Design Principles
1. Calm interface, low noise, high clarity.
2. Content-first with strong typography and spacing.
3. Drag-and-drop feels direct and responsive.
4. Dense information only when requested.

### Visual System
#### Typography
1. Primary UI font: `Geist`.
2. Display/section accents: `Playfair Display` sparingly.

#### Color Tokens (Whisperit-inspired)
```css
:root {
  --bg: hsl(60 20% 98%);
  --surface: hsl(60 10% 95%);
  --card: hsl(0 0% 100%);
  --border: hsl(60 10% 88%);
  --text: hsl(0 0% 9%);
  --text-muted: hsl(0 0% 40%);

  --brand: hsl(207 56% 55%);
  --brand-soft: hsl(207 56% 95%);
  --warm: hsl(24 66% 70%);

  --lane-skeleton: hsl(207 40% 95%);
  --lane-mvp: hsl(60 20% 98%);
  --lane-lovable: hsl(24 70% 85%);

  --success: hsl(102 45% 50%);
  --warning: hsl(24 86% 68%);
  --danger: hsl(0 84% 60%);
}
```

### Layout
1. Top bar:
- Workspace name.
- Board selector.
- Search + filters.
- Zoom controls.
- Add module / add card actions.
2. Board canvas:
- Horizontal scrolling for modules.
- Vertical lane separation for `Skeleton/MVP/Lovable`.
- Sticky module headers and lane labels.
3. Card behavior:
- Compact by default: title + small metadata chips.
- Expand/edit on click in side panel or modal.

### Motion and Interaction
1. Drag hover/placeholder states clearly visible.
2. Drop animation subtle and quick.
3. Keyboard support for quick create and navigation.
4. Persistence policy:
- Drag/drop saves immediately.
- Field edits autosave with a 300-500ms debounce.
- Optimistic UI with rollback on failure.

## 6. User Flows
### Flow A: Create and organize map
1. User logs in.
2. User creates board.
3. User adds modules (columns).
4. User adds cards and places them by lane.
5. User drags cards to reorder and reprioritize.

### Flow B: Refine card details
1. User clicks card.
2. User edits title, description, effort, target week.
3. Changes autosave.

### Flow C: Planning discussion mode
1. User filters by lane/effort/module.
2. User zooms out for strategic view.
3. User zooms in for detailed editing.

## 7. Technical Architecture
### Core Stack
1. `Next.js` (App Router) + `TypeScript`.
2. `Tailwind CSS` + component primitives.
3. `dnd-kit` for drag-and-drop.
4. `SQLite` database.
5. `Prisma` ORM.
6. Server runtime: Node.js.

### App Structure
1. `app/(auth)` for login.
2. `app/(app)/boards` for board list.
3. `app/(app)/boards/[id]` for story map workspace.
4. `app/api/*` for CRUD and move operations.

### Data Access Pattern
1. Server actions or route handlers for writes.
2. Zod validation on all payloads.
3. Optimistic updates in client state.
4. Transactional move operations for position integrity.
5. Optimistic concurrency control using `version` and `updated_at` with `409` conflict responses.

## 8. Data Model (MVP)
### Tables
1. `users`
- `id`, `email`, `password_hash`, timestamps.
2. `sessions`
- `id`, `user_id`, `expires_at`.
3. `boards`
- `id`, `owner_id`, `name`, `description`, timestamps.
4. `modules`
- `id`, `board_id`, `name`, `position`.
5. `cards`
- `id`, `board_id`, `module_id`
- `title`, `description`
- `priority_lane` (`skeleton|mvp|lovable`)
- `effort` (`xs|s|m|l|xl`)
- `week_target` (nullable ISO week string `YYYY-Www`)
- `position` (ordering within module+lane)
- `version` (integer, default `1`, increment on each write)
- timestamps.

### Ordering Rule
- Ordering key is `position` within the tuple `(module_id, priority_lane)`.
- Moving cards reindexes only affected groups in one DB transaction.

### Required Constraints
1. Unique index on `modules(board_id, position)`.
2. Unique index on `cards(module_id, priority_lane, position)`.
3. Foreign keys with cascade delete from `boards -> modules -> cards`.
4. `priority_lane` and `effort` constrained to enum values.

## 9. API Contract (MVP)
1. `POST /api/auth/login`
2. `POST /api/auth/logout`
3. `GET /api/boards`
4. `POST /api/boards`
5. `GET /api/boards/:id` (returns board + ordered modules + ordered cards)
6. `PATCH /api/boards/:id`
7. `POST /api/boards/:id/modules`
8. `PATCH /api/modules/:id`
9. `DELETE /api/modules/:id` (cascade delete module cards after explicit user confirmation)
10. `POST /api/boards/:id/cards`
11. `PATCH /api/cards/:id`
12. `DELETE /api/cards/:id`
13. `POST /api/cards/:id/move`

### Write Contract Rules
1. Every write payload includes `version` when updating existing records.
2. Server returns `409` on stale `version`.
3. Client handles conflicts by reloading latest board state and showing a conflict toast.

## 10. Security and Reliability Baseline
1. Password hashes with `bcrypt`.
2. `HttpOnly`, `Secure`, `SameSite=Lax` session cookie.
3. Auth checks on all protected routes.
4. Input validation with Zod.
5. Server-side ownership checks per board/module/card.
6. Login rate limiting and incremental lockout/backoff after repeated failures.
7. CSRF protection on all mutating routes (token or strict Origin/Host validation).
8. `description` handled as plain text (escaped on render) to avoid XSS.
9. Basic structured error responses.

## 11. Performance Baseline
1. Virtualized rendering for large board counts (phase 1.5 if needed).
2. Debounced autosave.
3. Fast optimistic interactions.
4. Indexed position queries by board/module/lane.
5. MVP sizing target: up to 10 boards/user, 30 modules/board, 1500 cards/board.

## 12. Deployment Constraints (SQLite MVP)
1. Single-region deployment with one primary writer process.
2. SQLite `WAL` mode enabled.
3. Daily automated backups and restore test plan.
4. Expected RPO: 24h. Expected RTO: 2h.
5. Planned migration path to Postgres when concurrency/scale requires it.

## 13. Build Plan (Documentation-First)
### Phase 0: Repo and setup
1. Initialize git repository.
2. Add documentation baseline and technical decisions.
3. Create Next.js TypeScript project scaffold.

### Phase 1: Core MVP implementation
1. Auth (login/logout).
2. Board/module/card CRUD.
3. Drag-and-drop with persistence.
4. UI polish for clean visual experience.

### Phase 2: Planning enhancements
1. Calendar/timeline view (week targeting).
2. CSV export first, then import.
3. Better filtering and reporting slices.

## 14. Definition of Done for MVP
1. User can login and manage at least one board end-to-end.
2. Cards can be created, edited, dragged, and persisted correctly.
3. Module names editable inline.
4. Lanes clearly represented and enforced.
5. UI is polished and consistent across modern desktop browsers.
6. Basic test coverage exists for critical APIs and move logic.

## 15. Git and Delivery Cadence
1. Commit often in small, meaningful units.
2. Suggested commit prefixes:
- `docs:`
- `feat:`
- `fix:`
- `refactor:`
- `chore:`
3. Keep `main` always deployable.

## 16. Immediate Next Build Step
Implement the MVP in this order:
1. Initialize Next.js + TypeScript + Tailwind + Prisma/SQLite.
2. Add auth and protected app shell.
3. Build board UI with modules/lanes.
4. Implement drag-and-drop and transactional move API.
5. Add editing panel and filters.
6. Polish visual system to match the Whisperit-inspired design language.
