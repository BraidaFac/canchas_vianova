# Facturación Electrónica ARCA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Argentine electronic billing (ARCA/AFIP) into the admin panel — automatic emission on payment confirmation, manual retry UI for failures, and superadmin-managed configuration stored encrypted in Supabase.

**Architecture:** Single-row `config_facturacion` table stores CUIT, cert, and key encrypted with AES-256-GCM (master key in env var). `comprobantes` table tracks every invoice attempt with full ARCA request/response payloads. Auto-emission fires when a reserva reaches `confirmada` state; a Vercel cron retries failed ones every 10 minutes.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), `@afipsdk/afip.js` v1.2.3, Node.js `crypto` (AES-256-GCM), TypeScript, shadcn/ui, Tailwind CSS v4, Sonner toasts.

## Global Constraints

- Node.js built-in `crypto` only — no external encryption library
- `@afipsdk/afip.js` is the only ARCA client library
- All API routes: check `getSession()` first; superadmin-only routes check `session.rol !== "superadmin"`
- Never expose `cert_encrypted`, `key_encrypted`, or decrypted cert/key to the client
- All Supabase access via `createSupabaseServerClient()` from `lib/supabase/server.ts`
- Auth via `getSession()` from `lib/auth.ts` — returns `{ id, nombre, rol, telefono } | null`
- UI components: shadcn/ui pattern (`components/ui/`) — Button, Input, Badge, Dialog, Select, Tabs
- Toast notifications: `toast.success()` / `toast.error()` from `sonner`
- `router.refresh()` after mutations (no client-side state management)
- No test suite — verify each task manually using the steps provided
- `ENCRYPTION_KEY` env var: 32-byte hex string (64 hex chars), never in DB

---

## File Map

### New files
```
lib/facturacion/crypto.ts                              — AES-256-GCM encrypt/decrypt
lib/facturacion/types.ts                               — ConfigFacturacion, Comprobante types
lib/facturacion/afip-client.ts                         — getAfipClient() from DB config
lib/facturacion/emitir.ts                              — emitirFactura() core logic

app/api/admin/config/facturacion/route.ts              — GET/PATCH config (superadmin)
app/api/admin/facturacion/route.ts                     — GET comprobantes list, POST emit manual
app/api/admin/facturacion/[id]/route.ts                — GET detail, POST retry, PATCH anular
app/api/admin/facturacion/procesar-cola/route.ts       — Cron worker
app/api/admin/facturacion/status/route.ts              — ARCA health check (FEDummy)

app/admin/(protected)/facturacion/page.tsx             — Server page

components/admin/facturacion/FacturacionClient.tsx     — Main tabbed client component
components/admin/facturacion/ConfigFacturacionTab.tsx  — Superadmin config UI
components/admin/facturacion/ComprobantesTab.tsx       — Comprobantes list + actions

vercel.json                                            — Cron job definition
```

### Modified files
```
lib/types.ts                                           — Add ConfigFacturacion, Comprobante
components/admin/AdminSidebar.tsx                      — Add Facturación nav item
app/api/admin/reservas/[id]/route.ts                   — Trigger auto-emission on confirmada
```

---

## Task 1: Database Tables + SQL Migration

**Files:**
- Create: `docs/migrations/0004_facturacion.sql`

**Interfaces:**
- Produces: `config_facturacion` and `comprobantes` tables in Supabase

- [ ] **Step 1: Create migration SQL file**

Create `docs/migrations/0004_facturacion.sql`:

```sql
-- Configuración de facturación electrónica (fila única, id=1)
create table if not exists config_facturacion (
  id int primary key default 1,
  cuit text,
  razon_social text,
  domicilio text,
  condicion_iva text default 'monotributo',  -- 'monotributo' | 'responsable_inscripto'
  punto_venta int,
  afipsdk_token text,
  cert_encrypted text,   -- AES-256-GCM encrypted PEM certificate
  key_encrypted text,    -- AES-256-GCM encrypted RSA private key
  modo text default 'testing',   -- 'testing' | 'produccion'
  activo boolean default false,
  updated_at timestamptz default now()
);

-- Insertar fila única vacía si no existe
insert into config_facturacion (id) values (1) on conflict (id) do nothing;

-- Registro completo de todos los comprobantes
create table if not exists comprobantes (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references reservas(id) on delete set null,
  tipo_cbte int not null default 11,       -- 11=Factura C, 6=Factura B
  punto_venta int,
  nro_cbte bigint,                         -- null hasta confirmación ARCA
  fecha_cbte date not null,
  cae text,
  vencimiento_cae date,
  importe numeric(12,2) not null,
  concepto int default 2,                  -- 2=Servicios
  doc_tipo int default 99,                 -- 99=Consumidor Final
  doc_nro bigint default 0,
  nombre_receptor text,
  estado text default 'pendiente',         -- pendiente | emitida | fallida | anulada
  intentos int default 0,
  datos_envio jsonb,                       -- payload exacto enviado a ARCA
  datos_respuesta jsonb,                   -- respuesta completa de ARCA
  ultimo_error text,
  emitida_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists comprobantes_reserva_id_idx on comprobantes(reserva_id);
create index if not exists comprobantes_estado_idx on comprobantes(estado);
create index if not exists comprobantes_created_at_idx on comprobantes(created_at desc);
create unique index if not exists comprobantes_unique_nro
  on comprobantes(punto_venta, nro_cbte, tipo_cbte)
  where nro_cbte is not null;
```

- [ ] **Step 2: Run migration in Supabase**

Go to Supabase Dashboard → SQL Editor → paste contents of `0004_facturacion.sql` → Run.

- [ ] **Step 3: Verify tables**

In Supabase Dashboard → Table Editor: confirm `config_facturacion` (1 row, id=1) and `comprobantes` (0 rows) exist.

- [ ] **Step 4: Commit**

```bash
git add docs/migrations/0004_facturacion.sql
git commit -m "feat: add config_facturacion and comprobantes tables"
```

---

## Task 2: ENCRYPTION_KEY env var + Crypto lib

**Files:**
- Create: `lib/facturacion/crypto.ts`
- Modify: `.env` (local), Vercel env vars (production)

