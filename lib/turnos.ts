import { getGoogleSheet } from "./google-sheets";

/** Estructura que devolvemos para cada turno */
export interface Turno {
  horaInicio: string;
  horaFin: string;
  id: number;
}

export interface Cancha {
  id: number;
  nombre: string;
  jugadores: number;
  turnos: FechasTurnos;
  turnosDisponibles?: FechaTurnos;
}

export type FechasTurnos = Record<string, Turno[]>;
export type FechaTurnos = Turno[];
export type TurnosCanchas = Cancha[];

export async function getTurnosDisponibles(): Promise<TurnosCanchas | null> {
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
  const canchasMap = new Map<
    number,
    { numero: number; jugadores: number; nombre: string }
  >();
  for (const row of canchas) {
    canchasMap.set(+row.get("Id"), {
      numero: +row.get("NumeroCancha"),
      jugadores: +row.get("CantJugadores"),
      nombre: row.get("Nombre"),
    });
  }

  /* ---------- Procesamos turnos libres ---------- */

  const resultado: TurnosCanchas = [];

  // Procesar turnos libres
  for (const row of libres) {
    const fecha = row.get("Fecha");
    const turnoId = +row.get("Turno");
    const canchaId = +row.get("Cancha");

    // Buscar si la cancha ya existe en el array
    let cancha = resultado.find((c) => c.id === canchaId);

    if (!cancha) {
      // Si no existe, crear nueva cancha y agregarla al array
      cancha = {
        id: canchaId,
        nombre: canchasMap.get(canchaId)?.nombre || "",
        jugadores: canchasMap.get(canchaId)?.jugadores || 0,
        turnos: {},
      };
      resultado.push(cancha);
    }

    const turno: Turno = {
      horaInicio: turnosMap.get(turnoId)?.horaInicio || "",
      horaFin: turnosMap.get(turnoId)?.horaFin || "",
      id: turnoId,
    };

    if (cancha.turnos[fecha]) {
      cancha.turnos[fecha].push(turno);
    } else {
      cancha.turnos[fecha] = [turno];
    }
  }

  /*  // Ordenamos cada lista por horaInicio
  for (const can of Object.keys(resultado)) {
    resultado[can as keyof TurnosCanchas].turnos.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  } */
  return resultado;
}
