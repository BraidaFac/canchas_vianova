import type { PrecioRegla } from "./types";

/**
 * Resolve the price for a given booking slot.
 * Priority: specific dias_semana wins over NULL (all days), then most recent vigente_desde.
 * Returns null if no matching active rule found.
 */
export function resolvePrecio(
  reglas: PrecioRegla[],
  tipoCanchaId: number,
  horaInicio: string, // "HH:MM:SS" or "HH:MM"
  diaSemana: number,  // 0=dom, 6=sáb
  fecha: string,      // YYYY-MM-DD — only rules vigente_desde <= fecha are considered
): number | null {
  const h = horaInicio.slice(0, 5); // normalize to "HH:MM"

  const candidatas = reglas.filter(r =>
    r.tipo_cancha_id === tipoCanchaId &&
    r.activa &&
    r.vigente_desde <= fecha &&
    r.hora_desde <= h &&
    (r.hora_hasta === "00:00" || r.hora_hasta > h) &&
    (r.dias_semana === null || r.dias_semana.includes(diaSemana))
  );

  if (!candidatas.length) return null;

  // Sort: specific days first, then most recent vigente_desde
  candidatas.sort((a, b) => {
    const aSpec = a.dias_semana !== null ? 1 : 0;
    const bSpec = b.dias_semana !== null ? 1 : 0;
    if (bSpec !== aSpec) return bSpec - aSpec;
    return b.vigente_desde.localeCompare(a.vigente_desde);
  });

  return Number(candidatas[0].precio);
}
