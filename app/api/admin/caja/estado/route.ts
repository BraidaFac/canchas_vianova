import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFechaJornadaActual } from "@/lib/caja/jornada";
import { validarSesionActiva } from "@/lib/caja/validar";
import type { EstadoCajaResponse } from "@/lib/caja/types";

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
  const validation = await validarSesionActiva(supabase, cutoffHour);

  const response: EstadoCajaResponse = {
    code: validation.ok ? "ok" : validation.code,
    sesion: validation.ok ? validation.sesion : null,
    jornada: validation.ok ? (validation.sesion.jornada ?? null) : null,
    fecha_jornada_actual: fechaActual,
  };

  // Si no ok, también enviamos la última jornada/sesión para contexto en el frontend
  if (!validation.ok) {
    const { data: ultimaSesion } = await supabase
      .from("sesiones_caja")
      .select("*, jornada:jornadas_operativas(*)")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimaSesion) {
      response.sesion = ultimaSesion as typeof response.sesion;
      const j = Array.isArray(ultimaSesion.jornada)
        ? ultimaSesion.jornada[0]
        : ultimaSesion.jornada;
      response.jornada = j ?? null;
    }
  }

  return NextResponse.json(response);
}
