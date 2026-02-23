# User Story Mapping

A production-ready MVP for visual user story mapping built with Next.js, TypeScript, SQLite, Prisma, and `dnd-kit`.

## What is implemented

- Simple email/password auth with secure cookie sessions
- Board list and creation flow
- Story mapping board with editable modules (columns)
- Three priority lanes: `Skeleton`, `MVP`, `Lovable`
- Post-it style cards with fields:
  - `title`
  - `description`
  - `effort` (`xs|s|m|l|xl`)
  - `week_target` (`YYYY-Www`)
- Drag and drop across modules and lanes with transactional persistence
- Zoom controls and canvas panning (`Space + drag`)
- Search and filtering
- Optimistic UI + version conflict protection (`409` handling)
- API validation with Zod
- Move-logic tests with Vitest

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4 + custom design tokens
- Prisma ORM + SQLite
- `dnd-kit` for drag-and-drop

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Run migrations:

```bash
npm run db:migrate
```

4. Start dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Useful scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run db:migrate`
- `npm run db:push`

## Product blueprint

See `docs/PRODUCT_BLUEPRINT.md`.
