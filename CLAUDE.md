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

Public-facing app (Google Sheets):
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY` (with `\n` escaped newlines)
- `GOOGLE_SHEETS_ID`

Admin panel (Supabase + JWT):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_JWT_SECRET`

## Architecture

Next.js 15 App Router. No `src/` — code in `app/`, `components/`, `lib/`.

### Two separate apps in one repo

**Public booking flow** (`app/page.tsx`, `/api/turnos`):
- Reads availability from **Google Sheets** (`lib/google-sheets.ts` → `lib/turnos.ts`)
- `getTurnosDisponibles()` reads three tabs: `Libres`, `Turnos`, `Canchas`
- Returns `TurnosCanchas` — array of `Cancha` objects each with a `turnos` map keyed by `"dd/MM"`
- Client filters by sport type (`tipoFutbol` 1=Fútbol 5, 2=Fútbol 7)
- Booking ends with WhatsApp redirect (no server write — confirmation is manual)
- UI flow: `WelcomeScreen` → date picker → slot Dialog → name Dialog → WhatsApp

**Admin panel** (`app/admin/`, `/api/admin/*`):
- Reads/writes **Supabase** (all CRUD goes through `lib/supabase/server.ts` with `SUPABASE_SERVICE_ROLE_KEY`)
- Auth: JWT cookie (`admin_session`, 12h) via `lib/auth.ts` (jose) — not Supabase auth
- Protected routes live under `app/admin/(protected)/` — layout checks `getSession()` and redirects to `/admin/login` if missing
- Admin roles: `"admin"` | `"superadmin"` (stored in JWT payload and DB)

### Supabase schema (key tables)

`canchas`, `turnos`, `tipos_cancha`, `espacios`, `clientes`, `reservas`, `reservas_recurrentes`, `eventos`, `admins`, `precio_reglas`, `datos_bancarios`, `disponibilidad_canchas`, `disponibilidad_overrides`

### Pricing logic (`lib/precio-reglas.ts`)

`resolvePrecio()` picks the best matching `PrecioRegla` for a slot:
- Filters by `tipo_cancha_id`, active, `vigente_desde ≤ fecha`, time window, day-of-week
- Specific `dias_semana` wins over `null` (all days); then most recent `vigente_desde` wins

### Admin grilla (`app/admin/(protected)/grilla/`)

Server-side view of all slots for a date. Uses Supabase RPC `fn_cancha_disponible` to determine slot availability. `SlotGrilla` type is the cell model.

### Recurring reservations

`es_fijo=true` on POST `/api/admin/reservas` creates a `reservas_recurrentes` row first, then links each individual `reservas` row via `recurrente_id`. Recurring reservations are auto-confirmed (`estado="confirmada"`).

### Key types (`lib/types.ts`)

`Turno`, `Cancha`, `TipoCancha`, `Reserva`, `ReservaEstado`, `Cliente`, `Admin`, `PrecioRegla`, `SlotGrilla`, `DisponibilidadCancha`, `DisponibilidadOverride`

### UI

shadcn/ui components in `components/ui/` + Radix UI primitives + Tailwind CSS v4. Admin components in `components/admin/`. Notifications via `sonner` (`<Toaster />`).

**Static data:** `lib/avisos.ts` — hardcoded notices shown as Dialog on Fútbol 5 entry.
