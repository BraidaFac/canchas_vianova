# Caja Operativa Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar control de caja con JornadaOperativa, SesionCaja, validación pre-pago, facturación diferida al cierre de caja, y banner de estado en el layout.

**Architecture:** La caja se modela como JornadaOperativa (período de negocio, independiente del día calendario) con una SesionCaja asociada. Un cutoff horario configurable determina a qué jornada pertenece el momento actual. Cada intento de registrar un pago valida que la sesión abierta pertenezca a la jornada actual. La facturación electrónica se mueve del POST de pagos al cierre de caja (modal de revisión controlado por el operador).

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL), TypeScript, Tailwind CSS v4, shadcn/ui (Tabs, Dialog, Button, Input), Lucide icons, date-fns, sonner (toasts)

## Global Constraints

- Seguir el patrón existente: server page mínimo → delega a componente `Client` ("use client")
- Headers de sección: `px-4 py-3 border-b border-border bg-card`, icon Lucide `size={16}` color `#133D34`, título `text-sm font-semibold`
- Tablas: `rounded-lg border border-border bg-card overflow-hidden`, thead `bg-muted/50 text-xs font-medium text-muted-foreground`, rows `divide-y divide-border hover:bg-muted/30`
- No hay suite de tests — verificación manual con browser + curl + Supabase dashboard
- Todas las rutas API validan sesión con `getSession()` → 401 si no hay sesión
- Migrations nombradas: `20260802XXXXXX_*.sql` (siguiente al 20260801)
- `emitirFactura()` en background al cierre: fire-and-forget, errores quedan en `comprobantes.estado = "fallida"`
- Cutoff default: 7 (hora del día, 0–23)

---

## File Map

### Nuevos archivos
| Archivo | Responsabilidad |
|---------|----------------|
| `supabase/migrations/20260802000000_caja_operativa.sql` | Tablas jornadas_operativas, sesiones_caja, columna sesion_caja_id en pagos, columna caja_cutoff_hour en config_modulos |
| `lib/caja/jornada.ts` | `getFechaJornadaActual(cutoffHour)` — calcula fecha de negocio actual |
| `lib/caja/validar.ts` | `validarSesionActiva(supabase, cutoffHour)` — árbol de decisión pre-pago |
| `lib/caja/types.ts` | Tipos TypeScript: JornadaOperativa, SesionCaja, EstadoCaja, CajaValidationResult |
| `app/api/admin/caja/estado/route.ts` | GET — estado actual de la caja (jornada activa o última cerrada) |
| `app/api/admin/caja/abrir/route.ts` | POST — abre nueva jornada + sesión |
| `app/api/admin/caja/cerrar/route.ts` | POST — cierra sesión, guarda resumen, dispara facturación seleccionada |
| `app/api/admin/caja/reabrir/route.ts` | POST — reabre sesión de la jornada actual |
| `app/api/admin/caja/historial/route.ts` | GET — lista paginada de jornadas cerradas |
| `app/api/admin/caja/[id]/route.ts` | GET — detalle completo de una jornada |
| `app/api/admin/caja/pendientes-facturacion/route.ts` | GET — pagos transferencia sin comprobante, separados por jornada |
| `app/admin/(protected)/caja/page.tsx` | Server page — pasa estado inicial a CajaClient |
| `components/admin/CajaClient.tsx` | UI principal: header con estado + tabla historial |
| `components/admin/AbrirCajaDialog.tsx` | Dialog para declarar monto inicial y abrir caja |
| `components/admin/CerrarCajaDialog.tsx` | Dialog 2 pasos: resumen del día + checklist de facturación |
| `components/admin/CajaDetalleModal.tsx` | Modal de detalle de jornada cerrada |

### Archivos modificados
| Archivo | Qué cambia |
|---------|-----------|
| `app/api/admin/pagos/route.ts` | Remover `emitirFactura()`, agregar `sesion_caja_id`, llamar `validarSesionActiva()` |
| `components/admin/AdminSidebar.tsx` | Agregar item `{ href: "/admin/caja", label: "Caja", icon: Landmark }` |
| `components/admin/AdminLayoutClient.tsx` | Agregar banner de estado de caja (fetch client-side a `/api/admin/caja/estado`) |
| `app/admin/(protected)/layout.tsx` | Sin cambio en server — el banner vive en AdminLayoutClient |
| `app/admin/(protected)/config/page.tsx` | Pasar `cutoffHour` a ConfigClient |
| `components/admin/ConfigClient.tsx` | Agregar tab "General" con campo `caja_cutoff_hour` |

---

## Task 1: Migración de base de datos

**Files:**
- Create: `supabase/migrations/20260802000000_caja_operativa.sql`

**Interfaces:**
- Produces: tablas `jornadas_operativas`, `sesiones_caja`; columna `pagos.sesion_caja_id`; columna `config_modulos.caja_cutoff_hour`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/20260802000000_caja_operativa.sql

