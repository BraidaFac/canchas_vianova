import { getGoogleSheet } from "./google-sheets";

/** Estructura que devolvemos */
export interface HorarioLibre {
  turnoId: string;
  horaInicio: string;
  horaFin: string;
}

export type TurnosLibresPorCancha = Record<string, HorarioLibre[]>;

/**
 * Devuelve los turnos libres de la fecha dada agrupados por número de cancha.
 * claveFecha debe llegar en el mismo formato que se usa en la hoja (“DD/MM” o “AAAA‑MM‑DD”, etc.).
 */
export async function getTurnosLibresPorFecha(
  fecha: string
): Promise<TurnosLibresPorCancha> {
  const doc = await getGoogleSheet();

  // Accedemos por título para evitar depender del índice.
  const hojaLibres = doc.sheetsByTitle["Libres"];
  const hojaTurnos = doc.sheetsByTitle["Turnos"];
  const hojaCanchas = doc.sheetsByTitle["Canchas"];

  // Cargamos headers y filas en paralelo.
  await Promise.all([
    hojaLibres.loadHeaderRow(),
    hojaTurnos.loadHeaderRow(),
    hojaCanchas.loadHeaderRow(),
  ]);

  const [libres, turnos, canchas] = await Promise.all([
    hojaLibres.getRows(),
    hojaTurnos.getRows(),
    hojaCanchas.getRows(),
  ]);

  /* ---------- Mapas de búsqueda rápida ---------- */

  // idTurno -> {horaInicio, horaFin}
  const turnosMap = new Map<string, { horaInicio: string; horaFin: string }>();
  for (const row of turnos) {
    turnosMap.set(row.get("Id"), {
      horaInicio: row.get("HoraInicio"),
      horaFin: row.get("HoraFin"),
    });
  }
  const canchasMap = new Map<string, { numero: string; jugadores: string }>();
  for (const row of canchas) {
    canchasMap.set(row.get("Id"), {
      numero: row.get("NumeroCancha"),
      jugadores: row.get("CantJugadores"),
    });
  }
  /* ---------- Recorremos la hoja Libres ---------- */

  const resultado: TurnosLibresPorCancha = {};

  for (const row of libres) {
    if (row.get("Fecha") !== fecha) continue; // Solo la fecha solicitada

    const turnoId = row.get("Turno");
    const canchaId = row.get("Cancha");

    const turno = turnosMap.get(turnoId);
    const cancha = canchasMap.get(canchaId);

    // Si falta algo, descartamos la fila silenciosamente
    if (!turno || !cancha) continue;

    const key = cancha.numero; // o usa canchaId si prefieres
    if (!resultado[key]) resultado[key] = [];

    resultado[key].push({
      turnoId,
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
    });
  }

  // Ordenamos cada lista por horaInicio (alfabético basta si usan HH:MM)
  for (const can of Object.keys(resultado)) {
    resultado[can].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }

  return resultado;
}