**Interfaces:**
- Produces:
  - `encrypt(text: string): string` — returns `"ivHex:tagHex:ciphertextHex"`
  - `decrypt(stored: string): string` — reverses encrypt

- [ ] **Step 1: Generate ENCRYPTION_KEY**

Run in terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the 64-char hex string.

- [ ] **Step 2: Add to .env**

Add to `.env` (never commit this file):

```
ENCRYPTION_KEY=<paste_64_char_hex_here>
```

- [ ] **Step 3: Create crypto.ts**

Create `lib/facturacion/crypto.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts a plaintext string with AES-256-GCM.
 * Returns a colon-separated string: "ivHex:tagHex:ciphertextHex"
 */
export function encrypt(text: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

/**
 * Decrypts a string produced by encrypt().
 * Input format: "ivHex:tagHex:ciphertextHex"
 */
export function decrypt(stored: string): string {
  const key = getKey();
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted format");
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
```

- [ ] **Step 4: Verify manually**

Create a temporary test script `scripts/test-crypto.mjs`:

```js
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { config } from "dotenv";
config();

const ALGO = "aes-256-gcm";
const key = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const text = "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----";

const iv = randomBytes(12);
const cipher = createCipheriv(ALGO, key, iv);
const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();
const stored = [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");

const parts = stored.split(":");
const decipher = createDecipheriv(ALGO, key, Buffer.from(parts[0], "hex"));
decipher.setAuthTag(Buffer.from(parts[1], "hex"));
const decrypted = Buffer.concat([decipher.update(Buffer.from(parts[2], "hex")), decipher.final()]).toString("utf8");

console.log("MATCH:", text === decrypted ? "✓ OK" : "✗ FAIL");
```

Run: `node scripts/test-crypto.mjs`
Expected output: `MATCH: ✓ OK`

Delete `scripts/test-crypto.mjs` after verifying.

- [ ] **Step 5: Commit**

```bash
git add lib/facturacion/crypto.ts
git commit -m "feat: add AES-256-GCM crypto lib for certificate encryption"
```

---

## Task 3: Types + Install SDK

**Files:**
- Modify: `lib/types.ts`
- Create: `lib/facturacion/types.ts`

**Interfaces:**
- Produces:
  - `ConfigFacturacion` type (public, for UI)
  - `ConfigFacturacionRaw` type (with encrypted fields, internal)
  - `Comprobante` type
  - `ComprobanteEstado = "pendiente" | "emitida" | "fallida" | "anulada"`

- [ ] **Step 1: Install SDK**

```bash
npm install @afipsdk/afip.js
```

Expected: package added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Create lib/facturacion/types.ts**

```typescript
export type ComprobanteEstado = "pendiente" | "emitida" | "fallida" | "anulada";
export type CondicionIVA = "monotributo" | "responsable_inscripto";
export type ModoAfip = "testing" | "produccion";

export type ConfigFacturacion = {
  id: 1;
  cuit: string | null;
  razon_social: string | null;
  domicilio: string | null;
  condicion_iva: CondicionIVA;
  punto_venta: number | null;
  afipsdk_token: string | null;
  tiene_cert: boolean;       // true si cert_encrypted != null (nunca exponer el cert al cliente)
  tiene_key: boolean;        // true si key_encrypted != null
  modo: ModoAfip;
  activo: boolean;
  updated_at: string;
};

// Tipo interno con campos encriptados — solo usado en server
export type ConfigFacturacionRaw = Omit<ConfigFacturacion, "tiene_cert" | "tiene_key"> & {
  cert_encrypted: string | null;
  key_encrypted: string | null;
};

export type Comprobante = {
  id: string;
  reserva_id: string | null;
  tipo_cbte: number;
  punto_venta: number | null;
  nro_cbte: number | null;
  fecha_cbte: string;        // YYYY-MM-DD
  cae: string | null;
  vencimiento_cae: string | null;
  importe: number;
  concepto: number;
  doc_tipo: number;
  doc_nro: number;
  nombre_receptor: string | null;
  estado: ComprobanteEstado;
  intentos: number;
  datos_envio: Record<string, unknown> | null;
  datos_respuesta: Record<string, unknown> | null;
  ultimo_error: string | null;
  emitida_at: string | null;
  created_at: string;
  // joined
  reserva?: { id: string; id_legible: string; fecha: string } | null;
};
```

- [ ] **Step 3: Add to lib/types.ts**

Add at the end of `lib/types.ts`:

```typescript
export type { ConfigFacturacion, ConfigFacturacionRaw, Comprobante, ComprobanteEstado } from "./facturacion/types";
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/facturacion/types.ts lib/types.ts package.json package-lock.json
git commit -m "feat: add facturacion types and install @afipsdk/afip.js"
```

---

## Task 4: Afip Client + Core Emission Logic

**Files:**
- Create: `lib/facturacion/afip-client.ts`
- Create: `lib/facturacion/emitir.ts`

**Interfaces:**
- Consumes: `encrypt`, `decrypt` from `lib/facturacion/crypto.ts`; `ConfigFacturacionRaw` from `lib/facturacion/types.ts`
- Produces:
  - `getAfipClient(): Promise<{ client: Afip; config: ConfigFacturacionRaw }>`
  - `emitirFactura(params: EmitirParams): Promise<{ cae: string; nroCbte: number; comprobanteId: string }>`
  - `type EmitirParams = { reservaId: string | null; monto: number; fechaReserva: string; nombreReceptor?: string }`

- [ ] **Step 1: Create lib/facturacion/afip-client.ts**