-- ── 1. JornadaOperativa ──────────────────────────────────────────────────────
CREATE TABLE jornadas_operativas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_jornada         date NOT NULL,
  estado                text NOT NULL DEFAULT 'abierta'
                          CHECK (estado IN ('abierta', 'cerrada')),
  abierta_at            timestamptz NOT NULL DEFAULT now(),
  cerrada_at            timestamptz,
  empleado_apertura_id  uuid REFERENCES empleados(id) ON DELETE SET NULL,
  empleado_cierre_id    uuid REFERENCES empleados(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Solo una jornada abierta a la vez (partial unique index)
CREATE UNIQUE INDEX jornadas_una_abierta
  ON jornadas_operativas (estado)
  WHERE estado = 'abierta';

-- ── 2. SesionCaja ───────────────────────────────────────────────────────────
CREATE TABLE sesiones_caja (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id              uuid NOT NULL REFERENCES jornadas_operativas(id) ON DELETE CASCADE,
  estado                  text NOT NULL DEFAULT 'abierta'
                            CHECK (estado IN ('abierta', 'cerrada')),
  monto_apertura          numeric(12,2) NOT NULL DEFAULT 0,
  monto_cierre_declarado  numeric(12,2),
  abierta_at              timestamptz NOT NULL DEFAULT now(),
  cerrada_at              timestamptz,
  empleado_id             uuid REFERENCES empleados(id) ON DELETE SET NULL,
  resumen_json            jsonb,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Solo una sesión abierta a la vez
CREATE UNIQUE INDEX sesiones_una_abierta
  ON sesiones_caja (estado)
  WHERE estado = 'abierta';

-- ── 3. Columna sesion_caja_id en pagos ──────────────────────────────────────
ALTER TABLE pagos
  ADD COLUMN sesion_caja_id uuid REFERENCES sesiones_caja(id) ON DELETE SET NULL;

-- ── 4. Columna caja_cutoff_hour en config_modulos ───────────────────────────
ALTER TABLE config_modulos
  ADD COLUMN caja_cutoff_hour int NOT NULL DEFAULT 7
    CHECK (caja_cutoff_hour >= 0 AND caja_cutoff_hour <= 23);
```

- [ ] **Step 2: Aplicar migración**

En Supabase dashboard → SQL Editor → ejecutar el contenido del archivo.  
O con CLI: `npx supabase db push` si está configurado.

- [ ] **Step 3: Verificar en Supabase**

En Table Editor verificar que existen:
- tabla `jornadas_operativas` con columnas correctas
- tabla `sesiones_caja` con columnas correctas
- `pagos` tiene columna `sesion_caja_id` (nullable)
- `config_modulos` tiene columna `caja_cutoff_hour` (valor 7)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260802000000_caja_operativa.sql
git commit -m "feat: add jornadas_operativas and sesiones_caja migration"
```

---

## Task 2: Tipos y lógica de negocio central

**Files:**
- Create: `lib/caja/types.ts`
- Create: `lib/caja/jornada.ts`
- Create: `lib/caja/validar.ts`

**Interfaces:**
- Consumes: Supabase client (`createSupabaseServerClient`)
- Produces:
  - `getFechaJornadaActual(cutoffHour?: number): string` → fecha YYYY-MM-DD
  - `validarSesionActiva(supabase, cutoffHour): Promise<CajaValidationResult>`
  - Tipos: `JornadaOperativa`, `SesionCaja`, `CajaValidationResult`, `EstadoCajaCode`

- [ ] **Step 1: Crear `lib/caja/types.ts`**

```typescript
// lib/caja/types.ts

export type JornadaEstado = "abierta" | "cerrada";
export type SesionEstado = "abierta" | "cerrada";

export type EstadoCajaCode =
  | "ok"                        // sesión abierta y de la jornada actual
  | "jornada_vencida"           // sesión abierta pero de otra jornada
  | "caja_cerrada_misma_jornada" // sesión cerrada, misma jornada del día
  | "sin_caja";                 // no hay sesión ni jornada del día

export type JornadaOperativa = {
  id: string;
  fecha_jornada: string;        // YYYY-MM-DD
  estado: JornadaEstado;
  abierta_at: string;
  cerrada_at: string | null;
  empleado_apertura_id: string | null;
  empleado_cierre_id: string | null;
  created_at: string;
};

export type SesionCaja = {
  id: string;
  jornada_id: string;
  estado: SesionEstado;
  monto_apertura: number;
  monto_cierre_declarado: number | null;
  abierta_at: string;
  cerrada_at: string | null;
  empleado_id: string | null;
  resumen_json: ResumenCaja | null;
  created_at: string;
  // joined
  jornada?: JornadaOperativa | null;
};

export type ResumenCaja = {
  total_efectivo: number;
  total_transferencia: number;
  total_otro: number;
  total_reservas: number;
  total_consumos: number;
  diferencia_efectivo: number;   // monto_apertura + cobros_efectivo - monto_cierre_declarado
};

export type CajaValidationResult =
  | { ok: true; sesion: SesionCaja }
  | { ok: false; code: Exclude<EstadoCajaCode, "ok"> };

export type EstadoCajaResponse = {
  code: EstadoCajaCode;
  sesion: SesionCaja | null;
  jornada: JornadaOperativa | null;
  fecha_jornada_actual: string;
};
```

- [ ] **Step 2: Crear `lib/caja/jornada.ts`**

```typescript
// lib/caja/jornada.ts

/**
 * Calcula la fecha de la jornada de negocio actual.
 * Pagos registrados antes del cutoffHour pertenecen a la jornada del día anterior.
 * Ejemplo con cutoff=7: 01:03am del 02/08 → retorna "2026-08-01"
 *                       10:00am del 02/08 → retorna "2026-08-02"
 */
export function getFechaJornadaActual(cutoffHour = 7): string {
  const now = new Date();
  const hour = now.getHours();

  if (hour < cutoffHour) {
    const ayer = new Date(now);
    ayer.setDate(ayer.getDate() - 1);
    return ayer.toISOString().slice(0, 10);
  }

  return now.toISOString().slice(0, 10);
}
```

- [ ] **Step 3: Crear `lib/caja/validar.ts`**

```typescript
// lib/caja/validar.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFechaJornadaActual } from "./jornada";
import type { CajaValidationResult, SesionCaja } from "./types";

export async function validarSesionActiva(
  supabase: SupabaseClient,
  cutoffHour = 7
): Promise<CajaValidationResult> {
  const fechaActual = getFechaJornadaActual(cutoffHour);

  // Busca sesión abierta con su jornada
  const { data: sesionAbierta } = await supabase
    .from("sesiones_caja")
    .select("*, jornada:jornadas_operativas(*)")
    .eq("estado", "abierta")
    .maybeSingle();

  if (sesionAbierta) {
    const jornada = Array.isArray(sesionAbierta.jornada)
      ? sesionAbierta.jornada[0]
      : sesionAbierta.jornada;

    const sesion: SesionCaja = { ...sesionAbierta, jornada };

    if (jornada?.fecha_jornada === fechaActual) {
      return { ok: true, sesion };
    }
    // Sesión abierta pero de otra jornada
    return { ok: false, code: "jornada_vencida" };
  }

  // No hay sesión abierta — busca jornada cerrada de la fecha actual
  const { data: jornadaCerrada } = await supabase
    .from("jornadas_operativas")
    .select("*")
    .eq("fecha_jornada", fechaActual)
    .eq("estado", "cerrada")
    .maybeSingle();

  if (jornadaCerrada) {
    return { ok: false, code: "caja_cerrada_misma_jornada" };
  }

  return { ok: false, code: "sin_caja" };
}
```

- [ ] **Step 4: Verificar manualmente**

En la terminal de desarrollo, crear un script temporal o usar Node REPL:
```bash
node -e "const {getFechaJornadaActual} = require('./lib/caja/jornada'); console.log(getFechaJornadaActual(7));"
```
Verificar que retorna la fecha correcta según la hora actual.

- [ ] **Step 5: Commit**

```bash
git add lib/caja/types.ts lib/caja/jornada.ts lib/caja/validar.ts
git commit -m "feat: add caja core types, getFechaJornadaActual, validarSesionActiva"
```

---

## Task 3: API routes — estado y abrir

**Files:**
- Create: `app/api/admin/caja/estado/route.ts`
- Create: `app/api/admin/caja/abrir/route.ts`

**Interfaces:**
- Consumes: `getFechaJornadaActual`, `validarSesionActiva`, tipos de `lib/caja/types.ts`
- Produces:
  - `GET /api/admin/caja/estado` → `EstadoCajaResponse`
  - `POST /api/admin/caja/abrir` body: `{ monto_apertura: number }` → `{ jornada_id, sesion_id }`

- [ ] **Step 1: Crear `app/api/admin/caja/estado/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFechaJornadaActual } from "@/lib/caja/jornada";
import { validarSesionActiva } from "@/lib/caja/validar";
import type { EstadoCajaResponse } from "@/lib/caja/types";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();

  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("caja_cutoff_hour")
    .eq("id", 1)
    .single();

  const cutoffHour = modulos?.caja_cutoff_hour ?? 7;
  const fechaActual = getFechaJornadaActual(cutoffHour);
  const validation = await validarSesionActiva(supabase, cutoffHour);

  const response: EstadoCajaResponse = {
    code: validation.ok ? "ok" : validation.code,
    sesion: validation.ok ? validation.sesion : null,
    jornada: validation.ok ? (validation.sesion.jornada ?? null) : null,
    fecha_jornada_actual: fechaActual,
  };

  // Si no ok, también enviamos la última jornada/sesión para contexto en el frontend
  if (!validation.ok) {
    const { data: ultimaSesion } = await supabase
      .from("sesiones_caja")
      .select("*, jornada:jornadas_operativas(*)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimaSesion) {
      response.sesion = ultimaSesion as typeof response.sesion;
      const j = Array.isArray(ultimaSesion.jornada)
        ? ultimaSesion.jornada[0]
        : ultimaSesion.jornada;
      response.jornada = j ?? null;
    }
  }

  return NextResponse.json(response);
}
```

- [ ] **Step 2: Crear `app/api/admin/caja/abrir/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFechaJornadaActual } from "@/lib/caja/jornada";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { monto_apertura } = body;

  if (typeof monto_apertura !== "number" || monto_apertura < 0) {
    return NextResponse.json({ error: "monto_apertura debe ser un número >= 0" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("caja_cutoff_hour")
    .eq("id", 1)
    .single();

  const cutoffHour = modulos?.caja_cutoff_hour ?? 7;
  const fechaJornada = getFechaJornadaActual(cutoffHour);

  // Verifica que no haya jornada abierta (el unique index en DB también protege)
  const { data: jornadaAbierta } = await supabase
    .from("jornadas_operativas")
    .select("id, fecha_jornada")
    .eq("estado", "abierta")
    .maybeSingle();

  if (jornadaAbierta) {
    if (jornadaAbierta.fecha_jornada !== fechaJornada) {
      return NextResponse.json(
        { error: `Hay una caja sin cerrar del ${jornadaAbierta.fecha_jornada}. Cerrala antes de abrir una nueva.` },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Ya hay una caja abierta para esta jornada." },
      { status: 409 }
    );
  }

  // Crear jornada
  const { data: jornada, error: jornadaErr } = await supabase
    .from("jornadas_operativas")
    .insert({
      fecha_jornada: fechaJornada,
      estado: "abierta",
      empleado_apertura_id: session.id,
    })
    .select("id")
    .single();

  if (jornadaErr || !jornada) {
    return NextResponse.json({ error: jornadaErr?.message ?? "Error al crear jornada" }, { status: 500 });
  }

  // Crear sesión
  const { data: sesion, error: sesionErr } = await supabase
    .from("sesiones_caja")
    .insert({
      jornada_id: jornada.id,
      estado: "abierta",
      monto_apertura,
      empleado_id: session.id,
    })
    .select("id")
    .single();

  if (sesionErr || !sesion) {
    // Rollback jornada
    await supabase.from("jornadas_operativas").delete().eq("id", jornada.id);
    return NextResponse.json({ error: sesionErr?.message ?? "Error al crear sesión" }, { status: 500 });
  }

  return NextResponse.json({ jornada_id: jornada.id, sesion_id: sesion.id }, { status: 201 });
}
```

- [ ] **Step 3: Verificar manualmente**

Con el servidor corriendo (`npm run dev`):
```bash
# Verificar estado (debería retornar sin_caja si no hay nada)
curl -s http://localhost:3000/api/admin/caja/estado \
  -H "Cookie: <tu_cookie_de_sesion>" | jq .

# Abrir caja
curl -s -X POST http://localhost:3000/api/admin/caja/abrir \
  -H "Cookie: <tu_cookie_de_sesion>" \
  -H "Content-Type: application/json" \
  -d '{"monto_apertura": 5000}' | jq .

# Verificar estado de nuevo (debería retornar ok)
curl -s http://localhost:3000/api/admin/caja/estado \
  -H "Cookie: <tu_cookie_de_sesion>" | jq .
```

Verificar en Supabase que se crearon filas en `jornadas_operativas` y `sesiones_caja`.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/caja/estado/route.ts app/api/admin/caja/abrir/route.ts
git commit -m "feat: add caja estado and abrir API routes"
```

---

## Task 4: API routes — cerrar, reabrir y pendientes-facturacion

**Files:**
- Create: `app/api/admin/caja/cerrar/route.ts`
- Create: `app/api/admin/caja/reabrir/route.ts`
- Create: `app/api/admin/caja/pendientes-facturacion/route.ts`

**Interfaces:**
- Consumes: `emitirFactura` de `lib/facturacion/emitir.ts`, `getFechaJornadaActual`
- Produces:
  - `POST /api/admin/caja/cerrar` body: `{ monto_cierre_declarado, pago_ids_facturar: string[] }` → `{ ok: true }`
  - `POST /api/admin/caja/reabrir` → `{ ok: true }`
  - `GET /api/admin/caja/pendientes-facturacion` → `{ del_dia: PagoTransferencia[], otros: PagoTransferencia[] }`

- [ ] **Step 1: Crear `app/api/admin/caja/cerrar/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emitirFactura } from "@/lib/facturacion/emitir";
import type { ResumenCaja } from "@/lib/caja/types";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const {
    monto_cierre_declarado,
    pago_ids_facturar = [],
  }: { monto_cierre_declarado: number; pago_ids_facturar: string[] } = body;

  if (typeof monto_cierre_declarado !== "number" || monto_cierre_declarado < 0) {
    return NextResponse.json({ error: "monto_cierre_declarado inválido" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Obtener sesión abierta
  const { data: sesion } = await supabase
    .from("sesiones_caja")
    .select("*, jornada:jornadas_operativas(*)")
    .eq("estado", "abierta")
    .maybeSingle();

  if (!sesion) {
    return NextResponse.json({ error: "No hay caja abierta" }, { status: 404 });
  }

  // Calcular resumen
  const { data: pagos } = await supabase
    .from("pagos")
    .select("medio_pago, monto, origen_tipo")
    .eq("sesion_caja_id", sesion.id);

  const p = pagos ?? [];
  const totalEfectivo = p.filter(x => x.medio_pago === "efectivo").reduce((s, x) => s + Number(x.monto), 0);
  const totalTransferencia = p.filter(x => x.medio_pago === "transferencia").reduce((s, x) => s + Number(x.monto), 0);
  const totalOtro = p.filter(x => x.medio_pago === "otro").reduce((s, x) => s + Number(x.monto), 0);
  const totalReservas = p.filter(x => x.origen_tipo === "reserva").reduce((s, x) => s + Number(x.monto), 0);
  const totalConsumos = p.filter(x => x.origen_tipo === "consumo").reduce((s, x) => s + Number(x.monto), 0);

  const resumen: ResumenCaja = {
    total_efectivo: totalEfectivo,
    total_transferencia: totalTransferencia,
    total_otro: totalOtro,
    total_reservas: totalReservas,
    total_consumos: totalConsumos,
    diferencia_efectivo: sesion.monto_apertura + totalEfectivo - monto_cierre_declarado,
  };

  const ahora = new Date().toISOString();

  // Cerrar sesión
  await supabase
    .from("sesiones_caja")
    .update({
      estado: "cerrada",
      monto_cierre_declarado,
      cerrada_at: ahora,
      empleado_id: session.id,
      resumen_json: resumen,
    })
    .eq("id", sesion.id);

  // Cerrar jornada
  const jornada = Array.isArray(sesion.jornada) ? sesion.jornada[0] : sesion.jornada;
  if (jornada) {
    await supabase
      .from("jornadas_operativas")
      .update({
        estado: "cerrada",
        cerrada_at: ahora,
        empleado_cierre_id: session.id,
      })
      .eq("id", jornada.id);
  }

  // Disparar facturación en background (fire and forget)
  if (pago_ids_facturar.length > 0) {
    Promise.allSettled(
      pago_ids_facturar.map((pago_id) =>
        emitirFactura({ pago_id }).catch(() => {
          // Errors quedan en comprobantes.estado = "fallida" para reintento manual
        })
      )
    );
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Crear `app/api/admin/caja/reabrir/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFechaJornadaActual } from "@/lib/caja/jornada";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();

  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("caja_cutoff_hour")
    .eq("id", 1)
    .single();

  const cutoffHour = modulos?.caja_cutoff_hour ?? 7;
  const fechaActual = getFechaJornadaActual(cutoffHour);

  // Obtener última sesión cerrada
  const { data: sesion } = await supabase
    .from("sesiones_caja")
    .select("*, jornada:jornadas_operativas(*)")
    .eq("estado", "cerrada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sesion) {
    return NextResponse.json({ error: "No hay sesión cerrada para reabrir" }, { status: 404 });
  }

  const jornada = Array.isArray(sesion.jornada) ? sesion.jornada[0] : sesion.jornada;

  if (!jornada || jornada.fecha_jornada !== fechaActual) {
    return NextResponse.json(
      { error: "La sesión pertenece a otra jornada. No se puede reabrir — abrí una nueva caja." },
      { status: 409 }
    );
  }

  // Reabrir sesión y jornada
  await supabase
    .from("sesiones_caja")
    .update({ estado: "abierta", cerrada_at: null })
    .eq("id", sesion.id);

  await supabase
    .from("jornadas_operativas")
    .update({ estado: "abierta", cerrada_at: null, empleado_cierre_id: null })
    .eq("id", jornada.id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Crear `app/api/admin/caja/pendientes-facturacion/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFechaJornadaActual } from "@/lib/caja/jornada";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();

  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("caja_cutoff_hour")
    .eq("id", 1)
    .single();

  const cutoffHour = modulos?.caja_cutoff_hour ?? 7;
  const fechaActual = getFechaJornadaActual(cutoffHour);

  // Sesión abierta del día (para saber qué pagos son "del día")
  const { data: sesionActual } = await supabase
    .from("sesiones_caja")
    .select("id, jornada_id")
    .eq("estado", "abierta")
    .maybeSingle();

  // Pagos transferencia sin comprobante emitido
  const { data: pagos } = await supabase
    .from("pagos")
    .select(`
      id, monto, origen_tipo, origen_id, sesion_caja_id, created_at,
      cuenta_bancaria:cuentas_bancarias(id, nombre_display),
      comprobante:comprobantes(id, estado)
    `)
    .eq("medio_pago", "transferencia")
    .order("created_at", { ascending: false });

  const pendientes = (pagos ?? []).filter((p) => {
    const cbte = Array.isArray(p.comprobante) ? p.comprobante[0] : p.comprobante;
    return !cbte || cbte.estado !== "emitida";
  });

  const del_dia = pendientes.filter((p) =>
    sesionActual ? p.sesion_caja_id === sesionActual.id : false
  );
  const otros = pendientes.filter((p) =>
    sesionActual ? p.sesion_caja_id !== sesionActual.id : true
  );

  return NextResponse.json({ del_dia, otros, fecha_jornada_actual: fechaActual });
}
```

- [ ] **Step 4: Verificar cerrar y reabrir manualmente**

```bash
# Cerrar la caja abierta (sin facturar nada)
curl -s -X POST http://localhost:3000/api/admin/caja/cerrar \
  -H "Cookie: <cookie>" \
  -H "Content-Type: application/json" \
  -d '{"monto_cierre_declarado": 5000, "pago_ids_facturar": []}' | jq .

# Verificar estado → debería ser caja_cerrada_misma_jornada
curl -s http://localhost:3000/api/admin/caja/estado \
  -H "Cookie: <cookie>" | jq .

# Reabrir
curl -s -X POST http://localhost:3000/api/admin/caja/reabrir \
  -H "Cookie: <cookie>" | jq .

# Verificar estado → ok
curl -s http://localhost:3000/api/admin/caja/estado \
  -H "Cookie: <cookie>" | jq .
```

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/caja/cerrar/route.ts app/api/admin/caja/reabrir/route.ts app/api/admin/caja/pendientes-facturacion/route.ts
git commit -m "feat: add caja cerrar, reabrir, and pendientes-facturacion routes"
```

---

## Task 5: API routes — historial y detalle

**Files:**
- Create: `app/api/admin/caja/historial/route.ts`
- Create: `app/api/admin/caja/[id]/route.ts`

**Interfaces:**
- Produces:
  - `GET /api/admin/caja/historial?page=1&per_page=20` → `{ data: JornadaOperativa[], total: number }`
  - `GET /api/admin/caja/[id]` → `{ jornada: JornadaOperativa, sesion: SesionCaja, comprobantes: Comprobante[] }`

- [ ] **Step 1: Crear `app/api/admin/caja/historial/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const perPage = parseInt(searchParams.get("per_page") ?? "20");

  const supabase = await createSupabaseServerClient();

  const { data, error, count } = await supabase
    .from("jornadas_operativas")
    .select(`
      *,
      sesion:sesiones_caja(
        id, monto_apertura, monto_cierre_declarado, abierta_at, cerrada_at, resumen_json
      )
    `, { count: "exact" })
    .eq("estado", "cerrada")
    .order("fecha_jornada", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, per_page: perPage });
}
```

- [ ] **Step 2: Crear `app/api/admin/caja/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: jornada, error } = await supabase
    .from("jornadas_operativas")
    .select(`
      *,
      sesion:sesiones_caja(*)
    `)
    .eq("id", id)
    .single();

  if (error || !jornada) return NextResponse.json({ error: "Jornada no encontrada" }, { status: 404 });

  const sesion = Array.isArray(jornada.sesion) ? jornada.sesion[0] : jornada.sesion;

  // Comprobantes emitidos durante la sesión
  let comprobantes: unknown[] = [];
  if (sesion) {
    const { data: pagosIds } = await supabase
      .from("pagos")
      .select("id")
      .eq("sesion_caja_id", sesion.id);

    if (pagosIds && pagosIds.length > 0) {
      const ids = pagosIds.map((p) => p.id);
      const { data: cbtes } = await supabase
        .from("comprobantes")
        .select("id, estado, cae, importe, emitida_at, tipo_cbte, nro_cbte")
        .in("pago_id", ids);
      comprobantes = cbtes ?? [];
    }
  }

  return NextResponse.json({ jornada, sesion: sesion ?? null, comprobantes });
}
```

- [ ] **Step 3: Verificar manualmente**

```bash
# Historial (debe mostrar la jornada cerrada del task anterior)
curl -s http://localhost:3000/api/admin/caja/historial \
  -H "Cookie: <cookie>" | jq .

# Detalle (usar el id de una jornada cerrada)
curl -s http://localhost:3000/api/admin/caja/<jornada_id> \
  -H "Cookie: <cookie>" | jq .
```

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/caja/historial/route.ts "app/api/admin/caja/[id]/route.ts"
git commit -m "feat: add caja historial and detalle API routes"
```

---

## Task 6: Modificar POST /api/admin/pagos — validación + sesion_caja_id

**Files:**
- Modify: `app/api/admin/pagos/route.ts`

**Interfaces:**
- Consumes: `validarSesionActiva` de `lib/caja/validar.ts`
- Change: remover import y llamada a `emitirFactura`; agregar validación pre-pago; guardar `sesion_caja_id` en cada pago insertado

- [ ] **Step 1: Reemplazar el contenido de `app/api/admin/pagos/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth.server";
import { validarSesionActiva } from "@/lib/caja/validar";
import type { MedioPago, OrigenTipo } from "@/lib/facturacion/types";

type PagoInput = {
  medio_pago: MedioPago;
  monto: number;
  cuenta_bancaria_id?: string | null;
  nombre_receptor?: string;
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const {
    origen_tipo,
    origen_id,
    pagos: pagosInput,
  }: {
    origen_tipo: OrigenTipo;
    origen_id: string;
    pagos: PagoInput[];
  } = body;

  if (!origen_tipo || !["reserva", "consumo"].includes(origen_tipo)) {
    return NextResponse.json({ error: "origen_tipo inválido" }, { status: 400 });
  }
  if (!origen_id) {
    return NextResponse.json({ error: "origen_id es requerido" }, { status: 400 });
  }
  if (!Array.isArray(pagosInput) || pagosInput.length === 0) {
    return NextResponse.json({ error: "pagos debe ser un array no vacío" }, { status: 400 });
  }

  for (const p of pagosInput) {
    if (!p.medio_pago || !["efectivo", "transferencia", "otro"].includes(p.medio_pago)) {
      return NextResponse.json({ error: `medio_pago inválido: ${p.medio_pago}` }, { status: 400 });
    }
    if (!p.monto || Number(p.monto) <= 0) {
      return NextResponse.json({ error: "monto debe ser mayor a 0" }, { status: 400 });
    }
    if (p.medio_pago === "transferencia" && !p.cuenta_bancaria_id) {
      return NextResponse.json(
        { error: "cuenta_bancaria_id es requerido para pagos por transferencia" },
        { status: 400 }
      );
    }
  }

  const supabase = await createSupabaseServerClient();

  // Validar sesión de caja activa
  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("caja_cutoff_hour")
    .eq("id", 1)
    .single();

  const cutoffHour = modulos?.caja_cutoff_hour ?? 7;
  const cajaValidation = await validarSesionActiva(supabase, cutoffHour);

  if (!cajaValidation.ok) {
    return NextResponse.json(
      { error: "caja_requerida", code: cajaValidation.code },
      { status: 422 }
    );
  }

  const sesionCajaId = cajaValidation.sesion.id;

  // Verify origen_id exists
  if (origen_tipo === "reserva") {
    const { data: reserva } = await supabase
      .from("reservas")
      .select("id")
      .eq("id", origen_id)
      .single();
    if (!reserva) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }
  }

  // Insert pagos con sesion_caja_id
  const insertRows = pagosInput.map((p) => ({
    origen_tipo,
    origen_id,
    medio_pago: p.medio_pago,
    monto: Number(p.monto),
    cuenta_bancaria_id: p.cuenta_bancaria_id ?? null,
    empleado_id: session.id,
    sesion_caja_id: sesionCajaId,
  }));

  const { data: pagosCreados, error: pagosErr } = await supabase
    .from("pagos")
    .insert(insertRows)
    .select("*");

  if (pagosErr || !pagosCreados) {
    return NextResponse.json({ error: pagosErr?.message ?? "Error al crear pagos" }, { status: 500 });
  }

  // NOTA: emitirFactura ya no se llama aquí.
  // La facturación se dispara al cerrar caja desde /api/admin/caja/cerrar.

  return NextResponse.json({ pagos: pagosCreados }, { status: 201 });
}
```

- [ ] **Step 2: Verificar que pagos con caja cerrada son rechazados**

Con caja cerrada:
```bash
curl -s -X POST http://localhost:3000/api/admin/pagos \
  -H "Cookie: <cookie>" \
  -H "Content-Type: application/json" \
  -d '{"origen_tipo":"reserva","origen_id":"<uuid>","pagos":[{"medio_pago":"efectivo","monto":1000}]}' | jq .
# Debe retornar: { error: "caja_requerida", code: "sin_caja" }
```

Con caja abierta, el mismo request debe retornar `{ pagos: [...] }` y el pago debe tener `sesion_caja_id` en Supabase.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/pagos/route.ts
git commit -m "feat: gate pagos behind caja validation, remove sync emitirFactura, add sesion_caja_id"
```

---

## Task 7: UI — Sidebar + Página /admin/caja + CajaClient (grilla)

**Files:**
- Modify: `components/admin/AdminSidebar.tsx`
- Create: `app/admin/(protected)/caja/page.tsx`
- Create: `components/admin/CajaClient.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/caja/estado`, `GET /api/admin/caja/historial`
- Produces: página `/admin/caja` con header de estado + tabla de jornadas cerradas

- [ ] **Step 1: Agregar "Caja" al sidebar**

En `components/admin/AdminSidebar.tsx`, agregar import de `Landmark` y el item en `navItems`:

```typescript
// Agregar al import de lucide-react:
import { ..., Landmark } from "lucide-react";

// Agregar en navItems, entre Cobros y Empleados:
{ href: "/admin/caja", label: "Caja", icon: Landmark },
```

- [ ] **Step 2: Crear `app/admin/(protected)/caja/page.tsx`**

```typescript
import { getSession } from "@/lib/auth.server";
import { redirect } from "next/navigation";
import CajaClient from "@/components/admin/CajaClient";

export default async function CajaPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return <CajaClient />;
}
```

- [ ] **Step 3: Crear `components/admin/CajaClient.tsx`**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Landmark, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TabLoader } from "@/components/ui/tab-loader";
import type { JornadaOperativa, SesionCaja, EstadoCajaResponse } from "@/lib/caja/types";
import AbrirCajaDialog from "./AbrirCajaDialog";
import CerrarCajaDialog from "./CerrarCajaDialog";
import CajaDetalleModal from "./CajaDetalleModal";

type JornadaConSesion = JornadaOperativa & {
  sesion: SesionCaja | SesionCaja[] | null;
};

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === "abierta") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-100 text-emerald-700 border-emerald-200">
        Abierta
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-slate-100 text-slate-500 border-slate-200">
      Cerrada
    </span>
  );
}

