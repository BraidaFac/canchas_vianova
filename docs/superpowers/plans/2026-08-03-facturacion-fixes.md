# Plan: Facturación Fixes — 2026-08-03

## Goal

Fix broken facturación flow and surface billing status across the admin panel. 4 scoped tasks.

## Architecture

Next.js 15 App Router. Supabase for data. ARCA/AFIP for electronic invoicing via `@afipsdk/afip.js`.

## Tech Stack

- Next.js 15, TypeScript, Supabase, shadcn/ui, Tailwind CSS v4, sonner (toasts)

## Global Constraints

- No test suite — manual verification only (steps listed as "Manual test:" in each task)
- Follow existing patterns: Dialog for modals, shadcn/ui components, toast for feedback
- No new dependencies
- Caveman-style commit messages are fine

---

## Task 1 — Fix facturación silenciosa (CRITICAL)

**Files:**
- `app/api/admin/caja/cerrar/route.ts`
- `components/admin/CerrarCajaDialog.tsx`

**Root cause:** Browser had old version of `CerrarCajaDialog` cached (one that fetched `/api/admin/cobros?per_page=5000` instead of the current `/api/admin/caja/resumen-previo`). The old route had fire-and-forget `Promise.allSettled(...)` without `await` — serverless terminated before ARCA calls could complete. The `await` was added today; this task adds logging and surfacing results to the UI.

**Steps:**

- [ ] In `app/api/admin/caja/cerrar/route.ts`, replace the current invoicing block:

```typescript
// OLD — no result tracking
if (pago_ids_facturar.length > 0) {
  await Promise.allSettled(
    pago_ids_facturar.map((pago_id) =>
      emitirFactura({ pago_id }).catch(() => {})
    )
  );
}
return NextResponse.json({ ok: true });
```

with:

```typescript
// NEW — collect results, log, return counts
let emitidas = 0;
let fallidas = 0;

if (pago_ids_facturar.length > 0) {
  console.log(`[cerrar-caja] facturando ${pago_ids_facturar.length} pagos`);
  const results = await Promise.allSettled(
    pago_ids_facturar.map((pago_id) => emitirFactura({ pago_id }))
  );
  for (const r of results) {
    if (r.status === "fulfilled") emitidas++;
    else {
      fallidas++;
      console.error("[cerrar-caja] error factura:", r.reason);
    }
  }
  console.log(`[cerrar-caja] emitidas=${emitidas} fallidas=${fallidas}`);
}

return NextResponse.json({
  ok: true,
  facturacion: { emitidas, fallidas, total: pago_ids_facturar.length },
});
```

- [ ] In `components/admin/CerrarCajaDialog.tsx`, find `handleCerrar` (the function that calls `fetch("/api/admin/caja/cerrar", ...)`). Replace the current success-toast and `onSuccess()` call with:

```typescript
const json = await res.json();
if (!res.ok) {
  toast.error(json.error ?? "Error al cerrar caja");
  return;
}

if (json.facturacion?.fallidas > 0) {
  toast.warning(
    `Caja cerrada. ${json.facturacion.emitidas} factura${json.facturacion.emitidas !== 1 ? "s" : ""} emitida${json.facturacion.emitidas !== 1 ? "s" : ""}, ${json.facturacion.fallidas} fallida${json.facturacion.fallidas !== 1 ? "s" : ""}. Revisá Facturación.`
  );
} else if (json.facturacion?.emitidas > 0) {
  toast.success(
    `Caja cerrada. ${json.facturacion.emitidas} factura${json.facturacion.emitidas !== 1 ? "s" : ""} emitida${json.facturacion.emitidas !== 1 ? "s" : ""} correctamente.`
  );
} else {
  toast.success(facturar ? "Caja cerrada y facturación iniciada" : "Caja cerrada sin facturar");
}
window.dispatchEvent(new CustomEvent("caja-estado-changed"));
onSuccess();
```

Note: the variable `facturar` refers to whatever local boolean already tracks whether the user elected to facturar in step 3 of the dialog. Match the existing variable name.

**Manual test:**
1. Open Cerrar Caja dialog.
2. Select cobros to facturar, click "Facturar y cerrar".
3. Watch the server console (terminal running `npm run dev`) for lines starting with `[cerrar-caja]`.
4. Verify the toast matches the real counts (e.g., "2 facturas emitidas correctamente" or "1 factura emitida, 1 fallida. Revisá Facturación.").

---

## Task 2 — Fix entidad fiscal en retry (Bug B)

**Files:**
- `app/api/admin/facturacion/[id]/route.ts`
- `app/api/admin/facturacion/procesar-cola/route.ts`

**Root cause:** Both routes call `getAfipClientDefault()`, which ignores which entidad fiscal the original pago was associated with. If there are multiple entidades fiscales, retries use the wrong CUIT.

