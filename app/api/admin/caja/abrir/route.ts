import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFechaJornadaActual } from "@/lib/caja/jornada";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { monto_apertura } = body;

  if (typeof monto_apertura !== "number" || monto_apertura < 0) {
    return NextResponse.json({ error: "monto_apertura debe ser un número >= 0" }, { status: 400 });
  }

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
  const fechaJornada = getFechaJornadaActual(cutoffHour);

  // Verifica que no haya jornada abierta (el unique index en DB también protege)
  const { data: jornadaAbierta } = await supabase
    .from("jornadas_operativas")
    .select("id, fecha_jornada")
    .eq("estado", "abierta")
    .maybeSingle();

  if (jornadaAbierta) {
    if (jornadaAbierta.fecha_jornada !== fechaJornada) {
      return NextResponse.json(
        { error: `Hay una caja sin cerrar del ${jornadaAbierta.fecha_jornada}. Cerrala antes de abrir una nueva.` },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Ya hay una caja abierta para esta jornada." },
      { status: 409 }
    );
  }

  // Crear jornada
  const { data: jornada, error: jornadaErr } = await supabase
    .from("jornadas_operativas")
    .insert({
      fecha_jornada: fechaJornada,
      estado: "abierta",
    })
    .select("id")
    .single();

  if (jornadaErr || !jornada) {
    return NextResponse.json({ error: jornadaErr?.message ?? "Error al crear jornada" }, { status: 500 });
  }

  // Crear sesión
  const { data: sesion, error: sesionErr } = await supabase
    .from("sesiones_caja")
    .insert({
      jornada_id: jornada.id,
      estado: "abierta",
      monto_apertura,
    })
    .select("id")
    .single();

  if (sesionErr || !sesion) {
    // Rollback jornada
    await supabase.from("jornadas_operativas").delete().eq("id", jornada.id);
    return NextResponse.json({ error: sesionErr?.message ?? "Error al crear sesión" }, { status: 500 });
  }

  return NextResponse.json({ jornada_id: jornada.id, sesion_id: sesion.id }, { status: 201 });
}
