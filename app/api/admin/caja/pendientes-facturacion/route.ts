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
    .select("caja_cutoff_hour, pos")
    .eq("id", 1)
    .single();

  if (!modulos?.pos) {
    return NextResponse.json({ error: "Módulo POS no habilitado" }, { status: 403 });
  }

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
