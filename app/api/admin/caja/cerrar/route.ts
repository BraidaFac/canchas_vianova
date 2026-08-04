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

  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("pos")
    .eq("id", 1)
    .single();

  if (!modulos?.pos) {
    return NextResponse.json({ error: "Módulo POS no habilitado" }, { status: 403 });
  }

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
      })
      .eq("id", jornada.id);
  }

  // Emitir facturas sincrónico — fire-and-forget no funciona en serverless.
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
}
