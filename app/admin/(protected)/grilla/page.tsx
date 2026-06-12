import { createSupabaseServerClient } from "@/lib/supabase/server";
import GrillaClient from "@/components/admin/GrillaClient";
import { format, addDays } from "date-fns";

function sortTurnos<T extends { hora_inicio: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const toMin = (h: string) => {
      const hh = Number(h.slice(0, 2));
      return (hh < 7 ? hh + 24 : hh) * 60 + Number(h.slice(3, 5));
    };
    return toMin(a.hora_inicio) - toMin(b.hora_inicio);
  });
}

type CanchaRow = { id: number; nombre: string; tipo: string; jugadores: number; activa: boolean; espacio_id: number };

function canchaDisponibleParaDia(
  cancha: CanchaRow,
  todasCanchas: CanchaRow[],
  dispSemanal: { cancha_id: number; habilitada: boolean }[],
  overrides: { cancha_id: number | null; habilitada: boolean }[]
): boolean {
  // cancha-specific override first, then global (cancha_id IS NULL)
  const ovCancha = overrides.find((o) => o.cancha_id === cancha.id);
  if (ovCancha != null) return ovCancha.habilitada;
  const ovGlobal = overrides.find((o) => o.cancha_id === null);
  if (ovGlobal != null) return ovGlobal.habilitada;

  // weekly schedule
  const semanal = dispSemanal.find((d) => d.cancha_id === cancha.id);
  if (!semanal?.habilitada) return false;

  // f8: unavailable if same espacio has an active f5 that day
  if (cancha.tipo === "f8") {
    const hasActiveF5 = todasCanchas.some(
      (c) =>
        c.espacio_id === cancha.espacio_id &&
        c.tipo === "f5" &&
        c.activa &&
        dispSemanal.some((d) => d.cancha_id === c.id && d.habilitada)
    );
    if (hasActiveF5) return false;
  }

  return true;
}

export const dynamic = "force-dynamic";

export default async function GrillaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; vista?: string }>;
}) {
  const params = await searchParams;
  const today = format(new Date(), "yyyy-MM-dd");
  const fecha = params.fecha ?? today;
  const endDate = format(addDays(new Date(), 14), "yyyy-MM-dd");

  // needed before queries for disponibilidad_cancha filter
  const diaSemana = new Date(fecha + "T12:00:00").getDay();

  const supabase = await createSupabaseServerClient();

  const [
    { data: canchas },
    { data: turnos },
    { data: reservas },
    { data: allReservas },
    { data: todosLosFijos },
    { data: preciosData },
    { data: dispSemanal },
    { data: dispOverrides },
  ] = await Promise.all([
    supabase
      .from("canchas")
      .select("id, nombre, tipo, jugadores, activa, espacio_id")
      .eq("activa", true)
      .order("id"),

    supabase
      .from("turnos")
      .select("id, hora_inicio, hora_fin")
      .order("hora_inicio"),

    // Vista A: solo la fecha seleccionada
    supabase
      .from("reservas")
      .select("id, id_legible, estado, canal, cancha_id, turno_id, monto_total, monto_abonado, recurrente_id, fecha, clientes(nombre, telefono)")
      .eq("fecha", fecha)
      .in("estado", ["pendiente_pago", "confirmada"]),

    // Vista Lista: próximos 15 días
    supabase
      .from("reservas")
      .select("id, id_legible, estado, canal, cancha_id, turno_id, monto_total, monto_abonado, recurrente_id, fecha, clientes(nombre, telefono)")
      .gte("fecha", today)
      .lte("fecha", endDate)
      .in("estado", ["pendiente_pago", "confirmada"]),

    // Todos los fijos activos
    supabase
      .from("reservas_recurrentes")
      .select("id, cancha_id, turno_id, dia_semana, clientes(nombre, telefono)")
      .eq("activa", true),

    // Precios por cancha
    supabase
      .from("precios")
      .select("cancha_id, precio, vigente_desde")
      .order("vigente_desde", { ascending: false }),

    // Disponibilidad semanal para el día seleccionado
    supabase
      .from("disponibilidad_cancha")
      .select("cancha_id, habilitada")
      .eq("dia_semana", diaSemana),

    // Overrides para la fecha exacta
    supabase
      .from("disponibilidad_overrides")
      .select("cancha_id, habilitada")
      .eq("fecha", fecha),
  ]);

  // Build map: most recent price per cancha
  const precios: Record<number, number> = {};
  (preciosData ?? []).forEach((p) => {
    if (!precios[p.cancha_id]) precios[p.cancha_id] = p.precio;
  });

  const fijosDelDia = (todosLosFijos ?? []).filter((f) => f.dia_semana === diaSemana);

  const todasCanchas = (canchas ?? []) as CanchaRow[];

  // Vista A: only canchas available on this specific date
  const canchasGrilla = todasCanchas.filter((c) =>
    canchaDisponibleParaDia(
      c,
      todasCanchas,
      (dispSemanal ?? []) as { cancha_id: number; habilitada: boolean }[],
      (dispOverrides ?? []) as { cancha_id: number | null; habilitada: boolean }[]
    )
  );

  return (
    <GrillaClient
      fecha={fecha}
      today={today}
      canchas={canchasGrilla}
      canchasLista={todasCanchas}
      turnos={sortTurnos(turnos ?? [])}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reservas={(reservas ?? []) as any[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fijosDelDia={fijosDelDia as any[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      allReservas={(allReservas ?? []) as any[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      todosLosFijos={(todosLosFijos ?? []) as any[]}
      vistaInicial={params.vista === "3" ? "3" : "A"}
      precios={precios}
    />
  );
}
