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

  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("pos")
    .eq("id", 1)
    .single();

  if (!modulos?.pos) {
    return NextResponse.json({ error: "Módulo POS no habilitado" }, { status: 403 });
  }

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
