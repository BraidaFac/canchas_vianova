# Plan 1 — Foundation: Multi-entidad fiscal, Pagos, Cobros
**Date:** 2026-07-31
**Branch:** `feat/facturacion-electronica`
**Author:** Claude Code
**Status:** DRAFT

---

## Global Constraints

- Next.js 15 App Router — all server components are `async`, all client components have `"use client"`
- TypeScript strict mode — no `any`, no implicit types
- Tailwind CSS v4 — no `@apply`, utility classes only
- shadcn/ui components from `components/ui/`
- Supabase SSR — always `await createSupabaseServerClient()` (never browser client in API routes)
- Auth: `await getSession()` returns `AdminSession | null`; superadmin check = `session.rol !== "superadmin"`
- Toasts: `import { toast } from "sonner"` in client components only
- API routes: `import { NextRequest, NextResponse } from "next/server"`
- No test suite — validation = `npx tsc --noEmit` + `npm run lint` + manual browser check
- Commit after every task with `git commit -m "feat: <task>"`

---

## Task 1 — DB Migration

**Files:**
- `supabase/migrations/20260731000001_foundation.sql` (NEW)

### Steps

**Step 1.1** — Create migration file with the following complete content:

```sql
-- ============================================================
-- Migration: Plan 1 Foundation
-- 2026-07-31
-- ============================================================

-- 1. entidades_fiscales (replaces config_facturacion single-row)
CREATE TABLE entidades_fiscales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_interno  text NOT NULL DEFAULT 'Principal',
  cuit            text,
  razon_social    text,
  domicilio       text,
  condicion_iva   text CHECK (condicion_iva IN ('monotributo','responsable_inscripto')),
  punto_venta     int,
  afipsdk_token   text,
  cert_encrypted  text,
  key_encrypted   text,
  modo            text NOT NULL DEFAULT 'testing' CHECK (modo IN ('testing','produccion')),
  activo          bool NOT NULL DEFAULT true,
  predeterminada  bool NOT NULL DEFAULT false,
  updated_at      timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

-- Migrate existing row from config_facturacion
INSERT INTO entidades_fiscales (
  nombre_interno, cuit, razon_social, domicilio,
  condicion_iva, punto_venta, afipsdk_token,
  cert_encrypted, key_encrypted, modo, activo, predeterminada, updated_at
)
SELECT
  'Principal', cuit, razon_social, domicilio,
  condicion_iva, punto_venta, afipsdk_token,
  cert_encrypted, key_encrypted, modo, activo, true, updated_at
FROM config_facturacion
WHERE id = 1;

DROP TABLE config_facturacion;

-- 2. cuentas_bancarias
CREATE TABLE cuentas_bancarias (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_display     text NOT NULL,
  banco              text,
  cbu                text,
  alias              text,
  entidad_fiscal_id  uuid NOT NULL REFERENCES entidades_fiscales(id) ON DELETE CASCADE,
  activo             bool NOT NULL DEFAULT true,
  created_at         timestamptz DEFAULT now()
);

-- 3. pagos (polymorphic)
CREATE TABLE pagos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen_tipo         text NOT NULL CHECK (origen_tipo IN ('reserva','consumo')),
  origen_id           uuid NOT NULL,
  medio_pago          text NOT NULL CHECK (medio_pago IN ('efectivo','transferencia','otro')),
  monto               numeric NOT NULL CHECK (monto > 0),
  cuenta_bancaria_id  uuid REFERENCES cuentas_bancarias(id),
  empleado_id         uuid REFERENCES empleados(id),
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_pagos_origen ON pagos(origen_tipo, origen_id);

-- 4. Alter comprobantes — add pago_id + origen_tipo
--    reserva_id kept for backwards compat during migration; drop later
ALTER TABLE comprobantes
  ADD COLUMN pago_id     uuid REFERENCES pagos(id),
  ADD COLUMN origen_tipo text CHECK (origen_tipo IN ('reserva','consumo'));

-- 5. config_modulos (single-row feature flags)
CREATE TABLE config_modulos (
  id           int PRIMARY KEY DEFAULT 1,
  facturacion  bool NOT NULL DEFAULT false,
  pos          bool NOT NULL DEFAULT false,
  stock        bool NOT NULL DEFAULT false,
  CHECK (id = 1)
);

INSERT INTO config_modulos DEFAULT VALUES;

-- Copy current facturacion activo state from migrated entidad
UPDATE config_modulos
SET facturacion = (
  SELECT activo FROM entidades_fiscales WHERE predeterminada = true LIMIT 1
);

-- 6. iva_alicuotas
CREATE TABLE iva_alicuotas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL,
  porcentaje     numeric NOT NULL,
  predeterminada bool NOT NULL DEFAULT false,
  activo         bool NOT NULL DEFAULT true
);

INSERT INTO iva_alicuotas (nombre, porcentaje, predeterminada) VALUES
  ('21%',   21.00, true),
  ('10.5%', 10.50, false),
  ('Exento', 0.00, false);
```

**Step 1.2** — Run migration in Supabase dashboard SQL editor (or via `supabase db push` if CLI configured).

**Step 1.3** — Validate: in Supabase Table Editor confirm all six tables exist; confirm `entidades_fiscales` has one row with `predeterminada = true`.

**Step 1.4** — Commit:
```bash
git add supabase/migrations/20260731000001_foundation.sql
git commit -m "feat: add entidades_fiscales, pagos, cuentas_bancarias, config_modulos, iva_alicuotas migrations"
```

---

## Task 2 — TypeScript Types

**Files:**
- `lib/facturacion/types.ts` (MODIFY)
- `lib/types.ts` (MODIFY)

### Step 2.1 — Replace `lib/facturacion/types.ts` completely

```typescript
export type ComprobanteEstado = "pendiente" | "emitida" | "fallida" | "anulada";
export type CondicionIVA = "monotributo" | "responsable_inscripto";
export type ModoAfip = "testing" | "produccion";
export type MedioPago = "efectivo" | "transferencia" | "otro";
export type OrigenTipo = "reserva" | "consumo";
export type EstadoFiscal = "facturado" | "mixto" | "sin_comprobante";

// ─── Entidades Fiscales ──────────────────────────────────────────────────────

export type EntidadFiscal = {
  id: string;
  nombre_interno: string;
  cuit: string | null;
  razon_social: string | null;
  domicilio: string | null;
  condicion_iva: CondicionIVA | null;
  punto_venta: number | null;
  afipsdk_token: string | null;
  tiene_cert: boolean;
  tiene_key: boolean;
  modo: ModoAfip;
  activo: boolean;
  predeterminada: boolean;
  updated_at: string;
  created_at: string;
};

// Internal type with raw encrypted fields — server only, never sent to client
export type EntidadFiscalRaw = Omit<EntidadFiscal, "tiene_cert" | "tiene_key"> & {
  cert_encrypted: string | null;
  key_encrypted: string | null;
};

// ─── Cuentas Bancarias ───────────────────────────────────────────────────────

export type CuentaBancaria = {
  id: string;
  nombre_display: string;
  banco: string | null;
  cbu: string | null;
  alias: string | null;
  entidad_fiscal_id: string;
  activo: boolean;
  created_at: string;
  // joined
  entidad_fiscal?: Pick<EntidadFiscal, "id" | "nombre_interno" | "cuit"> | null;
};

// ─── Pagos ───────────────────────────────────────────────────────────────────

export type Pago = {
  id: string;
  origen_tipo: OrigenTipo;
  origen_id: string;
  medio_pago: MedioPago;
  monto: number;
  cuenta_bancaria_id: string | null;
  empleado_id: string | null;
  created_at: string;
  // joined
  cuenta_bancaria?: CuentaBancaria | null;
};

// ─── Comprobantes ────────────────────────────────────────────────────────────

export type Comprobante = {
  id: string;
  // New columns (pago_id replaces reserva_id for new flow)
  pago_id: string | null;
  origen_tipo: OrigenTipo | null;
  // Legacy column kept during transition
  reserva_id: string | null;
  tipo_cbte: number;
  punto_venta: number | null;
  nro_cbte: number | null;
  fecha_cbte: string;       // YYYY-MM-DD
  cae: string | null;
  vencimiento_cae: string | null;
  importe: number;
  concepto: number;
  doc_tipo: number;
  doc_nro: number;
  nombre_receptor: string | null;
  estado: ComprobanteEstado;
  cae_manual: boolean;
  intentos: number;
  datos_envio: Record<string, unknown> | null;
  datos_respuesta: Record<string, unknown> | null;
  ultimo_error: string | null;
  emitida_at: string | null;
  created_at: string;
  // joined
  reserva?: { id: string; id_legible: string; fecha: string } | null;
  pago?: (Pago & { cuenta_bancaria?: CuentaBancaria | null }) | null;
};

// ─── IVA Alícuotas ───────────────────────────────────────────────────────────

export type IvaAlicuota = {
  id: string;
  nombre: string;
  porcentaje: number;
  predeterminada: boolean;
  activo: boolean;
};

// ─── Config Módulos ──────────────────────────────────────────────────────────

export type ConfigModulos = {
  id: 1;
  facturacion: boolean;
  pos: boolean;
  stock: boolean;
};

// ─── Cobros (derived view type) ──────────────────────────────────────────────

export type PagoConComprobante = Pago & {
  comprobante?: Pick<Comprobante, "id" | "cae" | "estado" | "importe"> | null;
};

export type CobroOrigen = {
  id: string;
  tipo: OrigenTipo;
  descripcion: string;    // e.g. "Reserva #R-001" or "Consumo"
  fecha: string;          // ISO date string
  total: number;          // sum of all pagos
  estado_fiscal: EstadoFiscal;
  pagos: PagoConComprobante[];
};

// ─── Legacy types (kept for any code not yet migrated) ───────────────────────

/** @deprecated Use EntidadFiscal instead */
export type ConfigFacturacion = {
  id: 1;
  cuit: string | null;
  razon_social: string | null;
  domicilio: string | null;
  condicion_iva: CondicionIVA;
  punto_venta: number | null;
  afipsdk_token: string | null;
  tiene_cert: boolean;
  tiene_key: boolean;
  modo: ModoAfip;
  activo: boolean;
  updated_at: string;
};

/** @deprecated Use EntidadFiscalRaw instead */
export type ConfigFacturacionRaw = Omit<ConfigFacturacion, "tiene_cert" | "tiene_key"> & {
  cert_encrypted: string | null;
  key_encrypted: string | null;
};
```

