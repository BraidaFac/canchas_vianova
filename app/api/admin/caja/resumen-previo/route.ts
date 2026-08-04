import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();

  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("pos")
    .eq("id", 1)
    .single();

  if (!modulos?.pos) {
    return NextResponse.json({ error: "Módulo POS no habilitado" }, { status: 403 });
  }

  const { data: sesion } = await supabase
    .from("sesiones_caja")
    .select("id, monto_apertura")
    .eq("estado", "abierta")
    .maybeSingle();

  if (!sesion) {
    return NextResponse.json({ error: "No hay caja abierta" }, { status: 404 });
  }

  const { data: pagos } = await supabase
    .from("pagos")
    .select("medio_pago, monto, origen_tipo")
    .eq("sesion_caja_id", sesion.id);

  const p = pagos ?? [];
  const total_efectivo = p.filter(x => x.medio_pago === "efectivo").reduce((s, x) => s + Number(x.monto), 0);
  const total_transferencia = p.filter(x => x.medio_pago === "transferencia").reduce((s, x) => s + Number(x.monto), 0);
  const total_otro = p.filter(x => x.medio_pago === "otro").reduce((s, x) => s + Number(x.monto), 0);
  const total_reservas = p.filter(x => x.origen_tipo === "reserva").reduce((s, x) => s + Number(x.monto), 0);
  const total_consumos = p.filter(x => x.origen_tipo === "consumo").reduce((s, x) => s + Number(x.monto), 0);

  return NextResponse.json({
    monto_apertura: Number(sesion.monto_apertura),
    total_efectivo,
    total_transferencia,
    total_otro,
    total_reservas,
    total_consumos,
  });
}
