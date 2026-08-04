// lib/caja/validar.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getFechaJornadaActual } from "./jornada";
import type { CajaValidationResult, SesionCaja } from "./types";

export async function validarSesionActiva(
  supabase: SupabaseClient,
  cutoffHour = 7
): Promise<CajaValidationResult> {
  const fechaActual = getFechaJornadaActual(cutoffHour);

  // Busca sesión abierta con su jornada
  const { data: sesionAbierta } = await supabase
    .from("sesiones_caja")
    .select("*, jornada:jornadas_operativas(*)")
    .eq("estado", "abierta")
    .maybeSingle();

  if (sesionAbierta) {
    const jornada = Array.isArray(sesionAbierta.jornada)
      ? sesionAbierta.jornada[0]
      : sesionAbierta.jornada;

    const sesion: SesionCaja = { ...sesionAbierta, jornada };

    if (jornada?.fecha_jornada === fechaActual) {
      return { ok: true, sesion };
    }
    // Sesión abierta pero de otra jornada
    return { ok: false, code: "jornada_vencida" };
  }

  // No hay sesión abierta — busca jornada cerrada de la fecha actual
  const { data: jornadaCerrada } = await supabase
    .from("jornadas_operativas")
    .select("*")
    .eq("fecha_jornada", fechaActual)
    .eq("estado", "cerrada")
    .maybeSingle();

  if (jornadaCerrada) {
    return { ok: false, code: "caja_cerrada_misma_jornada" };
  }

  return { ok: false, code: "sin_caja" };
}
