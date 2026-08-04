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
    .select("caja_cutoff_hour, pos")
    .eq("id", 1)
    .single();

  if (!modulos?.pos) {
    return NextResponse.json({ error: "Módulo POS no habilitado" }, { status: 403 });
  }

  const cutoffHour = modulos?.caja_cutoff_hour ?? 7;
  const fechaActual = getFechaJornadaActual(cutoffHour);

  // Buscar la última sesión cerrada de la jornada actual
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
  const { error: sesionErr } = await supabase
    .from("sesiones_caja")
    .update({ estado: "abierta", cerrada_at: null })
    .eq("id", sesion.id);

  if (sesionErr) {
    return NextResponse.json({ error: sesionErr.message }, { status: 500 });
  }

  const { error: jornadaErr } = await supabase
    .from("jornadas_operativas")
    .update({ estado: "abierta", cerrada_at: null })
    .eq("id", jornada.id);

  if (jornadaErr) {
    return NextResponse.json({ error: jornadaErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sesion_id: sesion.id, jornada_id: jornada.id });
}
