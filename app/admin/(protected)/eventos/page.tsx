import { createSupabaseServerClient } from "@/lib/supabase/server";
import EventosClient from "@/components/admin/EventosClient";

export const dynamic = "force-dynamic";

export default async function EventosPage() {
  const supabase = await createSupabaseServerClient();

  const [
    { data: eventos },
    { data: canchas },
    { data: turnos },
  ] = await Promise.all([
    supabase
      .from("eventos")
      .select(`
        id, nombre, tipo, fecha_inicio, fecha_fin, estado, notas, created_at,
        evento_slots(id, cancha_id, turno_id, dia_semana)
      `)
      .order("fecha_inicio", { ascending: false }),
    supabase
      .from("canchas")
      .select("id, nombre, tipo, jugadores")
      .eq("activa", true)
      .order("id"),
    supabase
      .from("turnos")
      .select("id, hora_inicio, hora_fin")
      .order("hora_inicio"),
  ]);

  return (
    <EventosClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventos={(eventos ?? []) as any[]}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canchas={(canchas ?? []) as any[]}
      turnos={turnos ?? []}
    />
  );
}