### Fix `[id]/route.ts` (POST — manual retry)

- [ ] Add `getAfipClient` to the import from `@/lib/facturacion/afip-client` (keep any existing imports, just add the named import if it isn't there already).

- [ ] In the `POST` handler, find the line:

```typescript
const { client, config } = await getAfipClientDefault();
```

Replace it with:

```typescript
// Resolve entidad fiscal from pago → cuenta_bancaria
const { data: pago } = await supabase
  .from("pagos")
  .select("cuenta_bancaria:cuentas_bancarias(entidad_fiscal_id)")
  .eq("id", cbte.pago_id)
  .single();

const entidadFiscalId = (pago?.cuenta_bancaria as { entidad_fiscal_id: string } | null)
  ?.entidad_fiscal_id;
if (!entidadFiscalId) {
  return NextResponse.json(
    { error: "No se pudo resolver la entidad fiscal del comprobante" },
    { status: 400 }
  );
}

const { client, config } = await getAfipClient(entidadFiscalId);
```

Note: `cbte.pago_id` is the pago_id field on the comprobante already loaded earlier in the handler. Verify the variable name matches what's in the file.

### Fix `procesar-cola/route.ts` (cron bulk retry)

- [ ] Replace the entire file contents with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAfipClient } from "@/lib/facturacion/afip-client";