### Step 2.2 — Update `lib/types.ts` re-export line

Current line 120:
```typescript
export type { ConfigFacturacion, ConfigFacturacionRaw, Comprobante, ComprobanteEstado } from "./facturacion/types";
```

Replace with:
```typescript
export type {
  ConfigFacturacion,
  ConfigFacturacionRaw,
  Comprobante,
  ComprobanteEstado,
  EntidadFiscal,
  EntidadFiscalRaw,
  CuentaBancaria,
  Pago,
  MedioPago,
  OrigenTipo,
  EstadoFiscal,
  IvaAlicuota,
  ConfigModulos,
  PagoConComprobante,
  CobroOrigen,
} from "./facturacion/types";
```

### Step 2.3 — Validate
```bash
npx tsc --noEmit
```
Expect zero errors.

### Step 2.4 — Commit
```bash
git add lib/facturacion/types.ts lib/types.ts
git commit -m "feat: add EntidadFiscal, CuentaBancaria, Pago, ConfigModulos and related types"
```

---

## Task 3 — Refactor `lib/facturacion/afip-client.ts`

**Files:**
- `lib/facturacion/afip-client.ts` (MODIFY)

### Step 3.1 — Replace file completely

```typescript
import Afip from "@afipsdk/afip.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decrypt } from "./crypto";
import type { EntidadFiscalRaw } from "./types";

/**
 * Returns an Afip SDK client configured for the given entidad fiscal.
 * Throws with descriptive messages if anything is misconfigured.
 */
export async function getAfipClient(entidadFiscalId: string): Promise<{
  client: InstanceType<typeof Afip>;
  config: EntidadFiscalRaw;
}> {
  const supabase = await createSupabaseServerClient();
  const { data: config, error } = await supabase
    .from("entidades_fiscales")
    .select("*")
    .eq("id", entidadFiscalId)
    .single();

  if (error || !config) throw new Error("Entidad fiscal no encontrada");
  if (!config.activo) throw new Error("Entidad fiscal inactiva");
  if (!config.cuit) throw new Error("CUIT no configurado");
  if (!config.punto_venta) throw new Error("Punto de venta no configurado");
  if (!config.afipsdk_token) throw new Error("Token AFIP SDK no configurado");
  if (!config.cert_encrypted || !config.key_encrypted)
    throw new Error("Certificados no configurados");

  const cert = decrypt(config.cert_encrypted);
  const key = decrypt(config.key_encrypted);

  const client = new Afip({
    CUIT: Number(config.cuit),
    access_token: config.afipsdk_token,
    production: config.modo === "produccion",
    cert,
    key,
  });

  return { client, config: config as EntidadFiscalRaw };
}

/**
 * Convenience: get the Afip client for the predeterminada entidad fiscal.
 * Used by the legacy procesar-cola route and retry routes that don't yet
 * have a pago_id to resolve the entidad from.
 */
export async function getAfipClientDefault(): Promise<{
  client: InstanceType<typeof Afip>;
  config: EntidadFiscalRaw;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entidades_fiscales")
    .select("id")
    .eq("predeterminada", true)
    .eq("activo", true)
    .single();

  if (error || !data) throw new Error("No hay entidad fiscal predeterminada activa");
  return getAfipClient(data.id);
}
```

### Step 3.2 — Update callers of old `getAfipClient()` (no-arg signature)

Files that call `getAfipClient()` without argument and must be updated to use `getAfipClientDefault()`:
- `app/api/admin/facturacion/[id]/route.ts` — line 51: `const { client, config } = await getAfipClient();`
- `app/api/admin/facturacion/procesar-cola/route.ts` — line 27: `const { client, config } = await getAfipClient();`

In both files, update the import and call:

**`app/api/admin/facturacion/[id]/route.ts`** — change line 4:
```typescript
// FROM:
import { getAfipClient } from "@/lib/facturacion/afip-client";
// TO:
import { getAfipClientDefault } from "@/lib/facturacion/afip-client";
```
And line 51:
```typescript
// FROM:
const { client, config } = await getAfipClient();
// TO:
const { client, config } = await getAfipClientDefault();
```

**`app/api/admin/facturacion/procesar-cola/route.ts`** — change line 3:
```typescript
// FROM:
import { getAfipClient } from "@/lib/facturacion/afip-client";
// TO:
import { getAfipClientDefault } from "@/lib/facturacion/afip-client";
```
And line 27:
```typescript
// FROM:
const { client, config } = await getAfipClient();
// TO:
const { client, config } = await getAfipClientDefault();
```

### Step 3.3 — Validate
```bash
npx tsc --noEmit
npm run lint
```

### Step 3.4 — Commit
```bash
git add lib/facturacion/afip-client.ts app/api/admin/facturacion/[id]/route.ts app/api/admin/facturacion/procesar-cola/route.ts
git commit -m "feat: refactor getAfipClient to accept entidadFiscalId, add getAfipClientDefault"
```

---

## Task 4 — Refactor `lib/facturacion/emitir.ts`

**Files:**
- `lib/facturacion/emitir.ts` (MODIFY)

### Step 4.1 — Replace file completely

