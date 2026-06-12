import { createClient } from "@supabase/supabase-js";

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("v_slots_disponibles")
    .select("cancha_id, cancha_nombre, cancha_tipo, turno_id, hora_inicio, hora_fin, fecha");

  if (error || !data) return null;

  const canchasMap = new Map<number, Cancha>();

  for (const row of data) {
    if (!canchasMap.has(row.cancha_id)) {
      canchasMap.set(row.cancha_id, {
        id: row.cancha_id,
        nombre: row.cancha_nombre,
        jugadores: row.cancha_tipo === "f8" ? 8 : 5,
        turnos: {},
      });
    }

    const cancha = canchasMap.get(row.cancha_id)!;

    // View returns fecha as YYYY-MM-DD — page.tsx expects "dd/MM"
    const [, month, day] = (row.fecha as string).split("-");
    const fechaKey = `${day}/${month}`;

    const turno: Turno = {
      id: row.turno_id,
      horaInicio: (row.hora_inicio as string).slice(0, 5),
      horaFin: (row.hora_fin as string).slice(0, 5),
    };

    if (!cancha.turnos[fechaKey]) {
      cancha.turnos[fechaKey] = [];
    }
    cancha.turnos[fechaKey].push(turno);
  }

  return Array.from(canchasMap.values());
}
