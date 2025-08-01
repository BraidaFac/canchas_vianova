import { getGoogleSheet } from "./google-sheets";

/** Estructura que devolvemos para cada turno */
export interface Turno {
  turnoId: number;
  horaInicio: string;
  horaFin: string;
  canchaId: number;
  numeroCancha: number;
  cantJugadores?: number;
  id: number;
}

export type TurnosPorCancha = Record<string, Turno[]>;

export async function getTurnosDisponibles(): Promise<TurnosPorCancha | null> {
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
  const turnosMap = new Map<number, { horaInicio: string; horaFin: string }>();
  for (const row of turnos) {
    turnosMap.set(+row.get("Id"), {
      horaInicio: row.get("HoraInicio"),
      horaFin: row.get("HoraFin"),
    });
  }

  // idCancha -> {numero, jugadores}
  const canchasMap = new Map<number, { numero: number; jugadores: number }>();
  for (const row of canchas) {
    canchasMap.set(+row.get("Id"), {
      numero: +row.get("NumeroCancha"),
      jugadores: +row.get("CantJugadores"),
    });
  }

  /* ---------- Procesamos turnos libres ---------- */

  const resultado: TurnosPorCancha = {};

  // Procesar turnos libres
  for (const row of libres) {
    console.log("row", row.get("Fecha"));

    const fecha = row.get("Fecha");
    const turnoId = +row.get("Turno");
    const canchaId = +row.get("Cancha");
    const turno = turnosMap.get(turnoId);
    const cancha = canchasMap.get(canchaId);
    if (!turno || !cancha) continue;

    if (!resultado[fecha]) resultado[fecha] = [];

    resultado[fecha].push({
      turnoId: +turnoId,
      horaInicio: turno.horaInicio,
      horaFin: turno.horaFin,
      canchaId: +canchaId,
      numeroCancha: +cancha.numero,
      cantJugadores: +cancha.jugadores,
      id: +row.rowNumber,
    });
  }

  // Ordenamos cada lista por horaInicio
  for (const can of Object.keys(resultado)) {
    resultado[can].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }

  if (Object.keys(resultado).length === 0) {
    return null;
  }
  return resultado;
}
