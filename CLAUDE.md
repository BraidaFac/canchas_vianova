# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server with Turbopack
npm run build     # Production build
npm run lint      # ESLint
```

No test suite configured.

## Environment Variables

Required in `.env` for Google Sheets integration:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY` (with `\n` escaped newlines)
- `GOOGLE_SHEETS_ID`

## Architecture

Single-page Next.js 15 app (App Router). No `src/` directory — code lives in `app/`, `components/`, `lib/`.

**Data flow:**
1. On mount, `app/page.tsx` fetches `/api/turnos` (GET)
2. `app/api/turnos/route.ts` calls `lib/turnos.ts → getTurnosDisponibles()`
3. `lib/turnos.ts` reads three Google Sheets tabs: `Libres`, `Turnos`, `Canchas` via `lib/google-sheets.ts`
4. Returns `TurnosCanchas` — array of `Cancha` objects, each with a `turnos` map keyed by date string `"dd/MM"`
5. Client filters by `tipoFutbol` (1 = Fútbol 5, 2 = Fútbol 7) using `mapCanchas` constant in `page.tsx`

**Cancha ID mapping** (hardcoded in `page.tsx`):
- Fútbol 5 → cancha IDs `[3, 4, 5]`
- Fútbol 7 → cancha IDs `[1, 2]`

**UI flow:** `WelcomeScreen` (sport type selection) → calendar date picker → Dialog showing available slots → Dialog for name input → WhatsApp redirect with pre-filled message.

**Key types** (`lib/turnos.ts`): `Turno`, `Cancha`, `TurnosCanchas`

**Static data:** `lib/avisos.ts` — hardcoded notices shown as Dialog on Fútbol 5 entry.

**UI components:** shadcn/ui pattern in `components/ui/` (button, dialog, calendar, etc.) + Radix UI primitives + Tailwind CSS v4.
