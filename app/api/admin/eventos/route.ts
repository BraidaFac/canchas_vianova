import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();

  const { data: eventos, error } = await supabase
    .from("eventos")
    .select(`
      id, nombre, tipo, fecha_inicio, fecha_fin, estado, notas, created_at,
      evento_slots(id, cancha_id, turno_id, dia_semana)
    `)
    .order("fecha_inicio", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(eventos ?? []);
}

type SlotInput = { cancha_id: number; turno_id: number; dia_semana: number | null };

/**
 * Returns the day-of-week (0=Sun…6=Sat) for a YYYY-MM-DD string.
 * Using T12:00:00 to avoid UTC-midnight timezone edge cases.
 */
function diaSemanaDeStr(fechaStr: string): number {
  return new Date(fechaStr + "T12:00:00").getDay();
}

/**
 * Generates all YYYY-MM-DD dates in [start, end] inclusive.
 */
function fechasEnRango(start: string, end: string): string[] {
  const fechas: string[] = [];
  const cur = new Date(start + "T12:00:00");
  const last = new Date(end + "T12:00:00");
  while (cur <= last) {
    fechas.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return fechas;
}

/**
 * Check if the given slots conflict with existing active reservas in [fecha_inicio, fecha_fin].
 * Returns array of conflict descriptions (empty = no conflicts).
 */
async function checkConflictos(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  slots: SlotInput[],
  fecha_inicio: string,
  fecha_fin: string,
  excludeEventoId?: number
): Promise<string[]> {
  if (!slots.length) return [];

  // Fetch all active reservas in the date range for the affected canchas+turnos
  const canchaIds = [...new Set(slots.map((s) => s.cancha_id))];
  const turnoIds = [...new Set(slots.map((s) => s.turno_id))];

  let query = supabase
    .from("reservas")
    .select("id, cancha_id, turno_id, fecha, clientes(nombre), canchas(nombre), turnos(hora_inicio)")
    .gte("fecha", fecha_inicio)
    .lte("fecha", fecha_fin)
    .in("cancha_id", canchaIds)
    .in("turno_id", turnoIds)
    .not("estado", "eq", "cancelada");

  // Exclude reservas that already belong to this event (on edit)
  if (excludeEventoId) {
    query = query.is("evento_id", null).or(`evento_id.neq.${excludeEventoId}`);
  }

  const { data: reservas } = await query;
  if (!reservas?.length) return [];

  const conflictos: string[] = [];

  for (const slot of slots) {
    const diasRelevantes = slot.dia_semana === null
      ? null // todos los días
      : slot.dia_semana;

    const conflictantes = reservas.filter((r) => {
      if (r.cancha_id !== slot.cancha_id || r.turno_id !== slot.turno_id) return false;
      if (diasRelevantes !== null && diaSemanaDeStr(r.fecha) !== diasRelevantes) return false;
      return true;
    });

    for (const r of conflictantes) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canchaName = (r as any).canchas?.nombre ?? `cancha ${r.cancha_id}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const turnoHora = (r as any).turnos?.hora_inicio?.slice(0, 5) ?? `turno ${r.turno_id}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const clienteNombre = (r as any).clientes?.nombre ?? "cliente desconocido";
      conflictos.push(`${canchaName} ${turnoHora} el ${r.fecha} (${clienteNombre})`);
    }
  }

  // Deduplicate
  return [...new Set(conflictos)];
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { nombre, tipo, fecha_inicio, fecha_fin, notas, slots } = body;

  if (!nombre || !tipo || !fecha_inicio || !fecha_fin) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Validate slot conflicts before creating
  if (slots?.length) {
    const conflictos = await checkConflictos(supabase, slots, fecha_inicio, fecha_fin);
    if (conflictos.length) {
      return NextResponse.json(
        {
          error: `Hay ${conflictos.length} reserva(s) activa(s) que se superponen con los slots del evento`,
          conflictos,
        },
        { status: 409 }
      );
    }
  }

  const { data: evento, error } = await supabase
    .from("eventos")
    .insert({ nombre, tipo, fecha_inicio, fecha_fin, notas: notas || null })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (slots?.length) {
    const slotsToInsert = slots.map((s: SlotInput) => ({
      evento_id: evento.id,
      cancha_id: s.cancha_id,
      turno_id: s.turno_id,
      dia_semana: s.dia_semana ?? null,
    }));
    await supabase.from("evento_slots").insert(slotsToInsert);
  }

  return NextResponse.json({ id: evento.id }, { status: 201 });
}

// Export helper for reuse in [id]/route.ts
export { checkConflictos, fechasEnRango };
