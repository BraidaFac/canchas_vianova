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
  tipoCanchaId: number;
  tipoCanchaNombre: string;
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

  // Fetch tipo_cancha info for each unique cancha_id
  const uniqueCanchaIds = [...new Set(data.map((r) => r.cancha_id))];
  const { data: canchasInfo } = await supabase
    .from("canchas")
    .select("id, jugadores, tipo_cancha_id, tipos_cancha(id, nombre)")
    .in("id", uniqueCanchaIds);

  // Build lookup map: cancha_id → { tipoCanchaId, tipoCanchaNombre, jugadores }
  const tipoByCanchaId = new Map(
    (canchasInfo ?? []).map((c) => [
      c.id,
      {
        tipoCanchaId: c.tipo_cancha_id as number,
        tipoCanchaNombre: (c.tipos_cancha as any)?.nombre ?? String(c.tipo_cancha_id),
        jugadores: c.jugadores as number,
      },
    ])
  );

  const canchasMap = new Map<number, Cancha>();

  for (const row of data) {
    if (!canchasMap.has(row.cancha_id)) {
      const tipoInfo = tipoByCanchaId.get(row.cancha_id);
      canchasMap.set(row.cancha_id, {
        id: row.cancha_id,
        nombre: row.cancha_nombre,
        jugadores: tipoInfo?.jugadores ?? (row.cancha_tipo === "f8" ? 8 : 5),
        tipoCanchaId: tipoInfo?.tipoCanchaId ?? 0,
        tipoCanchaNombre: tipoInfo?.tipoCanchaNombre ?? row.cancha_tipo,
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