```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAfipClient } from "./afip-client";

export type EmitirParams = {
  pago_id: string;
  nombre_receptor?: string;
};

export type EmitirResult = {
  cae: string;
  nroCbte: number;
  comprobanteId: string;
};

function toDateInt(dateStr: string): number {
  return parseInt(dateStr.replace(/-/g, ""), 10);
}

export async function emitirFactura(params: EmitirParams): Promise<EmitirResult> {
  const { pago_id, nombre_receptor } = params;
  const supabase = await createSupabaseServerClient();

  // Resolve pago → cuenta_bancaria → entidad_fiscal
  const { data: pago, error: pagoErr } = await supabase
    .from("pagos")
    .select(`
      *,
      cuenta_bancaria:cuentas_bancarias(
        *,
        entidad_fiscal:entidades_fiscales(*)
      )
    `)
    .eq("id", pago_id)
    .single();

  if (pagoErr || !pago) throw new Error("Pago no encontrado");
  if (pago.medio_pago !== "transferencia") {
    throw new Error("Solo se pueden emitir facturas para pagos por transferencia");
  }
  if (!pago.cuenta_bancaria) {
    throw new Error("El pago no tiene cuenta bancaria asociada");
  }

  const entidadFiscalId = pago.cuenta_bancaria.entidad_fiscal_id as string;
  const fechaHoy = new Date().toISOString().slice(0, 10);

  // Insert comprobante in pendiente state BEFORE calling ARCA.
  // If ARCA fails, the record stays for retry by cron.
  const { data: cbte, error: insertErr } = await supabase
    .from("comprobantes")
    .insert({
      pago_id,
      origen_tipo: pago.origen_tipo,
      fecha_cbte: fechaHoy,
      importe: pago.monto,
      nombre_receptor: nombre_receptor ?? null,
      estado: "pendiente",
      intentos: 0,
    })
    .select()
    .single();

  if (insertErr || !cbte) throw new Error("Error al crear registro de comprobante");

  try {
    const { client, config } = await getAfipClient(entidadFiscalId);
    const puntoVenta = config.punto_venta!;

    // monotributo → Factura C (11), responsable_inscripto → Factura B (6)
    const tipoCbte = config.condicion_iva === "responsable_inscripto" ? 6 : 11;

    const ultimoNro = await client.ElectronicBilling.getLastVoucher(puntoVenta, tipoCbte);
    const nroCbte = ultimoNro + 1;

    // For the service date: use today (pagos don't carry a fecha_reserva;
    // the reserva date is derivable from origen_tipo/origen_id if needed later)
    const payload = {
      CantReg: 1,
      PtoVta: puntoVenta,
      CbteTipo: tipoCbte,
      Concepto: 2,               // 2 = Servicios
      DocTipo: 99,               // 99 = Consumidor Final
      DocNro: 0,
      CbteDesde: nroCbte,
      CbteHasta: nroCbte,
      CbteFch: toDateInt(fechaHoy),
      ImpTotal: pago.monto,
      ImpTotConc: 0,
      ImpNeto: pago.monto,
      ImpOpEx: 0,
      ImpIVA: 0,
      ImpTrib: 0,
      MonId: "PES",
      MonCotiz: 1,
      CondicionIVAReceptorId: 5, // 5 = Consumidor Final
      FchServDesde: toDateInt(fechaHoy),
      FchServHasta: toDateInt(fechaHoy),
      FchVtoPago: toDateInt(fechaHoy),
    };

    // Save payload before sending (for debug if it fails mid-flight)
    await supabase
      .from("comprobantes")
      .update({
        tipo_cbte: tipoCbte,
        punto_venta: puntoVenta,
        nro_cbte: nroCbte,
        concepto: 2,
        doc_tipo: 99,
        doc_nro: 0,
        datos_envio: payload,
      })
      .eq("id", cbte.id);

    const respuesta = await client.ElectronicBilling.createVoucher(payload);

    const vencimientoStr = String(respuesta.CAEFchVto);
    const vencimiento = `${vencimientoStr.slice(0, 4)}-${vencimientoStr.slice(4, 6)}-${vencimientoStr.slice(6, 8)}`;

    await supabase
      .from("comprobantes")
      .update({
        estado: "emitida",
        cae: respuesta.CAE,
        vencimiento_cae: vencimiento,
        datos_respuesta: respuesta as Record<string, unknown>,
        emitida_at: new Date().toISOString(),
      })
      .eq("id", cbte.id);

    return { cae: respuesta.CAE, nroCbte, comprobanteId: cbte.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("comprobantes")
      .update({ estado: "fallida", intentos: 1, ultimo_error: msg })
      .eq("id", cbte.id);
    throw err;
  }
}
```

### Step 4.2 — Update `app/api/admin/facturacion/route.ts`

The old POST handler called `emitirFactura({ reservaId, monto, fechaReserva })`. Now that new flow goes through `POST /api/admin/pagos`, this route's POST can be removed or kept for legacy manual emission. Keep it but add a deprecation note and no-op body since `pago_id` is now required:

Replace the entire file:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const estado = searchParams.get("estado");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = 20;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("comprobantes")
    .select(
      `*,
       reserva:reservas(id, id_legible, fecha),
       pago:pagos(
         id, medio_pago, monto,
         cuenta_bancaria:cuentas_bancarias(id, nombre_display, entidad_fiscal_id)
       )`,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (estado) query = query.eq("estado", estado);
  if (desde) query = query.gte("fecha_cbte", desde);
  if (hasta) query = query.lte("fecha_cbte", hasta);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}
