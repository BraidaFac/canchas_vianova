import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth.server";
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
    const { data: pago } = await supabase
      .from("pagos")
      .select("cuenta_bancaria:cuentas_bancarias(entidad_fiscal_id)")
      .eq("id", cbte.pago_id)
      .single();

    const entidadFiscalId = (pago?.cuenta_bancaria as { entidad_fiscal_id: string } | null)?.entidad_fiscal_id;
    if (!entidadFiscalId) {
      return NextResponse.json({ error: "No se pudo resolver la entidad fiscal del comprobante" }, { status: 400 });
    }

    const { client, config } = await getAfipClient(entidadFiscalId);
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

// PATCH = anular o cargar CAE manualmente
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
    updates.cae_manual = true;
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
