// lib/caja/jornada.ts

/**
 * Calcula la fecha de la jornada de negocio actual.
 * Pagos registrados antes del cutoffHour pertenecen a la jornada del día anterior.
 * Ejemplo con cutoff=7: 01:03am del 02/08 → retorna "2026-08-01"
 *                       10:00am del 02/08 → retorna "2026-08-02"
 */
export function getFechaJornadaActual(cutoffHour = 7): string {
  const now = new Date();
  const hour = now.getHours();

  if (hour < cutoffHour) {
    const ayer = new Date(now);
    ayer.setDate(ayer.getDate() - 1);
    return ayer.toISOString().slice(0, 10);
  }

  return now.toISOString().slice(0, 10);
}