```

### Step 4.3 — Validate
```bash
npx tsc --noEmit
```

### Step 4.4 — Commit
```bash
git add lib/facturacion/emitir.ts app/api/admin/facturacion/route.ts
git commit -m "feat: refactor emitirFactura to accept pago_id, update comprobantes GET to join pago"
```

---

## Task 5 — API Routes: Entidades Fiscales + Cuentas Bancarias

**Files (all NEW):**
- `app/api/admin/entidades-fiscales/route.ts`
- `app/api/admin/entidades-fiscales/[id]/route.ts`
- `app/api/admin/cuentas-bancarias/route.ts`
- `app/api/admin/cuentas-bancarias/[id]/route.ts`

### Step 5.1 — Create `app/api/admin/entidades-fiscales/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { encrypt } from "@/lib/facturacion/crypto";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { error: "No autorizado", status: 401 as const };
  if (session.rol !== "superadmin") return { error: "Requiere superadmin", status: 403 as const };
  return { session };
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entidades_fiscales")
    .select("id, nombre_interno, cuit, razon_social, domicilio, condicion_iva, punto_venta, afipsdk_token, cert_encrypted, key_encrypted, modo, activo, predeterminada, updated_at, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Strip raw certs, replace with boolean flags
  const safe = (data ?? []).map(({ cert_encrypted, key_encrypted, ...rest }) => ({
    ...rest,
    tiene_cert: !!cert_encrypted,
    tiene_key: !!key_encrypted,
  }));

  return NextResponse.json(safe);
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { nombre_interno, cuit, razon_social, domicilio, condicion_iva, punto_venta, afipsdk_token, modo, activo, predeterminada, cert_pem, key_pem } = body;

  if (!nombre_interno?.trim()) {
    return NextResponse.json({ error: "nombre_interno es requerido" }, { status: 400 });
  }

  const insert: Record<string, unknown> = {
    nombre_interno: nombre_interno.trim(),
    cuit: cuit?.trim() || null,
    razon_social: razon_social?.trim() || null,
    domicilio: domicilio?.trim() || null,
    condicion_iva: condicion_iva || null,
    punto_venta: punto_venta ? Number(punto_venta) : null,
    afipsdk_token: afipsdk_token?.trim() || null,
    modo: modo ?? "testing",
    activo: activo ?? true,
    predeterminada: predeterminada ?? false,
  };

  if (cert_pem?.trim()) insert.cert_encrypted = encrypt(cert_pem.trim());
  if (key_pem?.trim()) insert.key_encrypted = encrypt(key_pem.trim());

  const supabase = await createSupabaseServerClient();

  // If setting predeterminada=true, unset all others first
  if (insert.predeterminada) {
    await supabase.from("entidades_fiscales").update({ predeterminada: false }).neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { data, error } = await supabase
    .from("entidades_fiscales")
    .insert(insert)
    .select("id, nombre_interno, cuit, razon_social, domicilio, condicion_iva, punto_venta, afipsdk_token, modo, activo, predeterminada, updated_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, tiene_cert: !!insert.cert_encrypted, tiene_key: !!insert.key_encrypted }, { status: 201 });
}
```

### Step 5.2 — Create `app/api/admin/entidades-fiscales/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { encrypt } from "@/lib/facturacion/crypto";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { error: "No autorizado", status: 401 as const };
  if (session.rol !== "superadmin") return { error: "Requiere superadmin", status: 403 as const };
  return { session };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();

  const allowed = ["nombre_interno", "cuit", "razon_social", "domicilio", "condicion_iva", "punto_venta", "afipsdk_token", "modo", "activo", "predeterminada"] as const;
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (body.cert_pem?.trim()) updates.cert_encrypted = encrypt(body.cert_pem.trim());
  if (body.key_pem?.trim()) updates.key_encrypted = encrypt(body.key_pem.trim());

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = await createSupabaseServerClient();

  // When setting predeterminada=true: clear flag on all others
  if (updates.predeterminada === true) {
    await supabase
      .from("entidades_fiscales")
      .update({ predeterminada: false })
      .neq("id", id);
  }

  const { data, error } = await supabase
    .from("entidades_fiscales")
    .update(updates)
    .eq("id", id)
    .select("id, nombre_interno, cuit, razon_social, domicilio, condicion_iva, punto_venta, afipsdk_token, cert_encrypted, key_encrypted, modo, activo, predeterminada, updated_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { cert_encrypted, key_encrypted, ...rest } = data;
  return NextResponse.json({ ...rest, tiene_cert: !!cert_encrypted, tiene_key: !!key_encrypted });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Block deletion if cuentas_bancarias reference this entity
  const { count } = await supabase
    .from("cuentas_bancarias")
    .select("id", { count: "exact", head: true })
    .eq("entidad_fiscal_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${count} cuenta(s) bancaria(s) vinculada(s)` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("entidades_fiscales").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

### Step 5.3 — Create `app/api/admin/cuentas-bancarias/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { error: "No autorizado", status: 401 as const };
  if (session.rol !== "superadmin") return { error: "Requiere superadmin", status: 403 as const };
  return { session };
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cuentas_bancarias")
    .select("*, entidad_fiscal:entidades_fiscales(id, nombre_interno, cuit)")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { nombre_display, banco, cbu, alias, entidad_fiscal_id, activo } = body;

  if (!nombre_display?.trim()) {
    return NextResponse.json({ error: "nombre_display es requerido" }, { status: 400 });
  }
  if (!entidad_fiscal_id) {
    return NextResponse.json({ error: "entidad_fiscal_id es requerido" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cuentas_bancarias")
    .insert({
      nombre_display: nombre_display.trim(),
      banco: banco?.trim() || null,
      cbu: cbu?.trim() || null,
      alias: alias?.trim() || null,
      entidad_fiscal_id,
      activo: activo ?? true,
    })
    .select("*, entidad_fiscal:entidades_fiscales(id, nombre_interno, cuit)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
```

### Step 5.4 — Create `app/api/admin/cuentas-bancarias/[id]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { error: "No autorizado", status: 401 as const };
  if (session.rol !== "superadmin") return { error: "Requiere superadmin", status: 403 as const };
  return { session };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();

  const allowed = ["nombre_display", "banco", "cbu", "alias", "entidad_fiscal_id", "activo"] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cuentas_bancarias")
    .update(updates)
    .eq("id", id)
    .select("*, entidad_fiscal:entidades_fiscales(id, nombre_interno, cuit)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Block if pagos reference this cuenta
  const { count } = await supabase
    .from("pagos")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_bancaria_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${count} pago(s) vinculado(s)` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("cuentas_bancarias").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

### Step 5.5 — Validate
```bash
npx tsc --noEmit
npm run lint
```

### Step 5.6 — Commit
```bash
git add app/api/admin/entidades-fiscales/ app/api/admin/cuentas-bancarias/
git commit -m "feat: add entidades-fiscales and cuentas-bancarias API routes"
```

---

## Task 6 — API: Pagos

**Files (all NEW):**
- `app/api/admin/pagos/route.ts`

### Step 6.1 — Create `app/api/admin/pagos/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { emitirFactura } from "@/lib/facturacion/emitir";
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

  // Insert all pagos
  const insertRows = pagosInput.map((p) => ({
    origen_tipo,
    origen_id,
    medio_pago: p.medio_pago,
    monto: Number(p.monto),
    cuenta_bancaria_id: p.cuenta_bancaria_id ?? null,
    empleado_id: session.id,
  }));

  const { data: pagosCreados, error: pagosErr } = await supabase
    .from("pagos")
    .insert(insertRows)
    .select("*");

  if (pagosErr || !pagosCreados) {
    return NextResponse.json({ error: pagosErr?.message ?? "Error al crear pagos" }, { status: 500 });
  }

  // For each transferencia pago, attempt to emit factura
  const comprobantes: unknown[] = [];
  const erroresEmision: { pago_id: string; error: string }[] = [];

  for (let i = 0; i < pagosCreados.length; i++) {
    const pago = pagosCreados[i];
    if (pago.medio_pago === "transferencia") {
      try {
        const result = await emitirFactura({
          pago_id: pago.id,
          nombre_receptor: pagosInput[i].nombre_receptor,
        });
        // Fetch the created comprobante
        const { data: cbte } = await supabase
          .from("comprobantes")
          .select("*")
          .eq("id", result.comprobanteId)
          .single();
        if (cbte) comprobantes.push(cbte);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        erroresEmision.push({ pago_id: pago.id, error: msg });
      }
    }
  }

  return NextResponse.json(
    {
      pagos: pagosCreados,
      comprobantes,
      ...(erroresEmision.length > 0 ? { errores_emision: erroresEmision } : {}),
    },
    { status: 201 }
  );
}
```

### Step 6.2 — Validate
```bash
npx tsc --noEmit
```

### Step 6.3 — Commit
```bash
git add app/api/admin/pagos/
git commit -m "feat: add POST /api/admin/pagos — creates pagos and auto-emits facturas for transferencias"
```

---

## Task 7 — API: Cobros

**Files (NEW):**
- `app/api/admin/cobros/route.ts`

### Step 7.1 — Create `app/api/admin/cobros/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import type { CobroOrigen, EstadoFiscal, PagoConComprobante } from "@/lib/facturacion/types";

function deriveEstadoFiscal(pagos: PagoConComprobante[]): EstadoFiscal {
  const transferencias = pagos.filter((p) => p.medio_pago === "transferencia");
  if (transferencias.length === 0) return "sin_comprobante";

  const todosFacturados = transferencias.every(
    (p) => p.comprobante?.estado === "emitida"
  );
  if (todosFacturados) return "facturado";

  const algunoFacturado = transferencias.some(
    (p) => p.comprobante?.estado === "emitida"
  );
  if (algunoFacturado) return "mixto";

  return "sin_comprobante";
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const perPage = parseInt(searchParams.get("per_page") ?? "20");
  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");
  const origenTipo = searchParams.get("origen_tipo"); // "reserva" | "consumo" | null

  const supabase = await createSupabaseServerClient();

  // 1. Fetch all pagos with their comprobantes
  let pagosQuery = supabase
    .from("pagos")
    .select(`
      *,
      cuenta_bancaria:cuentas_bancarias(id, nombre_display, entidad_fiscal_id),
      comprobante:comprobantes(id, cae, estado, importe)
    `)
    .order("created_at", { ascending: false });

  if (fromDate) pagosQuery = pagosQuery.gte("created_at", fromDate);
  if (toDate) pagosQuery = pagosQuery.lte("created_at", toDate + "T23:59:59Z");
  if (origenTipo) pagosQuery = pagosQuery.eq("origen_tipo", origenTipo);

  const { data: pagosRaw, error: pagosErr } = await pagosQuery;
  if (pagosErr) return NextResponse.json({ error: pagosErr.message }, { status: 500 });

  // 2. Group pagos by (origen_tipo, origen_id)
  const grouped = new Map<string, PagoConComprobante[]>();
  for (const pago of pagosRaw ?? []) {
    const key = `${pago.origen_tipo}:${pago.origen_id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    // comprobante is an array from the join; take first match
    const comprobante = Array.isArray(pago.comprobante)
      ? (pago.comprobante[0] ?? null)
      : (pago.comprobante ?? null);
    grouped.get(key)!.push({ ...pago, comprobante });
  }

  // 3. Fetch origen details (reservas)
  const reservaIds = [...grouped.entries()]
    .filter(([key]) => key.startsWith("reserva:"))
    .map(([key]) => key.split(":")[1]);

  const reservaMap = new Map<string, { id: string; id_legible: string; fecha: string }>();
  if (reservaIds.length > 0) {
    const { data: reservas } = await supabase
      .from("reservas")
      .select("id, id_legible, fecha")
      .in("id", reservaIds);
    for (const r of reservas ?? []) reservaMap.set(r.id, r);
  }

  // 4. Build CobroOrigen array
  const cobros: CobroOrigen[] = [];
  for (const [key, pagos] of grouped) {
    const [tipo, origenId] = key.split(":") as ["reserva" | "consumo", string];
    const total = pagos.reduce((sum, p) => sum + Number(p.monto), 0);
    const estado_fiscal = deriveEstadoFiscal(pagos);

    let descripcion = tipo === "consumo" ? "Consumo" : `Reserva sin datos`;
    let fecha = pagos[0].created_at;

    if (tipo === "reserva") {
      const r = reservaMap.get(origenId);
      if (r) {
        descripcion = `Reserva #${r.id_legible}`;
        fecha = r.fecha;
      }
    }

    cobros.push({ id: origenId, tipo, descripcion, fecha, total, estado_fiscal, pagos });
  }

  // 5. Sort by fecha desc and paginate
  cobros.sort((a, b) => b.fecha.localeCompare(a.fecha));
  const total = cobros.length;
  const paginated = cobros.slice((page - 1) * perPage, page * perPage);

  return NextResponse.json({ data: paginated, total, page, per_page: perPage });
}
```

### Step 7.2 — Validate
```bash
npx tsc --noEmit
```

### Step 7.3 — Commit
```bash
git add app/api/admin/cobros/
git commit -m "feat: add GET /api/admin/cobros — paginated cobros with fiscal state derivation"
```

---

## Task 8 — config_modulos API + Layout + Sidebar

**Files:**
- `app/api/admin/config/modulos/route.ts` (NEW)
- `app/admin/(protected)/layout.tsx` (MODIFY)
- `components/admin/AdminLayoutClient.tsx` (MODIFY)
- `components/admin/AdminSidebar.tsx` (MODIFY)

### Step 8.1 — Create `app/api/admin/config/modulos/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { error: "No autorizado", status: 401 as const };
  if (session.rol !== "superadmin") return { error: "Requiere superadmin", status: 403 as const };
  return { session };
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("config_modulos")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const allowed = ["facturacion", "pos", "stock"] as const;
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body && typeof body[key] === "boolean") {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("config_modulos")
    .update(updates)
    .eq("id", 1)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

### Step 8.2 — Update `app/admin/(protected)/layout.tsx`

Replace completely:

```typescript
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminLayoutClient from "@/components/admin/AdminLayoutClient";
import { Toaster } from "sonner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/admin/manifest.webmanifest",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const supabase = await createSupabaseServerClient();
  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("facturacion, pos, stock")
    .eq("id", 1)
    .single();

  return (
    <>
      <AdminLayoutClient
        session={session}
        facturacionActiva={modulos?.facturacion ?? false}
        posActivo={modulos?.pos ?? false}
        stockActivo={modulos?.stock ?? false}
      >
        {children}
      </AdminLayoutClient>
      <Toaster richColors position="top-right" />
    </>
  );
}
```

### Step 8.3 — Update `components/admin/AdminLayoutClient.tsx`

Replace completely:

```typescript
"use client";

import { useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { AdminSession } from "@/lib/auth";

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
        {children}
      </main>
    </div>
  );
}
```

### Step 8.4 — Update `components/admin/AdminSidebar.tsx`

Replace the imports block and types at the top:

```typescript
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  List,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Contact,
  Trophy,
  Receipt,
  Wallet,
  ShoppingCart,
  Package,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdminSession } from "@/lib/auth";
import { toast } from "sonner";

const navItems = [
  { href: "/admin/grilla", label: "Grilla", icon: CalendarDays },
  { href: "/admin/reservas", label: "Reservas", icon: List },
  { href: "/admin/clientes", label: "Clientes", icon: Contact },
  { href: "/admin/eventos", label: "Eventos", icon: Trophy },
  { href: "/admin/cobros", label: "Cobros", icon: Wallet },
  { href: "/admin/empleados", label: "Empleados", icon: Users, superadminOnly: true },
  { href: "/admin/facturacion", label: "Facturación", icon: Receipt, requiresFacturacion: true },
  { href: "/admin/pos", label: "POS", icon: ShoppingCart, requiresPos: true },
  { href: "/admin/stock", label: "Stock", icon: Package, requiresStock: true },
  { href: "/admin/config", label: "Configuración", icon: Settings },
];

type Props = {
  session: AdminSession;
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
  facturacionActiva?: boolean;
  posActivo?: boolean;
  stockActivo?: boolean;
};

export default function AdminSidebar({
  session,
  collapsed,
  onCollapsedChange,
  facturacionActiva = false,
  posActivo = false,
  stockActivo = false,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = navItems.filter((item) => {
    if (item.superadminOnly && session.rol !== "superadmin") return false;
    if (item.requiresFacturacion && !facturacionActiva) return false;
    if (item.requiresPos && !posActivo) return false;
    if (item.requiresStock && !stockActivo) return false;
    return true;
  });

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    toast.success("Sesión cerrada");
  }
  // ... rest of component JSX unchanged from current file
```

Note: The rest of the JSX in `AdminSidebar.tsx` (desktop sidebar, mobile drawer) is unchanged — only the imports, `navItems` array, `Props` type, and component signature + `visibleItems` filter change.

### Step 8.5 — Validate
```bash
npx tsc --noEmit
npm run lint
```

### Step 8.6 — Commit
```bash
git add app/api/admin/config/modulos/ app/admin/"(protected)"/layout.tsx components/admin/AdminLayoutClient.tsx components/admin/AdminSidebar.tsx
git commit -m "feat: add config_modulos API, extend sidebar with Cobros/POS/Stock nav items"
```

---

## Task 9 — Panel de Cobro en Reservas (UI)

**Files (NEW):**
- `components/admin/reservas/PanelCobro.tsx`

### Step 9.1 — Create `components/admin/reservas/PanelCobro.tsx`

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import type { CuentaBancaria, MedioPago } from "@/lib/facturacion/types";

type PagoRow = {
  medio_pago: MedioPago;
  monto: string;
  cuenta_bancaria_id: string;
  nombre_receptor: string;
};

type Props = {
  reservaId: string;
  total: number;
  cuentasBancarias: CuentaBancaria[];
  onSuccess: () => void;
};

const MEDIO_LABELS: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  otro: "Otro",
};

function emptyRow(): PagoRow {
  return { medio_pago: "efectivo", monto: "", cuenta_bancaria_id: "", nombre_receptor: "" };
}

export function PanelCobro({ reservaId, total, cuentasBancarias, onSuccess }: Props) {
  const [pagos, setPagos] = useState<PagoRow[]>([emptyRow()]);
  const [loading, setLoading] = useState(false);

  const registrado = pagos.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
  const completo = registrado >= total;

  function updateRow(idx: number, patch: Partial<PagoRow>) {
    setPagos((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setPagos((prev) => [...prev, emptyRow()]);
  }

  function removeRow(idx: number) {
    setPagos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleConfirmar() {
    // Validate
    for (const [i, p] of pagos.entries()) {
      if (!p.monto || parseFloat(p.monto) <= 0) {
        toast.error(`Fila ${i + 1}: el monto debe ser mayor a 0`);
        return;
      }
      if (p.medio_pago === "transferencia" && !p.cuenta_bancaria_id) {
        toast.error(`Fila ${i + 1}: seleccioná una cuenta bancaria para transferencia`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origen_tipo: "reserva",
          origen_id: reservaId,
          pagos: pagos.map((p) => ({
            medio_pago: p.medio_pago,
            monto: parseFloat(p.monto),
            cuenta_bancaria_id: p.cuenta_bancaria_id || null,
            nombre_receptor: p.nombre_receptor.trim() || undefined,
          })),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Error al registrar cobro");
        return;
      }

      const nComprobantes = (json.comprobantes as unknown[]).length;
      const nErrores = (json.errores_emision as unknown[] | undefined)?.length ?? 0;

      if (nComprobantes > 0 && nErrores === 0) {
        toast.success(`Cobro registrado. ${nComprobantes} factura(s) emitida(s).`);
      } else if (nComprobantes > 0 && nErrores > 0) {
        toast.success(`Cobro registrado. ${nErrores} factura(s) fallaron — revisar en Facturación.`);
      } else {
        toast.success("Cobro registrado.");
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Registrar cobro</p>

      <div className="space-y-2">
        {pagos.map((pago, idx) => (
          <div key={idx} className="flex flex-wrap items-start gap-2">
            {/* Medio de pago */}
            <Select
              value={pago.medio_pago}
              onValueChange={(v) => updateRow(idx, { medio_pago: v as MedioPago, cuenta_bancaria_id: "" })}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["efectivo", "transferencia", "otro"] as MedioPago[]).map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {MEDIO_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Monto */}
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="Monto"
              value={pago.monto}
              onChange={(e) => updateRow(idx, { monto: e.target.value })}
              className="h-8 w-28 text-xs"
            />

            {/* Cuenta bancaria — only for transferencia */}
            {pago.medio_pago === "transferencia" && (
              <Select
                value={pago.cuenta_bancaria_id}
                onValueChange={(v) => updateRow(idx, { cuenta_bancaria_id: v })}
              >
                <SelectTrigger className="h-8 w-48 text-xs">
                  <SelectValue placeholder="Cuenta bancaria" />
                </SelectTrigger>
                <SelectContent>
                  {cuentasBancarias
                    .filter((c) => c.activo)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.nombre_display}
                        {c.alias ? ` (${c.alias})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            {/* Nombre receptor (optional, for factura) */}
            {pago.medio_pago === "transferencia" && (
              <Input
                placeholder="Nombre receptor (opcional)"
                value={pago.nombre_receptor}
                onChange={(e) => updateRow(idx, { nombre_receptor: e.target.value })}
                className="h-8 w-44 text-xs"
              />
            )}

            {/* Remove row */}
            {pagos.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(idx)}
              >
                <X size={13} />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Add row */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs text-muted-foreground"
        onClick={addRow}
      >
        <Plus size={12} />
        Agregar forma de pago
      </Button>

      {/* Running total */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          Registrado:{" "}
          <span className={completo ? "text-green-600 font-medium" : "font-medium"}>
            ${registrado.toLocaleString("es-AR")}
          </span>
        </span>
        <span className="text-muted-foreground">
          Total: <span className="font-medium">${total.toLocaleString("es-AR")}</span>
        </span>
        {registrado > total && (
          <span className="text-amber-600 text-xs">
            Excede en ${(registrado - total).toLocaleString("es-AR")}
          </span>
        )}
      </div>

      {/* Confirm */}
      <Button
        size="sm"
        disabled={!completo || loading}
        onClick={handleConfirmar}
        className="w-full sm:w-auto"
      >
        {loading ? "Registrando..." : "Confirmar cobro"}
      </Button>
    </div>
  );
}
```

### Step 9.2 — Validate
```bash
npx tsc --noEmit
```

### Step 9.3 — Commit
```bash
git add components/admin/reservas/PanelCobro.tsx
git commit -m "feat: add PanelCobro component for multi-payment registration on reservas"
```

---

## Task 10 — Cobros UI Page

**Files (all NEW):**
- `app/admin/(protected)/cobros/page.tsx`
- `components/admin/CobrosClient.tsx`

### Step 10.1 — Create `app/admin/(protected)/cobros/page.tsx`

```typescript
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import CobrosClient from "@/components/admin/CobrosClient";

export default async function CobrosPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return <CobrosClient />;
}
```

### Step 10.2 — Create `components/admin/CobrosClient.tsx`

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronRight, ChevronDown, RefreshCw, Wallet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import type { CobroOrigen, EstadoFiscal, PagoConComprobante, MedioPago } from "@/lib/facturacion/types";

const ESTADO_FISCAL_CONFIG: Record<EstadoFiscal, { label: string; className: string }> = {
  facturado: { label: "Facturado", className: "bg-green-100 text-green-700 border-green-200" },
  mixto: { label: "Mixto", className: "bg-amber-100 text-amber-700 border-amber-200" },
  sin_comprobante: { label: "Sin comprobante", className: "bg-muted text-muted-foreground border-border" },
};

const MEDIO_LABELS: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  otro: "Otro",
};

function EstadoFiscalBadge({ estado }: { estado: EstadoFiscal }) {
  const cfg = ESTADO_FISCAL_CONFIG[estado];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.className}`}>
      {estado === "facturado" && <span className="mr-1">✓</span>}
      {cfg.label}
    </span>
  );
}

function PagoSubRow({ pago }: { pago: PagoConComprobante }) {
  return (
    <div className="flex items-center h-10 pl-10 pr-4 gap-3 bg-muted/30 border-t border-border/50">
      <span className="text-xs text-muted-foreground w-28 shrink-0">
        {MEDIO_LABELS[pago.medio_pago]}
      </span>
      <span className="text-sm font-medium shrink-0">
        ${Number(pago.monto).toLocaleString("es-AR")}
      </span>
      <div className="flex-1" />
      {pago.medio_pago === "transferencia" && pago.comprobante ? (
        <>
          <EstadoFiscalBadge estado={pago.comprobante.estado === "emitida" ? "facturado" : "sin_comprobante"} />
          {pago.comprobante.cae && (
            <span className="text-xs font-mono text-muted-foreground hidden md:inline">
              CAE: {pago.comprobante.cae}
            </span>
          )}
          <Link
            href={`/admin/facturacion?comprobante=${pago.comprobante.id}`}
            className="text-xs text-primary hover:underline shrink-0"
          >
            ver →
          </Link>
        </>
      ) : pago.medio_pago === "transferencia" ? (
        <EstadoFiscalBadge estado="sin_comprobante" />
      ) : null}
    </div>
  );
}

export default function CobrosClient() {
  const [cobros, setCobros] = useState<CobroOrigen[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      const res = await fetch(`/api/admin/cobros?${params}`);
      const json = await res.json();
      setCobros(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Error al cargar cobros");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-[#133D34]" />
            <h1 className="text-sm font-semibold">Cobros</h1>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden max-w-4xl">
          {/* Column headers */}
          <div className="flex items-center h-9 px-4 gap-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
            <div className="w-5 shrink-0" />
            <div className="flex-1">Origen</div>
            <div className="w-24 shrink-0 hidden sm:block">Fecha</div>
            <div className="w-24 shrink-0 text-right">Total</div>
            <div className="w-32 shrink-0">Estado fiscal</div>
          </div>

          {loading && cobros.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">Cargando...</p>
          ) : cobros.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">Sin cobros registrados.</p>
          ) : (
            <div className="divide-y divide-border">
              {cobros.map((cobro) => {
                const isExpanded = expanded.has(cobro.id);
                return (
                  <div key={`${cobro.tipo}:${cobro.id}`}>
                    {/* Main row */}
                    <div
                      className="flex items-center h-11 px-4 gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpanded(cobro.id)}
                    >
                      <div className="w-5 shrink-0 text-muted-foreground">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate">{cobro.descripcion}</span>
                        <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 capitalize">
                          {cobro.tipo}
                        </Badge>
                      </div>
                      <div className="w-24 shrink-0 hidden sm:block">
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(cobro.fecha), "dd/MM/yy", { locale: es })}
                        </span>
                      </div>
                      <div className="w-24 shrink-0 text-right">
                        <span className="text-sm font-medium">
                          ${Number(cobro.total).toLocaleString("es-AR")}
                        </span>
                      </div>
                      <div className="w-32 shrink-0">
                        <EstadoFiscalBadge estado={cobro.estado_fiscal} />
                      </div>
                    </div>

                    {/* Expanded: pago sub-rows */}
                    {isExpanded && cobro.pagos.map((pago) => (
                      <PagoSubRow key={pago.id} pago={pago} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 10.3 — Validate
```bash
npx tsc --noEmit
npm run lint
```

### Step 10.4 — Manual check
Navigate to `/admin/cobros`. Confirm: table renders, rows expand to show pagos, fiscal state badges appear, "ver →" links go to `/admin/facturacion?comprobante=ID`.

### Step 10.5 — Commit
```bash
git add app/admin/"(protected)"/cobros/ components/admin/CobrosClient.tsx
git commit -m "feat: add Cobros page with expandable rows and fiscal state badges"
```

---

## Task 11 — Comprobantes UI Updates

**Files:**
- `components/admin/facturacion/ComprobantesTab.tsx` (MODIFY)

### Step 11.1 — Add `Origen` and `Cuenta` columns

In the comprobantes row div (currently at line ~187 in ComprobantesTab.tsx), add two new elements between the date and the factura number:

```typescript
// After the date span, add origen badge:
{c.origen_tipo && (
  <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 capitalize">
    {c.origen_tipo}
  </Badge>
)}

// After the CAE span, add cuenta name:
{c.pago?.cuenta_bancaria?.nombre_display && (
  <span className="text-xs text-muted-foreground hidden lg:inline truncate">
    {c.pago.cuenta_bancaria.nombre_display}
  </span>
)}
```

Also update the `Comprobante` import in this file to ensure `pago` field is recognized. The type already includes it from Task 2.

### Step 11.2 — Validate
```bash
npx tsc --noEmit
```

### Step 11.3 — Commit
```bash
git add components/admin/facturacion/ComprobantesTab.tsx
git commit -m "feat: add Origen and Cuenta columns to ComprobantesTab"
```

---

## Task 12 — Config UI: Entidades Fiscales + Cuentas Bancarias + Módulos

**Files:**
- `components/admin/facturacion/ConfigFacturacionTab.tsx` (REPLACE)
- `components/admin/ConfigClient.tsx` (MODIFY — add Módulos tab section)

### Step 12.1 — Replace `components/admin/facturacion/ConfigFacturacionTab.tsx`

This file is replaced with a multi-section component covering entidades fiscales, cuentas bancarias, alícuotas IVA, and módulos:

```typescript
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, RefreshCw } from "lucide-react";
import type { EntidadFiscal, CuentaBancaria, IvaAlicuota, ConfigModulos } from "@/lib/facturacion/types";

// ─── Entidades Fiscales ────────────────────────────────────────────────────────

type EntidadForm = {
  nombre_interno: string;
  cuit: string;
  razon_social: string;
  domicilio: string;
  condicion_iva: string;
  punto_venta: string;
  afipsdk_token: string;
  modo: string;
  activo: boolean;
  predeterminada: boolean;
  cert_pem: string;
  key_pem: string;
};

function emptyEntidadForm(): EntidadForm {
  return {
    nombre_interno: "",
    cuit: "",
    razon_social: "",
    domicilio: "",
    condicion_iva: "monotributo",
    punto_venta: "",
    afipsdk_token: "",
    modo: "testing",
    activo: true,
    predeterminada: false,
    cert_pem: "",
    key_pem: "",
  };
}

function EntidadesFiscalesTab() {
  const [entidades, setEntidades] = useState<EntidadFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EntidadFiscal | null>(null);
  const [form, setForm] = useState<EntidadForm>(emptyEntidadForm());
  const [saving, setSaving] = useState(false);

  async function fetchEntidades() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/entidades-fiscales");
      const json = await res.json();
      setEntidades(Array.isArray(json) ? json : []);
    } catch {
      toast.error("Error al cargar entidades fiscales");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchEntidades(); }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyEntidadForm());
    setDialogOpen(true);
  }

  function openEdit(e: EntidadFiscal) {
    setEditing(e);
    setForm({
      nombre_interno: e.nombre_interno,
      cuit: e.cuit ?? "",
      razon_social: e.razon_social ?? "",
      domicilio: e.domicilio ?? "",
      condicion_iva: e.condicion_iva ?? "monotributo",
      punto_venta: e.punto_venta ? String(e.punto_venta) : "",
      afipsdk_token: e.afipsdk_token ?? "",
      modo: e.modo,
      activo: e.activo,
      predeterminada: e.predeterminada,
      cert_pem: "",
      key_pem: "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nombre_interno.trim()) { toast.error("Nombre interno requerido"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        nombre_interno: form.nombre_interno.trim(),
        cuit: form.cuit.trim() || null,
        razon_social: form.razon_social.trim() || null,
        domicilio: form.domicilio.trim() || null,
        condicion_iva: form.condicion_iva || null,
        punto_venta: form.punto_venta ? Number(form.punto_venta) : null,
        afipsdk_token: form.afipsdk_token.trim() || null,
        modo: form.modo,
        activo: form.activo,
        predeterminada: form.predeterminada,
      };
      if (form.cert_pem.trim()) body.cert_pem = form.cert_pem.trim();
      if (form.key_pem.trim()) body.key_pem = form.key_pem.trim();

      const res = editing
        ? await fetch(`/api/admin/entidades-fiscales/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/admin/entidades-fiscales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });

      if (res.ok) {
        toast.success(editing ? "Entidad actualizada" : "Entidad creada");
        setDialogOpen(false);
        fetchEntidades();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta entidad fiscal?")) return;
    const res = await fetch(`/api/admin/entidades-fiscales/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Entidad eliminada");
      fetchEntidades();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Error al eliminar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cada entidad representa un CUIT / punto de venta AFIP.
        </p>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={openCreate}>
          <Plus size={13} /> Nueva entidad
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Cargando...</p>
        ) : entidades.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin entidades configuradas.</p>
        ) : (
          <div className="divide-y divide-border">
            {entidades.map((e) => (
              <div key={e.id} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{e.nombre_interno}</span>
                    {e.predeterminada && (
                      <Badge className="text-[10px] px-1.5 py-0">Principal</Badge>
                    )}
                    {!e.activo && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">Inactiva</Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono capitalize">
                      {e.modo}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {e.cuit ? `CUIT: ${e.cuit}` : "Sin CUIT"}
                    {e.punto_venta ? ` · PV: ${e.punto_venta}` : ""}
                    {e.tiene_cert ? " · Cert ✓" : " · Sin cert"}
                    {e.tiene_key ? " · Key ✓" : " · Sin key"}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}>
                    <Pencil size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(e.id)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar entidad fiscal" : "Nueva entidad fiscal"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Nombre interno">
              <Input value={form.nombre_interno} onChange={e => setForm(f => ({ ...f, nombre_interno: e.target.value }))} className="h-9 text-sm" placeholder="Principal" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CUIT">
                <Input value={form.cuit} onChange={e => setForm(f => ({ ...f, cuit: e.target.value }))} className="h-9 text-sm font-mono" placeholder="20123456789" />
              </Field>
              <Field label="Punto de venta">
                <Input type="number" min={1} value={form.punto_venta} onChange={e => setForm(f => ({ ...f, punto_venta: e.target.value }))} className="h-9 text-sm" placeholder="1" />
              </Field>
            </div>
            <Field label="Razón social">
              <Input value={form.razon_social} onChange={e => setForm(f => ({ ...f, razon_social: e.target.value }))} className="h-9 text-sm" />
            </Field>
            <Field label="Domicilio">
              <Input value={form.domicilio} onChange={e => setForm(f => ({ ...f, domicilio: e.target.value }))} className="h-9 text-sm" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Condición IVA">
                <Select value={form.condicion_iva} onValueChange={v => setForm(f => ({ ...f, condicion_iva: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monotributo">Monotributo</SelectItem>
                    <SelectItem value="responsable_inscripto">Resp. Inscripto</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Modo AFIP">
                <Select value={form.modo} onValueChange={v => setForm(f => ({ ...f, modo: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="testing">Testing (sandbox)</SelectItem>
                    <SelectItem value="produccion">Producción</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Token AFIP SDK">
              <Input value={form.afipsdk_token} onChange={e => setForm(f => ({ ...f, afipsdk_token: e.target.value }))} className="h-9 text-sm font-mono" placeholder="sk_..." />
            </Field>
            <Field label={`Certificado (.pem)${editing?.tiene_cert ? " — dejar vacío para mantener el actual" : ""}`}>
              <textarea
                value={form.cert_pem}
                onChange={e => setForm(f => ({ ...f, cert_pem: e.target.value }))}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="-----BEGIN CERTIFICATE-----..."
              />
            </Field>
            <Field label={`Clave privada (.key)${editing?.tiene_key ? " — dejar vacío para mantener la actual" : ""}`}>
              <textarea
                value={form.key_pem}
                onChange={e => setForm(f => ({ ...f, key_pem: e.target.value }))}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="-----BEGIN RSA PRIVATE KEY-----..."
              />
            </Field>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="h-4 w-4 accent-primary" />
                Activa
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="checkbox" checked={form.predeterminada} onChange={e => setForm(f => ({ ...f, predeterminada: e.target.checked }))} className="h-4 w-4 accent-primary" />
                Predeterminada
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear entidad"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Cuentas Bancarias ────────────────────────────────────────────────────────

type CuentaForm = {
  nombre_display: string;
  banco: string;
  cbu: string;
  alias: string;
  entidad_fiscal_id: string;
  activo: boolean;
};

function CuentasBancariasTab({ entidades }: { entidades: EntidadFiscal[] }) {
  const [cuentas, setCuentas] = useState<CuentaBancaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CuentaBancaria | null>(null);
  const [form, setForm] = useState<CuentaForm>({
    nombre_display: "", banco: "", cbu: "", alias: "",
    entidad_fiscal_id: entidades[0]?.id ?? "", activo: true,
  });
  const [saving, setSaving] = useState(false);

  async function fetchCuentas() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cuentas-bancarias");
      const json = await res.json();
      setCuentas(Array.isArray(json) ? json : []);
    } catch {
      toast.error("Error al cargar cuentas bancarias");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchCuentas(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ nombre_display: "", banco: "", cbu: "", alias: "", entidad_fiscal_id: entidades[0]?.id ?? "", activo: true });
    setDialogOpen(true);
  }

  function openEdit(c: CuentaBancaria) {
    setEditing(c);
    setForm({ nombre_display: c.nombre_display, banco: c.banco ?? "", cbu: c.cbu ?? "", alias: c.alias ?? "", entidad_fiscal_id: c.entidad_fiscal_id, activo: c.activo });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nombre_display.trim()) { toast.error("Nombre requerido"); return; }
    if (!form.entidad_fiscal_id) { toast.error("Seleccioná una entidad fiscal"); return; }
    setSaving(true);
    try {
      const body = { nombre_display: form.nombre_display.trim(), banco: form.banco.trim() || null, cbu: form.cbu.trim() || null, alias: form.alias.trim() || null, entidad_fiscal_id: form.entidad_fiscal_id, activo: form.activo };
      const res = editing
        ? await fetch(`/api/admin/cuentas-bancarias/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/admin/cuentas-bancarias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        toast.success(editing ? "Cuenta actualizada" : "Cuenta creada");
        setDialogOpen(false);
        fetchCuentas();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Error al guardar");
      }
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta cuenta bancaria?")) return;
    const res = await fetch(`/api/admin/cuentas-bancarias/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Cuenta eliminada"); fetchCuentas(); }
    else { const json = await res.json().catch(() => ({})); toast.error(json.error ?? "Error al eliminar"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Cuentas bancarias para recibir transferencias.</p>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={openCreate}>
          <Plus size={13} /> Nueva cuenta
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Cargando...</p>
        ) : cuentas.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground text-center">Sin cuentas configuradas.</p>
        ) : (
          <div className="divide-y divide-border">
            {cuentas.map((c) => (
              <div key={c.id} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.nombre_display}</span>
                    {!c.activo && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Inactiva</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.banco ? `${c.banco} · ` : ""}{c.alias ? `Alias: ${c.alias}` : ""}{c.cbu ? ` · CBU: ${c.cbu}` : ""}
                    {c.entidad_fiscal && ` · ${c.entidad_fiscal.nombre_interno}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil size={13} /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}><Trash2 size={13} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar cuenta" : "Nueva cuenta bancaria"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <Field label="Nombre display">
              <Input value={form.nombre_display} onChange={e => setForm(f => ({ ...f, nombre_display: e.target.value }))} className="h-9 text-sm" placeholder="Ej: Cuenta Principal Santander" />
            </Field>
            <Field label="Entidad fiscal">
              <Select value={form.entidad_fiscal_id} onValueChange={v => setForm(f => ({ ...f, entidad_fiscal_id: v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccioná" /></SelectTrigger>
                <SelectContent>
                  {entidades.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre_interno}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Banco"><Input value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} className="h-9 text-sm" placeholder="Santander" /></Field>
              <Field label="Alias"><Input value={form.alias} onChange={e => setForm(f => ({ ...f, alias: e.target.value }))} className="h-9 text-sm font-mono" placeholder="mi.alias.mp" /></Field>
            </div>
            <Field label="CBU">
              <Input value={form.cbu} onChange={e => setForm(f => ({ ...f, cbu: e.target.value }))} className="h-9 text-sm font-mono" placeholder="0720..." />
            </Field>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="h-4 w-4 accent-primary" />
              Activa
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : editing ? "Guardar cambios" : "Crear cuenta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Alícuotas IVA ────────────────────────────────────────────────────────────

function AlicuotasIvaTab() {
  const [alicuotas, setAlicuotas] = useState<IvaAlicuota[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/config/iva-alicuotas")
      .then(r => r.json())
      .then(d => setAlicuotas(Array.isArray(d) ? d : []))
      .catch(() => toast.error("Error al cargar alícuotas"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Alícuotas IVA disponibles para comprobantes.</p>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <p className="px-4 py-4 text-sm text-muted-foreground text-center">Cargando...</p>
        ) : (
          <div className="divide-y divide-border">
            {alicuotas.map(a => (
              <div key={a.id} className="flex items-center h-10 px-4 gap-3">
                <span className="flex-1 text-sm font-medium">{a.nombre}</span>
                <span className="text-sm text-muted-foreground">{a.porcentaje}%</span>
                {a.predeterminada && <Badge className="text-[10px] px-1.5 py-0">Predeterminada</Badge>}
                {!a.activo && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Inactiva</Badge>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Módulos ──────────────────────────────────────────────────────────────────

function ModulosTab() {
  const [modulos, setModulos] = useState<ConfigModulos | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/config/modulos")
      .then(r => r.json())
      .then(d => setModulos(d))
      .catch(() => toast.error("Error al cargar módulos"))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: "facturacion" | "pos" | "stock") {
    if (!modulos) return;
    setSaving(key);
    const newVal = !modulos[key];
    const res = await fetch("/api/admin/config/modulos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: newVal }),
    });
    if (res.ok) {
      setModulos(prev => prev ? { ...prev, [key]: newVal } : prev);
      toast.success("Módulo actualizado");
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Error al actualizar");
    }
    setSaving(null);
  }

  if (loading) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  if (!modulos) return null;

  const items: { key: "facturacion" | "pos" | "stock"; label: string; description: string }[] = [
    { key: "facturacion", label: "Facturación electrónica", description: "Habilita la emisión de comprobantes AFIP/ARCA y la sección Facturación en el menú." },
    { key: "pos", label: "POS", description: "Habilita el punto de venta y la sección POS en el menú." },
    { key: "stock", label: "Stock", description: "Habilita la gestión de inventario y la sección Stock en el menú." },
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Activá o desactivá módulos del sistema.</p>
      <div className="space-y-3">
        {items.map(({ key, label, description }) => (
          <div key={key} className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <button
              disabled={saving === key}
              onClick={() => toggle(key)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${modulos[key] ? "bg-primary" : "bg-input"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${modulos[key] ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Shared helper ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────

export function ConfigFacturacionTab() {
  const [entidades, setEntidades] = useState<EntidadFiscal[]>([]);
  const [loadingEntidades, setLoadingEntidades] = useState(true);

  useEffect(() => {
    fetch("/api/admin/entidades-fiscales")
      .then(r => r.json())
      .then(d => setEntidades(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoadingEntidades(false));
  }, []);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="entidades">
        <TabsList className="w-max">
          <TabsTrigger value="entidades">Entidades fiscales</TabsTrigger>
          <TabsTrigger value="cuentas">Cuentas bancarias</TabsTrigger>
          <TabsTrigger value="alicuotas">Alícuotas IVA</TabsTrigger>
          <TabsTrigger value="modulos">Módulos</TabsTrigger>
        </TabsList>
        <TabsContent value="entidades" className="mt-4">
          <EntidadesFiscalesTab />
        </TabsContent>
        <TabsContent value="cuentas" className="mt-4">
          {loadingEntidades ? (
            <p className="text-sm text-muted-foreground">Cargando entidades...</p>
          ) : (
            <CuentasBancariasTab entidades={entidades} />
          )}
        </TabsContent>
        <TabsContent value="alicuotas" className="mt-4">
          <AlicuotasIvaTab />
        </TabsContent>
        <TabsContent value="modulos" className="mt-4">
          <ModulosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### Step 12.2 — Add a stub GET for iva-alicuotas (referenced in AlicuotasIvaTab)

Create `app/api/admin/config/iva-alicuotas/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("iva_alicuotas")
    .select("*")
    .order("porcentaje", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
```

### Step 12.3 — Validate
```bash
npx tsc --noEmit
npm run lint
npm run build
```

### Step 12.4 — Manual check
1. Go to `/admin/config` → "Facturación" tab
2. Confirm sub-tabs: Entidades fiscales, Cuentas bancarias, Alícuotas IVA, Módulos all render
3. Create a test entidad fiscal — confirm cert/key fields are never echoed back
4. Toggle a módulo — confirm sidebar updates on next navigation
5. Go to `/admin/cobros` — table renders (empty is fine)

### Step 12.5 — Commit
```bash
git add components/admin/facturacion/ConfigFacturacionTab.tsx app/api/admin/config/iva-alicuotas/ 
git commit -m "feat: replace ConfigFacturacionTab with multi-section UI (entidades, cuentas, alicuotas, modulos)"
```

---

## Final Validation Checklist

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Build
npm run build

# 4. Start dev and verify
npm run dev
```

Manual browser checks:
- [ ] `/admin/config` → Facturación tab → all 4 sub-tabs load
- [ ] Create entidad fiscal → cert/key not leaked in response
- [ ] Create cuenta bancaria → linked to entidad
- [ ] `/admin/cobros` → page renders without error
- [ ] Sidebar shows "Cobros" nav item always; "Facturación" only when `config_modulos.facturacion = true`
- [ ] `/admin/facturacion` → Comprobantes table shows `origen_tipo` badge and `cuenta_bancaria.nombre_display` column

---

## Implementation Order Summary

| # | Task | Key change |
|---|------|-----------|
| 1 | DB Migration | 6 new/altered tables |
| 2 | Types | New types in `lib/facturacion/types.ts` |
| 3 | afip-client refactor | `getAfipClient(id)` + `getAfipClientDefault()` |
| 4 | emitir refactor | `EmitirParams.pago_id` replaces `reserva_id` |
| 5 | Entidades + Cuentas API | 4 new route files |
| 6 | Pagos API | POST creates pagos + auto-emits |
| 7 | Cobros API | GET with fiscal state derivation |
| 8 | Módulos + Layout + Sidebar | config_modulos drives sidebar visibility |
| 9 | PanelCobro UI | Multi-row payment panel for reservas |
| 10 | Cobros UI | Paginated expandable table |
| 11 | ComprobantesTab updates | Origen + Cuenta columns |
| 12 | ConfigFacturacionTab | Full multi-section replacement |