function toDateInt(dateStr: string): number {
  return parseInt(dateStr.replace(/-/g, ""), 10);
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Bulk-load pagos → cuenta_bancaria → entidad_fiscal_id to avoid N+1
  const pagoIds = pendientes.map((c) => c.pago_id).filter(Boolean) as string[];
  const { data: pagos } = await supabase
    .from("pagos")
    .select("id, cuenta_bancaria:cuentas_bancarias(entidad_fiscal_id)")
    .in("id", pagoIds);

  const pagoEntidadMap = new Map<string, string>();
  for (const p of pagos ?? []) {
    const ef = (p.cuenta_bancaria as { entidad_fiscal_id: string } | null)?.entidad_fiscal_id;
    if (ef) pagoEntidadMap.set(p.id, ef);
  }

  let procesados = 0;

  for (const cbte of pendientes) {
    try {
      const entidadFiscalId = cbte.pago_id ? pagoEntidadMap.get(cbte.pago_id) : undefined;
      if (!entidadFiscalId) {
        await supabase
          .from("comprobantes")
          .update({
            intentos: cbte.intentos + 1,
            ultimo_error: "No se pudo resolver entidad fiscal",
          })
          .eq("id", cbte.id);
        continue;
      }

      const { client, config } = await getAfipClient(entidadFiscalId);

      // Check ARCA status only on first iteration; if down, abort early
      if (procesados === 0) {
        const status = await client.ElectronicBilling.getServerStatus();
        if (status.AppServer !== "OK" || status.DbServer !== "OK") {
          return NextResponse.json({ ok: false, razon: "ARCA offline", procesados: 0 });
        }
      }

      const tipoCbte = config.condicion_iva === "responsable_inscripto" ? 6 : 11;
      const puntoVenta = config.punto_venta!;
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
}
```

**Manual test:**
1. In the DB, find or create a comprobante in `pendiente` or `fallida` state linked to a pago that has a `cuenta_bancaria` with a specific `entidad_fiscal_id`.
2. Call `POST /api/admin/facturacion/[id]` for a manual retry.
3. Check server logs — the CUIT used in the ARCA call should match the one configured for that entidad fiscal.
4. For the cron route, hit `GET /api/admin/facturacion/procesar-cola` with the correct `Authorization: Bearer <CRON_SECRET>` header and confirm `{ procesados: N }` in the response.

---

## Task 3 — Cobros: mostrar estado real de comprobante

**Files:**
- `lib/facturacion/types.ts`
- `app/api/admin/cobros/route.ts`
- `components/admin/CobrosClient.tsx`

**Root cause:** `PagoSubRow` maps any comprobante with `estado !== "emitida"` to "sin_comprobante", hiding pending/failed states. `deriveEstadoFiscal` in the API route has the same blind spot.

### Fix `lib/facturacion/types.ts`

- [ ] Find the line:

```typescript
export type EstadoFiscal = "facturado" | "mixto" | "sin_comprobante";
```

Replace with:

```typescript
export type EstadoFiscal = "facturado" | "mixto" | "sin_comprobante" | "pendiente" | "fallida";
```

### Fix `app/api/admin/cobros/route.ts`

- [ ] Find the `deriveEstadoFiscal` function. Replace it entirely with:

```typescript
function deriveEstadoFiscal(pagos: PagoConComprobante[]): EstadoFiscal {
  const transferencias = pagos.filter((p) => p.medio_pago === "transferencia");
  if (transferencias.length === 0) return "sin_comprobante";

  const todosEmitidos = transferencias.every((p) => p.comprobante?.estado === "emitida");
  if (todosEmitidos) return "facturado";

  const algunoEmitido = transferencias.some((p) => p.comprobante?.estado === "emitida");
  if (algunoEmitido) return "mixto";

  const algunoFallido = transferencias.some((p) => p.comprobante?.estado === "fallida");
  if (algunoFallido) return "fallida";

  const algunoPendiente = transferencias.some((p) => p.comprobante?.estado === "pendiente");
  if (algunoPendiente) return "pendiente";

  return "sin_comprobante";
}
```

### Fix `components/admin/CobrosClient.tsx`

- [ ] In `ESTADO_FISCAL_CONFIG` (the object used for the group-level badge), add the two new keys:

```typescript
pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-700 border-amber-200" },
fallida:   { label: "Fallida",   className: "bg-red-100 text-red-700 border-red-200" },
```

- [ ] Above the `PagoSubRow` component definition, add the `ComprobanteEstadoBadge` helper:

```tsx
const CBTE_ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  emitida:   { label: "✓ Facturado", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  pendiente: { label: "Pendiente",   className: "bg-amber-100 text-amber-700 border-amber-200" },
  fallida:   { label: "Fallida",     className: "bg-red-100 text-red-700 border-red-200" },
  anulada:   { label: "Anulada",     className: "bg-slate-100 text-slate-500 border-slate-200" },
};

function ComprobanteEstadoBadge({ estado }: { estado: string }) {
  const cfg = CBTE_ESTADO_CONFIG[estado] ?? {
    label: estado,
    className: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.className}`}
    >
      {cfg.label}
    </span>
  );
}
```

- [ ] Inside `PagoSubRow`, find the comprobante badge block (the one that currently checks `pago.comprobante?.estado === "emitida"` to show "✓ Facturado"). Replace the entire comprobante rendering section with:

```tsx
{pago.medio_pago === "transferencia" && pago.comprobante ? (
  <div className="flex items-center gap-2 shrink-0">
    <ComprobanteEstadoBadge estado={pago.comprobante.estado} />
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
  </div>
) : pago.medio_pago === "transferencia" ? (
  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-slate-100 text-slate-500 border-slate-200">
    Sin comprobante
  </span>
) : null}
```

Make sure `Link` is imported from `"next/link"` at the top of the file (add the import if not present).

**Manual test:**
1. In the DB, set a comprobante linked to a pago/transferencia to `estado = 'fallida'`.
2. Go to Cobros, expand that cobro's row.
3. Verify the badge shows "Fallida" in red.
4. Verify "ver →" link is visible and points to `/admin/facturacion?comprobante=<id>`.
5. Repeat with `estado = 'pendiente'` → badge should show "Pendiente" in amber.

---

## Task 4 — FacturacionClient: deep link por `?comprobante=ID`

**Files:**
- `components/admin/facturacion/ComprobantesTab.tsx`

**Root cause:** `CobrosClient.PagoSubRow` generates `href="/admin/facturacion?comprobante=${pago.comprobante.id}"` but `ComprobantesTab` never reads this query param. Navigating to the link opens the page but nothing happens.

**Steps:**

- [ ] Add `useSearchParams` to the React/Next.js imports at the top of `ComprobantesTab.tsx`:

```typescript
import { useSearchParams } from "next/navigation";
```

- [ ] Inside the `ComprobantesTab` function body, after existing hook declarations, add:

```typescript
const searchParams = useSearchParams();
const deepLinkId = searchParams.get("comprobante");
```

- [ ] Add a `useEffect` that reacts to `deepLinkId` and the loaded comprobantes. Place it after the existing data-fetching `useEffect`:

```typescript
useEffect(() => {
  if (!deepLinkId) return;

  // Try to find in the current page first
  const target = comprobantes.find((c) => c.id === deepLinkId);
  if (target) {
    setDetalle(target);
    return;
  }

  // Not on the current page — fetch directly by ID
  fetch(`/api/admin/facturacion/${deepLinkId}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data) setDetalle(data as Comprobante);
    });
}, [deepLinkId, comprobantes]);
```

Note: `setDetalle` is the state setter for the detail dialog. Match the exact variable name used in the file (may be `setSelected`, `setOpen`, etc. — check the file and align).

`Comprobante` is the type already in scope from `@/lib/facturacion/types` or wherever it's imported.

**Manual test:**
1. Go to Cobros, expand a row that has a comprobante.
2. Click "ver →".
3. Verify the browser navigates to `/admin/facturacion?comprobante=<id>`.
4. Verify the detail dialog opens automatically for that comprobante without any additional click.
5. Test with a comprobante ID that would be on page 2 (if pagination exists) — the direct fetch fallback should still open the dialog.