```typescript
import Afip from "@afipsdk/afip.js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { decrypt } from "./crypto";
import type { ConfigFacturacionRaw } from "./types";

export async function getAfipClient(): Promise<{
  client: InstanceType<typeof Afip>;
  config: ConfigFacturacionRaw;
}> {
  const supabase = await createSupabaseServerClient();
  const { data: config, error } = await supabase
    .from("config_facturacion")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !config) throw new Error("Configuración de facturación no encontrada");
  if (!config.activo) throw new Error("Facturación electrónica no está activada");
  if (!config.cuit) throw new Error("CUIT no configurado");
  if (!config.punto_venta) throw new Error("Punto de venta no configurado");
  if (!config.afipsdk_token) throw new Error("Token de AFIP SDK no configurado");
  if (!config.cert_encrypted || !config.key_encrypted)
    throw new Error("Certificado digital no cargado");

  const client = new Afip({
    CUIT: Number(config.cuit),
    access_token: config.afipsdk_token,
    production: config.modo === "produccion",
    cert: decrypt(config.cert_encrypted),
    key: decrypt(config.key_encrypted),
  });

  return { client, config: config as ConfigFacturacionRaw };
}
```

- [ ] **Step 2: Create lib/facturacion/emitir.ts**

```typescript
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAfipClient } from "./afip-client";

export type EmitirParams = {
  reservaId: string | null;
  monto: number;
  fechaReserva: string;    // YYYY-MM-DD — fecha del servicio
  nombreReceptor?: string;
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
  const { reservaId, monto, fechaReserva, nombreReceptor } = params;
  const supabase = await createSupabaseServerClient();
  const fechaHoy = new Date().toISOString().slice(0, 10);

  // Insertar comprobante en estado pendiente ANTES de llamar a ARCA
  // Si ARCA falla, el registro queda para reintento por el cron
  const { data: cbte, error: insertErr } = await supabase
    .from("comprobantes")
    .insert({
      reserva_id: reservaId,
      fecha_cbte: fechaHoy,
      importe: monto,
      nombre_receptor: nombreReceptor ?? null,
      estado: "pendiente",
    })
    .select()
    .single();

  if (insertErr || !cbte) throw new Error("Error al crear registro de comprobante");

  try {
    const { client, config } = await getAfipClient();
    const puntoVenta = config.punto_venta!;

    // Tipo comprobante según condición IVA del emisor
    // monotributo → Factura C (11), responsable_inscripto → Factura B (6)
    const tipoCbte = config.condicion_iva === "responsable_inscripto" ? 6 : 11;

    const ultimoNro = await client.ElectronicBilling.getLastVoucher(
      puntoVenta,
      tipoCbte
    );
    const nroCbte = ultimoNro + 1;

    const payload = {
      CantReg: 1,
      PtoVta: puntoVenta,
      CbteTipo: tipoCbte,
      Concepto: 2,                    // 2 = Servicios (reservas de cancha)
      DocTipo: 99,                    // 99 = Consumidor Final
      DocNro: 0,
      CbteDesde: nroCbte,
      CbteHasta: nroCbte,
      CbteFch: toDateInt(fechaHoy),
      ImpTotal: monto,
      ImpTotConc: 0,
      ImpNeto: monto,
      ImpOpEx: 0,
      ImpIVA: 0,
      ImpTrib: 0,
      MonId: "PES",
      MonCotiz: 1,
      CondicionIVAReceptorId: 5,      // 5 = Consumidor Final
      // Obligatorios para Concepto 2 (Servicios):
      FchServDesde: toDateInt(fechaReserva),
      FchServHasta: toDateInt(fechaReserva),
      FchVtoPago: toDateInt(fechaHoy),
    };

    // Guardar payload antes de enviar (para debug si falla durante el envío)
    await supabase
      .from("comprobantes")
      .update({
        tipo_cbte: tipoCbte,
        punto_venta: puntoVenta,
        nro_cbte: nroCbte,
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
      .update({
        estado: "fallida",
        intentos: 1,
        ultimo_error: msg,
      })
      .eq("id", cbte.id);
    throw err;
  }
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/facturacion/afip-client.ts lib/facturacion/emitir.ts
git commit -m "feat: add afip-client and core emitir logic"
```

---

## Task 5: Config API (Superadmin)

**Files:**
- Create: `app/api/admin/config/facturacion/route.ts`
- Create: `app/api/admin/facturacion/status/route.ts`

**Interfaces:**
- Consumes: `encrypt` from `lib/facturacion/crypto.ts`; `getAfipClient` from `lib/facturacion/afip-client.ts`
- Produces:
  - `GET /api/admin/config/facturacion` → `ConfigFacturacion` (sin campos encriptados, con `tiene_cert`, `tiene_key`)
  - `PATCH /api/admin/config/facturacion` → body campos opcionales: `cuit`, `razon_social`, `domicilio`, `condicion_iva`, `punto_venta`, `afipsdk_token`, `cert_pem` (texto plano del cert), `key_pem` (texto plano de la key), `modo`, `activo`
  - `GET /api/admin/facturacion/status` → `{ appServer: string; dbServer: string; authServer: string; ok: boolean }`

