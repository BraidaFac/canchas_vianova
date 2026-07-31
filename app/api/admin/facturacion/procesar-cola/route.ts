import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAfipClientDefault } from "@/lib/facturacion/afip-client";

function toDateInt(dateStr: string): number {
  return parseInt(dateStr.replace(/-/g, ""), 10);
}

// Called by Vercel Cron every 10 minutes.
// Also callable manually by superadmin from UI.
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

  try {
    const { client, config } = await getAfipClientDefault();
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