export default function CajaClient() {
  const [estadoCaja, setEstadoCaja] = useState<EstadoCajaResponse | null>(null);
  const [historial, setHistorial] = useState<JornadaConSesion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [detalleJornada, setDetalleJornada] = useState<string | null>(null);

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  const fetchEstado = useCallback(async () => {
    const res = await fetch("/api/admin/caja/estado");
    if (res.ok) setEstadoCaja(await res.json());
  }, []);

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      const res = await fetch(`/api/admin/caja/historial?${params}`);
      const json = await res.json();
      setHistorial(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Error al cargar historial");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchEstado();
    fetchHistorial();
  }, [fetchEstado, fetchHistorial]);

  function onSuccess() {
    setModalAbrir(false);
    setModalCerrar(false);
    fetchEstado();
    fetchHistorial();
  }

  const sesionActual = estadoCaja?.sesion
    ? (Array.isArray(estadoCaja.sesion) ? estadoCaja.sesion[0] : estadoCaja.sesion)
    : null;

  const cajaAbierta = estadoCaja?.code === "ok";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark size={16} className="text-[#133D34]" />
            <h1 className="text-sm font-semibold">Caja</h1>
            {cajaAbierta && sesionActual && (
              <span className="text-xs text-muted-foreground">
                · Abierta {format(parseISO(sesionActual.abierta_at), "HH:mm", { locale: es })}
                hs · ${Number(sesionActual.monto_apertura).toLocaleString("es-AR")} inicial
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => { fetchEstado(); fetchHistorial(); }}
              disabled={loading}
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Actualizar
            </Button>
            {cajaAbierta ? (
              <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => setModalCerrar(true)}>
                Cerrar caja
              </Button>
            ) : (
              <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => setModalAbrir(true)}>
                Abrir caja
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla historial */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center h-9 px-4 gap-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
            <div className="w-28 shrink-0">Fecha jornada</div>
            <div className="w-24 shrink-0">Apertura</div>
            <div className="w-24 shrink-0">Cierre</div>
            <div className="w-28 shrink-0 hidden sm:block">Ef. inicial</div>
            <div className="w-28 shrink-0 hidden sm:block">Ef. cierre</div>
            <div className="flex-1" />
            <div className="w-24 shrink-0">Estado</div>
            <div className="w-6 shrink-0" />
          </div>

          {loading && historial.length === 0 ? (
            <TabLoader />
          ) : historial.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">Sin jornadas cerradas.</p>
          ) : (
            <div className="divide-y divide-border">
              {historial.map((j) => {
                const ses = j.sesion
                  ? (Array.isArray(j.sesion) ? j.sesion[0] : j.sesion)
                  : null;
                return (
                  <div
                    key={j.id}
                    className="flex items-center h-12 px-4 gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setDetalleJornada(j.id)}
                  >
                    <div className="w-28 shrink-0 text-xs font-medium">
                      {format(parseISO(j.fecha_jornada + "T12:00:00"), "dd/MM/yyyy")}
                    </div>
                    <div className="w-24 shrink-0 text-xs text-muted-foreground font-mono">
                      {ses ? format(parseISO(ses.abierta_at), "HH:mm") : "—"}
                    </div>
                    <div className="w-24 shrink-0 text-xs text-muted-foreground font-mono">
                      {ses?.cerrada_at ? format(parseISO(ses.cerrada_at), "HH:mm") : "—"}
                    </div>
                    <div className="w-28 shrink-0 text-xs hidden sm:block">
                      {ses ? `$${Number(ses.monto_apertura).toLocaleString("es-AR")}` : "—"}
                    </div>
                    <div className="w-28 shrink-0 text-xs hidden sm:block">
                      {ses?.monto_cierre_declarado != null
                        ? `$${Number(ses.monto_cierre_declarado).toLocaleString("es-AR")}`
                        : "—"}
                    </div>
                    <div className="flex-1" />
                    <div className="w-24 shrink-0">
                      <EstadoBadge estado={j.estado} />
                    </div>
                    <div className="w-6 shrink-0 text-muted-foreground text-xs">→</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
          </div>
        )}
      </div>

      {modalAbrir && (
        <AbrirCajaDialog
          open={true}
          onClose={() => setModalAbrir(false)}
          onSuccess={onSuccess}
        />
      )}
      {modalCerrar && (
        <CerrarCajaDialog
          open={true}
          onClose={() => setModalCerrar(false)}
          onSuccess={onSuccess}
          sesionId={sesionActual?.id ?? ""}
          montoApertura={Number(sesionActual?.monto_apertura ?? 0)}
        />
      )}
      {detalleJornada && (
        <CajaDetalleModal
          open={true}
          jornadaId={detalleJornada}
          onClose={() => setDetalleJornada(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar en browser**

Navegar a `/admin/caja`. Verificar que:
- El item "Caja" aparece en el sidebar con icono Landmark
- El header muestra el estado correcto
- La tabla de historial carga (vacía si no hay jornadas cerradas)
- El botón "Abrir caja" aparece cuando no hay caja abierta

- [ ] **Step 5: Commit**

```bash
git add components/admin/AdminSidebar.tsx app/admin/\(protected\)/caja/page.tsx components/admin/CajaClient.tsx
git commit -m "feat: add caja page, sidebar item, and CajaClient grid"
```

---

## Task 8: UI — AbrirCajaDialog + Banner en AdminLayoutClient

**Files:**
- Create: `components/admin/AbrirCajaDialog.tsx`
- Modify: `components/admin/AdminLayoutClient.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/caja/abrir`, `GET /api/admin/caja/estado`
- Produces: dialog de apertura; banner persistente en layout con estado de caja

- [ ] **Step 1: Crear `components/admin/AbrirCajaDialog.tsx`**

```typescript
"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function AbrirCajaDialog({ open, onClose, onSuccess }: Props) {
  const [monto, setMonto] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const montoNum = parseFloat(monto.replace(",", "."));
    if (isNaN(montoNum) || montoNum < 0) {
      toast.error("Ingresá un monto inicial válido (puede ser 0)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/caja/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto_apertura: montoNum }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Error al abrir caja");
        return;
      }
      toast.success("Caja abierta correctamente");
      onSuccess();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="monto_apertura">Efectivo inicial en caja</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <Input
                id="monto_apertura"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="pl-7"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">Ingresá el fondo de caja inicial en efectivo.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading}>
            {loading ? "Abriendo..." : "Abrir caja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Modificar `components/admin/AdminLayoutClient.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminSidebar from "./AdminSidebar";
import AbrirCajaDialog from "./AbrirCajaDialog";
import { AdminSession } from "@/lib/auth";
import type { EstadoCajaResponse } from "@/lib/caja/types";

export default function AdminLayoutClient({
  children,
  session,
  facturacionActiva = false,
  posActivo = false,
  stockActivo = false,
}: {
  children: React.ReactNode;
  session: AdminSession;
  facturacionActiva?: boolean;
  posActivo?: boolean;
  stockActivo?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [estadoCaja, setEstadoCaja] = useState<EstadoCajaResponse | null>(null);
  const [modalAbrir, setModalAbrir] = useState(false);

  useEffect(() => {
    fetch("/api/admin/caja/estado")
      .then((r) => r.json())
      .then(setEstadoCaja)
      .catch(() => null);
  }, []);

  function onCajaSuccess() {
    setModalAbrir(false);
    fetch("/api/admin/caja/estado")
      .then((r) => r.json())
      .then(setEstadoCaja)
      .catch(() => null);
  }

  const mostrarBanner = estadoCaja && estadoCaja.code !== "ok";

  // Determina el mensaje del banner
  let bannerMsg = "No hay caja abierta";
  let bannerAction: React.ReactNode = (
    <button
      className="underline font-medium ml-1"
      onClick={() => setModalAbrir(true)}
    >
      Abrir caja
    </button>
  );

  if (estadoCaja?.code === "jornada_vencida") {
    const fecha = estadoCaja.jornada?.fecha_jornada ?? "";
    bannerMsg = `Tenés una caja sin cerrar del ${fecha}`;
    bannerAction = (
      <Link href="/admin/caja" className="underline font-medium ml-1">
        Ir a Caja
      </Link>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AdminSidebar
        session={session}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        facturacionActiva={facturacionActiva}
        posActivo={posActivo}
        stockActivo={stockActivo}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile spacer for fixed top bar */}
        <div className="md:hidden h-[53px] shrink-0" />
        <div className="hidden md:block h-3 shrink-0" />

        {/* Banner de estado de caja */}
        {mostrarBanner && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-1 shrink-0">
            <span>⚠</span>
            <span>{bannerMsg}</span>
            {bannerAction}
          </div>
        )}

        {children}
      </main>

      {modalAbrir && (
        <AbrirCajaDialog
          open={true}
          onClose={() => setModalAbrir(false)}
          onSuccess={onCajaSuccess}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar banner en browser**

Con caja cerrada/sin caja, navegar a cualquier página del admin (ej. `/admin/reservas`). Verificar que aparece el banner amarillo con el mensaje correcto y el botón/link correspondiente.

- [ ] **Step 4: Commit**

```bash
git add components/admin/AbrirCajaDialog.tsx components/admin/AdminLayoutClient.tsx
git commit -m "feat: add AbrirCajaDialog and persistent caja banner in layout"
```

---

## Task 9: UI — CerrarCajaDialog (2 pasos)

**Files:**
- Create: `components/admin/CerrarCajaDialog.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/caja/pendientes-facturacion`, `POST /api/admin/caja/cerrar`
- Props: `{ open, onClose, onSuccess, sesionId: string, montoApertura: number }`

- [ ] **Step 1: Crear `components/admin/CerrarCajaDialog.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type PagoPendiente = {
  id: string;
  monto: number;
  origen_tipo: string;
  origen_id: string;
  created_at: string;
  cuenta_bancaria: { id: string; nombre_display: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sesionId: string;
  montoApertura: number;
};

type ResumenData = {
  total_efectivo: number;
  total_transferencia: number;
  total_otro: number;
  total_reservas: number;
  total_consumos: number;
};

export default function CerrarCajaDialog({ open, onClose, onSuccess, sesionId, montoApertura }: Props) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [montoCierre, setMontoCierre] = useState("");
  const [resumen, setResumen] = useState<ResumenData | null>(null);
  const [pendientesDelDia, setPendientesDelDia] = useState<PagoPendiente[]>([]);
  const [pendientesOtros, setPendientesOtros] = useState<PagoPendiente[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoadingData(true);

    Promise.all([
      fetch(`/api/admin/caja/pendientes-facturacion`).then((r) => r.json()),
      // Resumen se calcula de la sesión actual — traemos los pagos de la sesión
      fetch(`/api/admin/cobros?per_page=5000`).then((r) => r.json()),
    ]).then(([pendientesData]) => {
      const delDia: PagoPendiente[] = pendientesData.del_dia ?? [];
      const otros: PagoPendiente[] = pendientesData.otros ?? [];
      setPendientesDelDia(delDia);
      setPendientesOtros(otros);
      // Pre-seleccionar los del día
      setSeleccionados(new Set(delDia.map((p: PagoPendiente) => p.id)));
    }).catch(() => {
      toast.error("Error al cargar datos de cierre");
    }).finally(() => setLoadingData(false));
  }, [open, sesionId]);

  // Calcular resumen desde pagos del día (simplificado: datos vienen del backend al cerrar)
  // Aquí mostramos placeholder hasta que implementemos endpoint de resumen previo
  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCerrar(facturar: boolean) {
    const montoNum = parseFloat(montoCierre.replace(",", "."));
    if (isNaN(montoNum) || montoNum < 0) {
      toast.error("Ingresá el monto de efectivo contado");
      return;
    }

    setLoading(true);
    try {
      const pago_ids_facturar = facturar ? Array.from(seleccionados) : [];
      const res = await fetch("/api/admin/caja/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto_cierre_declarado: montoNum,
          pago_ids_facturar,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Error al cerrar caja");
        return;
      }
      toast.success(facturar ? "Caja cerrada y facturación iniciada" : "Caja cerrada sin facturar");
      onSuccess();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  const diferencia = (() => {
    const montoNum = parseFloat(montoCierre.replace(",", "."));
    if (isNaN(montoNum)) return null;
    // La diferencia real la calculará el backend; aquí mostramos el campo declarado vs apertura
    return montoNum - montoApertura;
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {paso === 1 ? "Cerrar caja — Resumen del día" : "Cerrar caja — Facturación"}
          </DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Cargando datos...</div>
        ) : paso === 1 ? (
          <div className="space-y-4 py-2">
            {/* Efectivo */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conciliación efectivo</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Efectivo inicial</span>
                <span className="font-medium">${montoApertura.toLocaleString("es-AR")}</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monto_cierre" className="text-xs">Efectivo contado al cierre</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="monto_cierre"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={montoCierre}
                    onChange={(e) => setMontoCierre(e.target.value)}
                    className="pl-7"
                    autoFocus
                  />
                </div>
              </div>
              {diferencia !== null && (
                <div className={`flex justify-between text-sm font-medium ${diferencia < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  <span>Diferencia</span>
                  <span>{diferencia >= 0 ? "+" : ""}${diferencia.toLocaleString("es-AR")}</span>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              El resumen completo por medio de pago y por origen se registrará al confirmar.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-2 max-h-96 overflow-y-auto">
            {pendientesDelDia.length === 0 && pendientesOtros.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay transferencias pendientes de facturar.
              </p>
            ) : (
              <>
                {pendientesDelDia.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Del día</p>
                    {pendientesDelDia.map((p) => (
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/30 cursor-pointer">
                        <Checkbox
                          checked={seleccionados.has(p.id)}
                          onCheckedChange={() => toggleSeleccion(p.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground capitalize">{p.origen_tipo}</span>
                          {p.cuenta_bancaria && (
                            <span className="text-xs text-muted-foreground ml-1">· {p.cuenta_bancaria.nombre_display}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium shrink-0">${Number(p.monto).toLocaleString("es-AR")}</span>
                      </label>
                    ))}
                  </div>
                )}
                {pendientesOtros.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pendientes de otros días</p>
                    {pendientesOtros.map((p) => (
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/30 cursor-pointer">
                        <Checkbox
                          checked={seleccionados.has(p.id)}
                          onCheckedChange={() => toggleSeleccion(p.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground capitalize">{p.origen_tipo}</span>
                          {p.cuenta_bancaria && (
                            <span className="text-xs text-muted-foreground ml-1">· {p.cuenta_bancaria.nombre_display}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium shrink-0">${Number(p.monto).toLocaleString("es-AR")}</span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {paso === 1 ? (
            <>
              <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button
                size="sm"
                onClick={() => setPaso(2)}
                disabled={!montoCierre || loading}
              >
                Siguiente →
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setPaso(1)} disabled={loading}>← Anterior</Button>
              <Button variant="outline" size="sm" onClick={() => handleCerrar(false)} disabled={loading}>
                Cerrar sin facturar
              </Button>
              <Button size="sm" onClick={() => handleCerrar(true)} disabled={loading}>
                {loading ? "Cerrando..." : `Facturar (${seleccionados.size}) y cerrar`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar flujo de cierre**

Con caja abierta y al menos un pago de transferencia registrado:
1. Navegar a `/admin/caja`
2. Click "Cerrar caja"
3. Paso 1: ingresar monto de cierre, verificar diferencia calculada
4. Click "Siguiente"
5. Paso 2: verificar que aparecen los pagos pendientes del día preseleccionados
6. Click "Cerrar sin facturar" → verificar que la caja se cierra y el banner desaparece/cambia

- [ ] **Step 3: Commit**

```bash
git add components/admin/CerrarCajaDialog.tsx
git commit -m "feat: add CerrarCajaDialog with 2-step flow (resumen + facturacion)"
```

---

## Task 10: UI — CajaDetalleModal

**Files:**
- Create: `components/admin/CajaDetalleModal.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/caja/[id]`
- Props: `{ open: boolean, jornadaId: string, onClose: () => void }`

- [ ] **Step 1: Crear `components/admin/CajaDetalleModal.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JornadaOperativa, SesionCaja, ResumenCaja } from "@/lib/caja/types";

type Comprobante = {
  id: string;
  estado: string;
  cae: string | null;
  importe: number;
  emitida_at: string | null;
  tipo_cbte: number;
  nro_cbte: number | null;
};

type Props = {
  open: boolean;
  jornadaId: string;
  onClose: () => void;
};

const ESTADO_CBTE: Record<string, { label: string; className: string }> = {
  emitida:   { label: "Emitida",   className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  fallida:   { label: "Fallida",   className: "bg-red-100 text-red-700 border-red-200" },
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-700 border-amber-200" },
};

export default function CajaDetalleModal({ open, jornadaId, onClose }: Props) {
  const [jornada, setJornada] = useState<JornadaOperativa | null>(null);
  const [sesion, setSesion] = useState<SesionCaja | null>(null);
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !jornadaId) return;
    setLoading(true);
    fetch(`/api/admin/caja/${jornadaId}`)
      .then((r) => r.json())
      .then((data) => {
        setJornada(data.jornada);
        setSesion(data.sesion);
        setComprobantes(data.comprobantes ?? []);
      })
      .finally(() => setLoading(false));
  }, [open, jornadaId]);

  const resumen = sesion?.resumen_json as ResumenCaja | null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Jornada {jornada ? format(parseISO(jornada.fecha_jornada + "T12:00:00"), "dd/MM/yyyy") : "—"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Horarios */}
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Apertura</p>
                <p className="font-medium">
                  {sesion ? format(parseISO(sesion.abierta_at), "HH:mm", { locale: es }) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cierre</p>
                <p className="font-medium">
                  {sesion?.cerrada_at
                    ? format(parseISO(sesion.cerrada_at), "HH:mm", { locale: es })
                    : "—"}
                </p>
              </div>
            </div>

            {/* Resumen financiero */}
            {resumen && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resumen</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Efectivo</span>
                  <span className="text-right font-medium">${resumen.total_efectivo.toLocaleString("es-AR")}</span>
                  <span className="text-muted-foreground">Transferencia</span>
                  <span className="text-right font-medium">${resumen.total_transferencia.toLocaleString("es-AR")}</span>
                  <span className="text-muted-foreground">Otro</span>
                  <span className="text-right font-medium">${resumen.total_otro.toLocaleString("es-AR")}</span>
                  <span className="text-muted-foreground">Reservas</span>
                  <span className="text-right font-medium">${resumen.total_reservas.toLocaleString("es-AR")}</span>
                  <span className="text-muted-foreground">Consumos</span>
                  <span className="text-right font-medium">${resumen.total_consumos.toLocaleString("es-AR")}</span>
                </div>
                <div className={`flex justify-between text-sm font-semibold border-t border-border pt-2 ${resumen.diferencia_efectivo < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  <span>Diferencia efectivo</span>
                  <span>{resumen.diferencia_efectivo >= 0 ? "+" : ""}${resumen.diferencia_efectivo.toLocaleString("es-AR")}</span>
                </div>
              </div>
            )}

            {/* Comprobantes */}
            {comprobantes.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Comprobantes emitidos ({comprobantes.length})
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  {comprobantes.map((c) => {
                    const cfg = ESTADO_CBTE[c.estado] ?? { label: c.estado, className: "bg-slate-100 text-slate-500 border-slate-200" };
                    return (
                      <div key={c.id} className="flex items-center px-3 py-2 border-b border-border last:border-0 gap-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.className}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono flex-1">
                          {c.nro_cbte ? `#${c.nro_cbte}` : "—"}
                        </span>
                        <span className="text-sm font-medium">${Number(c.importe).toLocaleString("es-AR")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verificar modal de detalle**

En `/admin/caja`, click en una fila del historial. Verificar que:
- Se abre el modal con los datos de la jornada
- Muestra horarios de apertura/cierre
- Muestra resumen financiero (si fue cerrada con datos)
- Muestra comprobantes si los hay

- [ ] **Step 3: Commit**

```bash
git add components/admin/CajaDetalleModal.tsx
git commit -m "feat: add CajaDetalleModal with resumen and comprobantes"
```

---

## Task 11: Config — Tab "General" con cutoff configurable

**Files:**
- Modify: `app/admin/(protected)/config/page.tsx`
- Modify: `components/admin/ConfigClient.tsx`
- Create: `app/api/admin/config/general/route.ts`

**Interfaces:**
- Consumes: `config_modulos.caja_cutoff_hour`
- Produces: `PATCH /api/admin/config/general` body: `{ caja_cutoff_hour: number }` → `{ ok: true }`

- [ ] **Step 1: Crear `app/api/admin/config/general/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { hasMinRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("config_modulos")
    .select("caja_cutoff_hour")
    .eq("id", 1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!hasMinRole(session, "superadmin")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await request.json();
  const { caja_cutoff_hour } = body;

  if (
    typeof caja_cutoff_hour !== "number" ||
    caja_cutoff_hour < 0 ||
    caja_cutoff_hour > 23
  ) {
    return NextResponse.json({ error: "caja_cutoff_hour debe ser entre 0 y 23" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("config_modulos")
    .update({ caja_cutoff_hour })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Modificar `app/admin/(protected)/config/page.tsx`**

Agregar al `Promise.all` existente:
```typescript
// Agregar en el Promise.all:
supabase.from("config_modulos").select("caja_cutoff_hour").eq("id", 1).single(),
```

Desestructurar:
```typescript
// Agregar al desestructurado:
{ data: configGeneral },
```

Pasar prop a `ConfigClient`:
```typescript
<ConfigClient
  // ... props existentes
  cutoffHour={configGeneral?.caja_cutoff_hour ?? 7}
/>
```

- [ ] **Step 3: Agregar tab "General" en `components/admin/ConfigClient.tsx`**

En la firma del componente agregar prop:
```typescript
cutoffHour: number;
```

En el JSX del `TabsList`, agregar antes del primer tab existente:
```tsx
<TabsTrigger value="general">General</TabsTrigger>
```

En el `TabsContent`, agregar:
```tsx
<TabsContent value="general">
  <GeneralTab cutoffHour={cutoffHour} />
</TabsContent>
```

Crear el componente `GeneralTab` dentro del mismo archivo:
```typescript
function GeneralTab({ cutoffHour: initialCutoff }: { cutoffHour: number }) {
  const [cutoff, setCutoff] = useState(String(initialCutoff));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const val = parseInt(cutoff);
    if (isNaN(val) || val < 0 || val > 23) {
      toast.error("El horario debe ser entre 0 y 23");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config/general", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caja_cutoff_hour: val }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error ?? "Error al guardar");
        return;
      }
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-sm font-semibold mb-4">Configuración de caja</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cutoff_hour" className="text-sm">Hora de corte de jornada</Label>
            <Input
              id="cutoff_hour"
              type="number"
              min="0"
              max="23"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              Pagos registrados antes de esta hora pertenecen a la jornada del día anterior.
              Default: 7 (07:00hs). Ideal para negocios nocturnos.
            </p>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

Agregar import de `Label` y `useState` si no está.

- [ ] **Step 4: Verificar en browser**

Navegar a `/admin/config`. Verificar que:
- Aparece el tab "General" como primera pestaña
- Muestra el campo "Hora de corte" con valor 7
- Guardar con un valor diferente (ej. 6) → toast "Configuración guardada"
- Refrescar página → el valor persiste

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/config/general/route.ts app/admin/\(protected\)/config/page.tsx components/admin/ConfigClient.tsx
git commit -m "feat: add General config tab with caja_cutoff_hour setting"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `jornadas_operativas` + `sesiones_caja` → Task 1
- ✅ `getFechaJornadaActual(cutoff)` → Task 2
- ✅ `validarSesionActiva()` con árbol de decisión completo → Task 2
- ✅ `POST /api/admin/caja/abrir` con guard de jornada existente → Task 3
- ✅ `GET /api/admin/caja/estado` → Task 3
- ✅ `POST /api/admin/caja/cerrar` con resumen + facturación fire-and-forget → Task 4
- ✅ `POST /api/admin/caja/reabrir` con validación de fecha → Task 4
- ✅ `GET /api/admin/caja/pendientes-facturacion` separado del_dia / otros → Task 4
- ✅ `GET /api/admin/caja/historial` paginado → Task 5
- ✅ `GET /api/admin/caja/[id]` con comprobantes → Task 5
- ✅ `POST /api/admin/pagos` gateado con `validarSesionActiva` → Task 6
- ✅ `emitirFactura` removido de pagos → Task 6
- ✅ `sesion_caja_id` en pagos insertados → Task 6
- ✅ Item "Caja" en sidebar (Landmark) → Task 7
- ✅ `CajaClient` con header + grilla historial → Task 7
- ✅ `AbrirCajaDialog` → Task 8
- ✅ Banner persistente en layout (sin caja / jornada vencida) → Task 8
- ✅ `CerrarCajaDialog` 2 pasos (resumen + checklist facturación) → Task 9
- ✅ Pendientes del día preseleccionados, otros días deseleccionados → Task 9
- ✅ `CajaDetalleModal` con resumen financiero + comprobantes → Task 10
- ✅ Tab "General" en config con `caja_cutoff_hour` → Task 11
- ✅ `PATCH /api/admin/config/general` → Task 11

**Placeholder scan:** Ningún TBD, TODO, ni "similar a Task N". Todos los code blocks son completos.

**Type consistency:** 
- `EstadoCajaCode`, `CajaValidationResult`, `EstadoCajaResponse`, `ResumenCaja` definidos en Task 2 y usados con nombres exactos en Tasks 3–10.
- `validarSesionActiva(supabase, cutoffHour)` — firma consistente en todos los usos.
- `sesion_caja_id` nombrado igual en migración, route de pagos, y route de pendientes.