- [ ] **Step 1: Create app/api/admin/config/facturacion/route.ts**

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
    .from("config_facturacion")
    .select("id, cuit, razon_social, domicilio, condicion_iva, punto_venta, afipsdk_token, cert_encrypted, key_encrypted, modo, activo, updated_at")
    .eq("id", 1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Nunca enviar los campos encriptados al cliente
  const { cert_encrypted, key_encrypted, ...rest } = data;
  return NextResponse.json({
    ...rest,
    tiene_cert: !!cert_encrypted,
    tiene_key: !!key_encrypted,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();

  const allowed = ["cuit", "razon_social", "domicilio", "condicion_iva", "punto_venta", "afipsdk_token", "modo", "activo"] as const;
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Cert y key llegan en texto plano, se encriptan antes de guardar
  if (body.cert_pem && typeof body.cert_pem === "string" && body.cert_pem.trim()) {
    updates.cert_encrypted = encrypt(body.cert_pem.trim());
  }
  if (body.key_pem && typeof body.key_pem === "string" && body.key_pem.trim()) {
    updates.key_encrypted = encrypt(body.key_pem.trim());
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("config_facturacion")
    .update(updates)
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Create app/api/admin/facturacion/status/route.ts**

```typescript
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAfipClient } from "@/lib/facturacion/afip-client";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { client } = await getAfipClient();
    const status = await client.ElectronicBilling.getServerStatus();
    const ok = status.AppServer === "OK" && status.DbServer === "OK" && status.AuthServer === "OK";
    return NextResponse.json({
      appServer: status.AppServer,
      dbServer: status.DbServer,
      authServer: status.AuthServer,
      ok,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 503 });
  }
}
```

- [ ] **Step 3: Test with curl (testing environment)**

```bash
# Should return 401 without session
curl http://localhost:3000/api/admin/config/facturacion

# Should return 403 for non-superadmin (test with admin session)
# Should return config JSON for superadmin session
```

Expected for unauthenticated: `{"error":"No autorizado"}`

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/config/facturacion/route.ts app/api/admin/facturacion/status/route.ts
git commit -m "feat: add facturacion config and status API endpoints"
```

---

## Task 6: Comprobantes API + Cron Worker

**Files:**
- Create: `app/api/admin/facturacion/route.ts`
- Create: `app/api/admin/facturacion/[id]/route.ts`
- Create: `app/api/admin/facturacion/procesar-cola/route.ts`
- Create: `vercel.json`

**Interfaces:**
- Consumes: `emitirFactura` from `lib/facturacion/emitir.ts`; `getAfipClient` from `lib/facturacion/afip-client.ts`
- Produces:
  - `GET /api/admin/facturacion?estado=&desde=&hasta=&page=` → `{ data: Comprobante[]; total: number }`
  - `POST /api/admin/facturacion` body `{ reserva_id?, monto, fecha_reserva, nombre_receptor? }` → `{ cae, nro_cbte, comprobante_id }`
  - `GET /api/admin/facturacion/[id]` → `Comprobante` (con datos_envio y datos_respuesta)
  - `POST /api/admin/facturacion/[id]` (reintentar) → `{ cae, nro_cbte }`
  - `PATCH /api/admin/facturacion/[id]` body `{ estado: "anulada", cae_manual? }` → `Comprobante`
  - `GET /api/admin/facturacion/procesar-cola` (cron) → `{ ok: boolean; procesados: number }`

- [ ] **Step 1: Create app/api/admin/facturacion/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { emitirFactura } from "@/lib/facturacion/emitir";

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
    .select("*, reserva:reservas(id, id_legible, fecha)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (estado) query = query.eq("estado", estado);
  if (desde) query = query.gte("fecha_cbte", desde);
  if (hasta) query = query.lte("fecha_cbte", hasta);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [], total: count ?? 0 });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { reserva_id, monto, fecha_reserva, nombre_receptor } = body;

  if (!monto || Number(monto) <= 0) {
    return NextResponse.json({ error: "monto debe ser mayor a 0" }, { status: 400 });
  }
  if (!fecha_reserva) {
    return NextResponse.json({ error: "fecha_reserva es requerida" }, { status: 400 });
  }

  try {
    const result = await emitirFactura({
      reservaId: reserva_id ?? null,
      monto: Number(monto),
      fechaReserva: fecha_reserva,
      nombreReceptor: nombre_receptor,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
```

- [ ] **Step 2: Create app/api/admin/facturacion/[id]/route.ts**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { getAfipClient } from "@/lib/facturacion/afip-client";

function toDateInt(dateStr: string): number {
  return parseInt(dateStr.replace(/-/g, ""), 10);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("comprobantes")
    .select("*, reserva:reservas(id, id_legible, fecha)")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

// POST = reintentar emisión de un comprobante fallido
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: cbte, error: fetchErr } = await supabase
    .from("comprobantes")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchErr || !cbte) return NextResponse.json({ error: "Comprobante no encontrado" }, { status: 404 });
  if (cbte.estado === "emitida") return NextResponse.json({ error: "Comprobante ya emitido" }, { status: 400 });
  if (cbte.estado === "anulada") return NextResponse.json({ error: "Comprobante anulado" }, { status: 400 });

  try {
    const { client, config } = await getAfipClient();
    const puntoVenta = config.punto_venta!;
    const tipoCbte = config.condicion_iva === "responsable_inscripto" ? 6 : 11;
    const ultimoNro = await client.ElectronicBilling.getLastVoucher(puntoVenta, tipoCbte);
    const nroCbte = ultimoNro + 1;
    const fechaHoy = new Date().toISOString().slice(0, 10);

    const payload = {
      ...(cbte.datos_envio as Record<string, unknown> ?? {}),
      CbteDesde: nroCbte,
      CbteHasta: nroCbte,
      CbteFch: toDateInt(fechaHoy),
      FchVtoPago: toDateInt(fechaHoy),
    };

    const respuesta = await client.ElectronicBilling.createVoucher(payload);
    const vencimientoStr = String(respuesta.CAEFchVto);
    const vencimiento = `${vencimientoStr.slice(0, 4)}-${vencimientoStr.slice(4, 6)}-${vencimientoStr.slice(6, 8)}`;

    await supabase
      .from("comprobantes")
      .update({
        estado: "emitida",
        nro_cbte: nroCbte,
        cae: respuesta.CAE,
        vencimiento_cae: vencimiento,
        datos_respuesta: respuesta as Record<string, unknown>,
        emitida_at: new Date().toISOString(),
        intentos: cbte.intentos + 1,
        ultimo_error: null,
      })
      .eq("id", id);

    return NextResponse.json({ cae: respuesta.CAE, nro_cbte: nroCbte });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("comprobantes")
      .update({ intentos: cbte.intentos + 1, ultimo_error: msg })
      .eq("id", id);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

// PATCH = actualizar estado (anular, o cargar CAE manualmente)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.estado === "anulada") updates.estado = "anulada";
  if (body.cae_manual) {
    updates.cae = body.cae_manual;
    updates.estado = "emitida";
    updates.emitida_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("comprobantes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 3: Create app/api/admin/facturacion/procesar-cola/route.ts**

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAfipClient } from "@/lib/facturacion/afip-client";

function toDateInt(dateStr: string): number {
  return parseInt(dateStr.replace(/-/g, ""), 10);
}

// Called by Vercel Cron every 10 minutes
// Also callable manually by superadmin
export async function GET() {
  const supabase = await createSupabaseServerClient();

  const { data: pendientes } = await supabase
    .from("comprobantes")
    .select("*")
    .in("estado", ["pendiente", "fallida"])
    .lt("intentos", 3)
    .order("created_at")
    .limit(10);

  if (!pendientes?.length) {
    return NextResponse.json({ ok: true, procesados: 0, mensaje: "Sin pendientes" });
  }

  // Health check antes de intentar
  try {
    const { client, config } = await getAfipClient();
    const status = await client.ElectronicBilling.getServerStatus();
    if (status.AppServer !== "OK" || status.DbServer !== "OK") {
      return NextResponse.json({ ok: false, razon: "ARCA offline", procesados: 0 });
    }

    const tipoCbte = config.condicion_iva === "responsable_inscripto" ? 6 : 11;
    const puntoVenta = config.punto_venta!;
    let procesados = 0;

    for (const cbte of pendientes) {
      try {
        const ultimoNro = await client.ElectronicBilling.getLastVoucher(puntoVenta, tipoCbte);
        const nroCbte = ultimoNro + 1;
        const fechaHoy = new Date().toISOString().slice(0, 10);

        const payload = {
          ...(cbte.datos_envio as Record<string, unknown> ?? {}),
          CbteDesde: nroCbte,
          CbteHasta: nroCbte,
          CbteFch: toDateInt(fechaHoy),
          FchVtoPago: toDateInt(fechaHoy),
        };

        const respuesta = await client.ElectronicBilling.createVoucher(payload);
        const vencimientoStr = String(respuesta.CAEFchVto);
        const vencimiento = `${vencimientoStr.slice(0, 4)}-${vencimientoStr.slice(4, 6)}-${vencimientoStr.slice(6, 8)}`;

        await supabase
          .from("comprobantes")
          .update({
            estado: "emitida",
            nro_cbte: nroCbte,
            punto_venta: puntoVenta,
            tipo_cbte: tipoCbte,
            cae: respuesta.CAE,
            vencimiento_cae: vencimiento,
            datos_respuesta: respuesta as Record<string, unknown>,
            emitida_at: new Date().toISOString(),
            intentos: cbte.intentos + 1,
            ultimo_error: null,
          })
          .eq("id", cbte.id);

        procesados++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const newIntentos = cbte.intentos + 1;
        await supabase
          .from("comprobantes")
          .update({
            intentos: newIntentos,
            ultimo_error: msg,
            estado: newIntentos >= 3 ? "fallida" : cbte.estado,
          })
          .eq("id", cbte.id);
      }
    }

    return NextResponse.json({ ok: true, procesados });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg, procesados: 0 }, { status: 503 });
  }
}
```

- [ ] **Step 4: Create vercel.json**

```json
{
  "crons": [
    {
      "path": "/api/admin/facturacion/procesar-cola",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/facturacion/ vercel.json
git commit -m "feat: add comprobantes CRUD API and cron worker"
```

---

## Task 7: Config UI (Superadmin Tab)

**Files:**
- Create: `components/admin/facturacion/ConfigFacturacionTab.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/admin/config/facturacion` → `ConfigFacturacion`
  - `PATCH /api/admin/config/facturacion` → fields
  - `GET /api/admin/facturacion/status` → `{ ok, appServer, dbServer, authServer }`
- Produces: Visual config panel with ARCA status badge, cert upload, and all config fields

- [ ] **Step 1: Create components/admin/facturacion/ConfigFacturacionTab.tsx**

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
import { toast } from "sonner";
import { RefreshCw, CheckCircle, XCircle, Upload } from "lucide-react";
import type { ConfigFacturacion } from "@/lib/types";

type ArStatus = { ok: boolean; appServer?: string; dbServer?: string; authServer?: string; error?: string } | null;

export function ConfigFacturacionTab() {
  const [config, setConfig] = useState<ConfigFacturacion | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [arStatus, setArStatus] = useState<ArStatus>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  // Form state
  const [cuit, setCuit] = useState("");
  const [razonSocial, setRazonSocial] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [condicionIva, setCondicionIva] = useState<"monotributo" | "responsable_inscripto">("monotributo");
  const [puntoVenta, setPuntoVenta] = useState("");
  const [afipsdkToken, setAfipsdkToken] = useState("");
  const [modo, setModo] = useState<"testing" | "produccion">("testing");
  const [activo, setActivo] = useState(false);
  const [certPem, setCertPem] = useState("");
  const [keyPem, setKeyPem] = useState("");

  useEffect(() => {
    fetch("/api/admin/config/facturacion")
      .then((r) => r.json())
      .then((data: ConfigFacturacion) => {
        setConfig(data);
        setCuit(data.cuit ?? "");
        setRazonSocial(data.razon_social ?? "");
        setDomicilio(data.domicilio ?? "");
        setCondicionIva(data.condicion_iva ?? "monotributo");
        setPuntoVenta(String(data.punto_venta ?? ""));
        setAfipsdkToken(data.afipsdk_token ?? "");
        setModo(data.modo ?? "testing");
        setActivo(data.activo ?? false);
      })
      .catch(() => toast.error("Error al cargar configuración"))
      .finally(() => setLoading(false));
  }, []);

  async function checkStatus() {
    setCheckingStatus(true);
    try {
      const res = await fetch("/api/admin/facturacion/status");
      const data = await res.json();
      setArStatus(data);
    } catch {
      setArStatus({ ok: false, error: "No se pudo conectar" });
    } finally {
      setCheckingStatus(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        cuit: cuit.trim(),
        razon_social: razonSocial.trim(),
        domicilio: domicilio.trim(),
        condicion_iva: condicionIva,
        punto_venta: puntoVenta ? Number(puntoVenta) : null,
        afipsdk_token: afipsdkToken.trim(),
        modo,
        activo,
      };
      if (certPem.trim()) body.cert_pem = certPem.trim();
      if (keyPem.trim()) body.key_pem = keyPem.trim();

      const res = await fetch("/api/admin/config/facturacion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success("Configuración guardada");
        setCertPem("");
        setKeyPem("");
        setConfig((prev) =>
          prev
            ? {
                ...prev,
                cuit: cuit.trim() || null,
                razon_social: razonSocial.trim() || null,
                domicilio: domicilio.trim() || null,
                condicion_iva: condicionIva,
                punto_venta: puntoVenta ? Number(puntoVenta) : null,
                afipsdk_token: afipsdkToken.trim() || null,
                modo,
                activo,
                tiene_cert: certPem.trim() ? true : prev.tiene_cert,
                tiene_key: keyPem.trim() ? true : prev.tiene_key,
              }
            : prev
        );
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground py-4">Cargando...</p>;

  return (
    <div className="space-y-6 max-w-lg">
      {/* ARCA Status */}
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Estado de ARCA</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {arStatus === null
                ? "Sin verificar"
                : arStatus.ok
                ? `App: ${arStatus.appServer} · DB: ${arStatus.dbServer} · Auth: ${arStatus.authServer}`
                : arStatus.error ?? "Error de conexión"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {arStatus !== null && (
              arStatus.ok
                ? <CheckCircle size={16} className="text-green-500" />
                : <XCircle size={16} className="text-destructive" />
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={checkStatus}
              disabled={checkingStatus}
            >
              <RefreshCw size={12} className={checkingStatus ? "animate-spin" : ""} />
              Verificar
            </Button>
          </div>
        </div>
      </div>

      {/* Datos empresa */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/40">
          <h3 className="text-sm font-semibold">Datos del emisor</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">CUIT</label>
            <Input value={cuit} onChange={(e) => setCuit(e.target.value)} className="h-9 text-sm" placeholder="20-12345678-9" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Razón social</label>
            <Input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className="h-9 text-sm" placeholder="Nombre del complejo" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Domicilio fiscal</label>
            <Input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} className="h-9 text-sm" placeholder="Dirección" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Condición IVA</label>
              <Select value={condicionIva} onValueChange={(v) => setCondicionIva(v as typeof condicionIva)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monotributo">Monotributista</SelectItem>
                  <SelectItem value="responsable_inscripto">Resp. Inscripto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Punto de venta</label>
              <Input type="number" min={1} value={puntoVenta} onChange={(e) => setPuntoVenta(e.target.value)} className="h-9 text-sm" placeholder="1" />
            </div>
          </div>
        </div>
      </div>

      {/* SDK + Modo */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/40">
          <h3 className="text-sm font-semibold">Conexión AFIP SDK</h3>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Access Token (<a href="https://app.afipsdk.com" target="_blank" rel="noreferrer" className="underline">app.afipsdk.com</a>)
            </label>
            <Input value={afipsdkToken} onChange={(e) => setAfipsdkToken(e.target.value)} className="h-9 text-sm font-mono" placeholder="sdk_..." />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Modo</label>
            <Select value={modo} onValueChange={(v) => setModo(v as typeof modo)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="testing">Testing (homologación)</SelectItem>
                <SelectItem value="produccion">Producción</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Certificado digital */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Certificado digital</h3>
          <div className="flex gap-2">
            {config?.tiene_cert && <Badge variant="default" className="text-[11px]">Cert cargado</Badge>}
            {config?.tiene_key && <Badge variant="default" className="text-[11px]">Key cargada</Badge>}
          </div>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Pegá el contenido del archivo <code>.crt</code> y <code>.key</code> generados para ARCA. Se encriptan antes de guardarse.
          </p>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Upload size={11} /> Certificado (.crt) — dejar vacío para no modificar
            </label>
            <textarea
              value={certPem}
              onChange={(e) => setCertPem(e.target.value)}
              rows={4}
              className="w-full text-xs font-mono border border-input rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Upload size={11} /> Clave privada (.key) — dejar vacío para no modificar
            </label>
            <textarea
              value={keyPem}
              onChange={(e) => setKeyPem(e.target.value)}
              rows={4}
              className="w-full text-xs font-mono border border-input rounded-md px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
            />
          </div>
        </div>
      </div>

      {/* Activar + Guardar */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            onClick={() => setActivo((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${activo ? "bg-primary" : "bg-input"}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${activo ? "translate-x-5" : "translate-x-0"}`} />
          </button>
          <span className="text-sm font-medium">Facturación activa</span>
        </label>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? "Guardando..." : "Guardar configuración"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/facturacion/ConfigFacturacionTab.tsx
git commit -m "feat: add ConfigFacturacionTab component"
```

---

## Task 8: Comprobantes UI

**Files:**
- Create: `components/admin/facturacion/ComprobantesTab.tsx`

**Interfaces:**
- Consumes:
  - `GET /api/admin/facturacion` → `{ data: Comprobante[]; total: number }`
  - `POST /api/admin/facturacion/[id]` (reintentar)
  - `PATCH /api/admin/facturacion/[id]` (anular, CAE manual)
- Produces: Paginated table with estado filter, detail dialog, retry/anular actions

- [ ] **Step 1: Create components/admin/facturacion/ComprobantesTab.tsx**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import { RefreshCw, Eye, RotateCcw, XCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Comprobante, ComprobanteEstado } from "@/lib/types";

const ESTADO_LABELS: Record<ComprobanteEstado, string> = {
  pendiente: "Pendiente",
  emitida: "Emitida",
  fallida: "Fallida",
  anulada: "Anulada",
};

const ESTADO_VARIANT: Record<ComprobanteEstado, "default" | "outline" | "destructive" | "secondary"> = {
  pendiente: "secondary",
  emitida: "default",
  fallida: "destructive",
  anulada: "outline",
};

const TIPO_LABELS: Record<number, string> = {
  6: "Factura B",
  11: "Factura C",
};

export function ComprobantesTab() {
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("all");
  const [detalle, setDetalle] = useState<Comprobante | null>(null);
  const [caeManual, setCaeManual] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filtroEstado !== "all") params.set("estado", filtroEstado);
    try {
      const res = await fetch(`/api/admin/facturacion?${params}`);
      const json = await res.json();
      setComprobantes(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Error al cargar comprobantes");
    } finally {
      setLoading(false);
    }
  }, [page, filtroEstado]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleReintentar(id: string) {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/admin/facturacion/${id}`, { method: "POST" });
      if (res.ok) {
        toast.success("Comprobante emitido correctamente");
        fetchData();
        setDetalle(null);
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Error al reintentar");
      }
    } finally {
      setRetryingId(null);
    }
  }

  async function handleAnular(id: string) {
    const res = await fetch(`/api/admin/facturacion/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "anulada" }),
    });
    if (res.ok) {
      toast.success("Comprobante anulado");
      fetchData();
      setDetalle(null);
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Error al anular");
    }
  }

  async function handleCaeManual(id: string) {
    if (!caeManual.trim()) { toast.error("Ingresá el CAE"); return; }
    const res = await fetch(`/api/admin/facturacion/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cae_manual: caeManual.trim() }),
    });
    if (res.ok) {
      toast.success("CAE registrado manualmente");
      setCaeManual("");
      fetchData();
      setDetalle(null);
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Error");
    }
  }

  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filtroEstado} onValueChange={(v) => { setFiltroEstado(v); setPage(1); }}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="emitida">Emitida</SelectItem>
            <SelectItem value="fallida">Fallida</SelectItem>
            <SelectItem value="anulada">Anulada</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={fetchData} disabled={loading}>
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Actualizar
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{total} comprobante{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading && comprobantes.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-6 text-center">Cargando...</p>
        ) : comprobantes.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-6 text-center">Sin comprobantes.</p>
        ) : (
          <div className="divide-y divide-border">
            {comprobantes.map((c) => (
              <div key={c.id} className="flex items-center h-11 px-4 gap-3">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {format(parseISO(c.fecha_cbte), "dd/MM/yy")}
                  </span>
                  <span className="text-sm font-medium truncate">
                    {c.nro_cbte ? `${TIPO_LABELS[c.tipo_cbte] ?? `Cbte ${c.tipo_cbte}`} N° ${c.nro_cbte}` : "Sin número"}
                  </span>
                  {c.cae && (
                    <span className="text-xs font-mono text-muted-foreground hidden md:inline truncate">
                      CAE: {c.cae}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium shrink-0">
                  ${Number(c.importe).toLocaleString("es-AR")}
                </span>
                <Badge variant={ESTADO_VARIANT[c.estado]} className="text-[11px] px-2 py-0.5 shrink-0">
                  {ESTADO_LABELS[c.estado]}
                </Badge>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetalle(c)}>
                        <Eye size={13} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ver detalle</TooltipContent>
                  </Tooltip>
                  {(c.estado === "fallida" || c.estado === "pendiente") && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={retryingId === c.id}
                          onClick={() => handleReintentar(c.id)}
                        >
                          <RotateCcw size={13} className={retryingId === c.id ? "animate-spin" : ""} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reintentar emisión</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Siguiente
          </Button>
        </div>
      )}

      {/* Dialog detalle */}
      <Dialog open={!!detalle} onOpenChange={(v) => { if (!v) { setDetalle(null); setCaeManual(""); } }}>
        {detalle && (
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {TIPO_LABELS[detalle.tipo_cbte] ?? `Tipo ${detalle.tipo_cbte}`}
                {detalle.nro_cbte ? ` N° ${detalle.nro_cbte}` : ""}
                <Badge variant={ESTADO_VARIANT[detalle.estado]} className="text-[11px] ml-1">
                  {ESTADO_LABELS[detalle.estado]}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p>{format(parseISO(detalle.fecha_cbte), "dd/MM/yyyy", { locale: es })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Importe</p>
                  <p className="font-medium">${Number(detalle.importe).toLocaleString("es-AR")}</p>
                </div>
                {detalle.cae && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">CAE</p>
                    <p className="font-mono text-xs">{detalle.cae}</p>
                  </div>
                )}
                {detalle.vencimiento_cae && (
                  <div>
                    <p className="text-xs text-muted-foreground">Venc. CAE</p>
                    <p className="text-xs">{format(parseISO(detalle.vencimiento_cae), "dd/MM/yyyy")}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Intentos</p>
                  <p>{detalle.intentos}</p>
                </div>
              </div>
              {detalle.ultimo_error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-1">Último error</p>
                  <p className="text-xs font-mono text-destructive">{detalle.ultimo_error}</p>
                </div>
              )}
              {/* Payload enviado */}
              {detalle.datos_envio && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Payload enviado a ARCA</p>
                  <pre className="text-[10px] font-mono bg-muted rounded-md p-2 overflow-x-auto max-h-32">
                    {JSON.stringify(detalle.datos_envio, null, 2)}
                  </pre>
                </div>
              )}
              {/* Respuesta ARCA */}
              {detalle.datos_respuesta && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Respuesta de ARCA</p>
                  <pre className="text-[10px] font-mono bg-muted rounded-md p-2 overflow-x-auto max-h-32">
                    {JSON.stringify(detalle.datos_respuesta, null, 2)}
                  </pre>
                </div>
              )}
              {/* CAE manual — para cuando ARCA estuvo caído y se emitió por portal */}
              {(detalle.estado === "fallida" || detalle.estado === "pendiente") && (
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <p className="text-xs font-medium">Registrar CAE manualmente</p>
                  <p className="text-xs text-muted-foreground">
                    Si emitiste la factura desde el portal de ARCA, ingresá el CAE aquí.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      value={caeManual}
                      onChange={(e) => setCaeManual(e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="71536987654321"
                    />
                    <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => handleCaeManual(detalle.id)}>
                      Registrar
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 flex-wrap">
              {(detalle.estado === "fallida" || detalle.estado === "pendiente") && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={retryingId === detalle.id}
                    onClick={() => handleReintentar(detalle.id)}
                  >
                    <RotateCcw size={12} className={retryingId === detalle.id ? "animate-spin" : ""} />
                    Reintentar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => handleAnular(detalle.id)}
                  >
                    <XCircle size={12} />
                    Anular
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => { setDetalle(null); setCaeManual(""); }}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/facturacion/ComprobantesTab.tsx
git commit -m "feat: add ComprobantesTab with list, detail dialog, retry and manual CAE"
```

---

## Task 9: Main Page + Navigation

**Files:**
- Create: `components/admin/facturacion/FacturacionClient.tsx`
- Create: `app/admin/(protected)/facturacion/page.tsx`
- Modify: `components/admin/AdminSidebar.tsx`

**Interfaces:**
- Consumes: `ConfigFacturacionTab`, `ComprobantesTab`
- Produces: `/admin/facturacion` route accessible from sidebar; tabs "Comprobantes" + "Configuración" (superadmin only)

- [ ] **Step 1: Create FacturacionClient.tsx**

```typescript
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComprobantesTab } from "./ComprobantesTab";
import { ConfigFacturacionTab } from "./ConfigFacturacionTab";

export function FacturacionClient({ esSuperAdmin }: { esSuperAdmin: boolean }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Facturación electrónica</h1>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="comprobantes" className="max-w-3xl">
          <TabsList className="mb-4">
            <TabsTrigger value="comprobantes">Comprobantes</TabsTrigger>
            {esSuperAdmin && <TabsTrigger value="config">Configuración</TabsTrigger>}
          </TabsList>
          <TabsContent value="comprobantes">
            <ComprobantesTab />
          </TabsContent>
          {esSuperAdmin && (
            <TabsContent value="config">
              <ConfigFacturacionTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create app/admin/(protected)/facturacion/page.tsx**

```typescript
import { getSession } from "@/lib/auth";
import { FacturacionClient } from "@/components/admin/facturacion/FacturacionClient";

export const dynamic = "force-dynamic";

export default async function FacturacionPage() {
  const session = await getSession();
  const esSuperAdmin = session?.rol === "superadmin";

  return <FacturacionClient esSuperAdmin={esSuperAdmin} />;
}
```

- [ ] **Step 3: Add to AdminSidebar**

Read `components/admin/AdminSidebar.tsx` and find the `navItems` array. Add a new entry for facturación. Look for the existing items structure (e.g., `{ href: "/admin/reservas", label: "Reservas", icon: ... }`) and add:

```typescript
{ href: "/admin/facturacion", label: "Facturación", icon: Receipt },
```

Also add `Receipt` to the lucide-react import at the top of the file.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Test navigation**

Start dev server: `npm run dev`

1. Navigate to `http://localhost:3000/admin`
2. Verify "Facturación" appears in sidebar
3. Click it → `/admin/facturacion` loads with Comprobantes tab
4. Login as superadmin → verify "Configuración" tab appears

- [ ] **Step 6: Commit**

```bash
git add components/admin/facturacion/FacturacionClient.tsx app/admin/(protected)/facturacion/page.tsx components/admin/AdminSidebar.tsx
git commit -m "feat: add facturacion page and sidebar navigation"
```

---

## Task 10: Auto-emission on Reserva Confirmed

**Files:**
- Modify: `app/api/admin/reservas/[id]/route.ts` (or wherever `estado: "confirmada"` is set)

**Interfaces:**
- Consumes: `emitirFactura` from `lib/facturacion/emitir.ts`
- Produces: When a reserva transitions to `estado = "confirmada"`, `emitirFactura()` is called with `monto_total` and `fecha` from that reserva. Failure does NOT block the confirmation (fire-and-forget with queue fallback).

- [ ] **Step 1: Find where reserva confirmation happens**

```bash
grep -r "confirmada" app/api/admin/reservas/ --include="*.ts" -l
```

Read the found file(s) and identify the PATCH handler where `estado` can be set to `"confirmada"`.

- [ ] **Step 2: Modify the confirmation handler**

In the PATCH handler for updating a reserva, after a successful update where the new estado is `"confirmada"`, add emission trigger. The key pattern — find this block (or similar) and add the emission call after the successful update:

```typescript
import { emitirFactura } from "@/lib/facturacion/emitir";

// After: const { data, error } = await supabase.from("reservas").update(...).eq("id", id).select("*, cancha:canchas(nombre), turno:turnos(hora_inicio), cliente:clientes(nombre)").single();
// Add:
if (!error && data && body.estado === "confirmada") {
  // Fire-and-forget — failures go to pending queue, cron picks them up
  emitirFactura({
    reservaId: id,
    monto: data.monto_total,
    fechaReserva: data.fecha,
    nombreReceptor: (data.cliente as { nombre: string } | null)?.nombre,
  }).catch((err) => {
    // Error already logged to comprobantes table by emitirFactura
    console.error("[facturacion] Error al emitir:", err.message);
  });
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Test in testing mode**

1. Configure facturación in `/admin/facturacion` → Configuración with modo=testing and a valid AFIP SDK testing token
2. Confirm a reserva from the grilla or reservas panel
3. Go to `/admin/facturacion` → Comprobantes
4. Verify a new comprobante appears with estado `emitida` (or `fallida` if not configured) 

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/reservas/
git commit -m "feat: auto-emit invoice when reserva confirmed"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task |
|-------------|------|
| Facturación automática al confirmar reserva | Task 10 |
| Facturación manual en casos de fallos | Task 8 (reintentar, CAE manual) |
| Configurable por superadmin | Task 7 (ConfigFacturacionTab, solo superadmin) |
| CUIT, razón social, domicilio, condición IVA | Task 7 form fields |
| Cert + key encriptados en DB | Task 2 (crypto), Task 5 (PATCH endpoint) |
| Modificables desde UI | Task 7 (textarea upload) |
| Tracking completo de comprobantes | Task 1 (tabla), Task 4 (emitir guarda todo) |
| Cola de reintentos automática | Task 6 (procesar-cola cron) |
| Estado de ARCA visible | Task 7 (status badge + verify button) |
| Anulación manual | Task 8 (anular action) |
| CAE manual para ARCA caído | Task 8 (CAE manual dialog) |
| Solo superadmin configura | Tasks 5, 7 (requireSuperAdmin check) |
| Admins ven comprobantes | Task 9 (FacturacionClient, comprobantes tab for all) |

### Placeholder Scan

No placeholders found. All steps contain actual code.

### Type Consistency

- `ConfigFacturacion.tiene_cert` / `tiene_key` — defined Task 3, used Task 7 ✓
- `Comprobante.estado: ComprobanteEstado` — defined Task 3, used Task 8 ✓
- `emitirFactura(EmitirParams)` — defined Task 4, called Task 10 ✓
- `getAfipClient()` — defined Task 4, used Tasks 5, 6 ✓
- `encrypt` / `decrypt` — defined Task 2, used Tasks 4, 5 ✓
