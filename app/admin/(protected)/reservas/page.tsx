import { createSupabaseServerClient } from "@/lib/supabase/server";
import ReservasClient from "@/components/admin/ReservasClient";

export const dynamic = "force-dynamic";

function sortTurnos<T extends { hora_inicio: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => {
    const toMin = (h: string) => {
      const hh = Number(h.slice(0, 2));
      return (hh < 7 ? hh + 24 : hh) * 60 + Number(h.slice(3, 5));
    };
    return toMin(a.hora_inicio) - toMin(b.hora_inicio);
  });
}

export default async function ReservasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("reservas")
    .select(
      "id, id_legible, fecha, estado, canal, monto_total, monto_abonado, created_at, cancha_id, turno_id, recurrente_id, clientes(nombre, telefono), canchas(nombre, tipo), turnos(hora_inicio)"
    )
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (params.estado && params.estado !== "todas") {
    query = query.eq("estado", params.estado);
  }

  const [
    { data: reservas },
    { data: canchas },
    { data: turnos },
    { data: preciosData },
  ] = await Promise.all([
    query,
    supabase
      .from("canchas")
      .select("id, nombre, tipo, jugadores, activa")
      .eq("activa", true)
      .order("id"),
    supabase
      .from("turnos")
      .select("id, hora_inicio, hora_fin")
      .order("hora_inicio"),
    supabase
      .from("precios")
      .select("cancha_id, precio, vigente_desde")
      .order("vigente_desde", { ascending: false }),
  ]);

  // Build map: most recent price per cancha
  const precios: Record<number, number> = {};
  (preciosData ?? []).forEach((p) => {
    if (!precios[p.cancha_id]) precios[p.cancha_id] = p.precio;
  });

  return (
    <ReservasClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reservas={(reservas ?? []) as any[]}
      filtroEstado={params.estado ?? "todas"}
      busqueda={params.q ?? ""}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canchas={(canchas ?? []) as any[]}
      turnos={sortTurnos(turnos ?? [])}
      precios={precios}
    />
  );
}
