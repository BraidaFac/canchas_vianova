import { createSupabaseServerClient } from "@/lib/supabase/server";
import ConfigClient from "@/components/admin/ConfigClient";
import { getSession } from "@/lib/auth.server";
import { hasMinRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const session = await getSession();
  const supabase = await createSupabaseServerClient();

  const esSuperAdmin = session ? hasMinRole(session, "superadmin") : false;
  const esRoot = session ? hasMinRole(session, "root") : false;

  const [
    { data: canchas },
    { data: precioReglasData },
    { data: disponibilidad },
    { data: turnos },
    { data: botConfig },
    { data: tiposCancha },
    { data: espacios },
    { data: configGeneral },
  ] = await Promise.all([
    supabase.from("canchas").select("id, espacio_id, nombre, tipo_cancha_id, jugadores, activa, tipos_cancha(id, nombre, jugadores, clave), espacios_fisicos(id, nombre)").order("id"),
    supabase
      .from("precio_reglas")
      .select("id, tipo_cancha_id, hora_desde, hora_hasta, dias_semana, precio, vigente_desde, activa, tipos_cancha(id, nombre, jugadores, clave, activo)")
      .order("tipo_cancha_id")
      .order("hora_desde")
      .order("vigente_desde", { ascending: false }),
    supabase
      .from("disponibilidad_cancha")
      .select("cancha_id, dia_semana, habilitada")
      .order("cancha_id"),
    supabase.from("turnos").select("id, hora_inicio, hora_fin").order("hora_inicio"),
    esRoot
      ? supabase.from("bot_config").select("clave, valor, descripcion, updated_at").order("clave")
      : Promise.resolve({ data: [] }),
    supabase.from("tipos_cancha").select("id, nombre, jugadores, clave, activo").order("id"),
    supabase.from("espacios_fisicos").select("id, nombre, activo").order("id"),
    supabase.from("config_modulos").select("caja_cutoff_hour").eq("id", 1).single(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const precioReglas = (precioReglasData ?? []).map((r: any) => ({
    ...r,
    hora_desde: r.hora_desde.slice(0, 5),
    hora_hasta: r.hora_hasta.slice(0, 5),
  }));

  return (
    <ConfigClient
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      canchas={(canchas ?? []) as any[]}
      precioReglas={precioReglas}
      disponibilidad={disponibilidad ?? []}
      turnos={turnos ?? []}
      botConfig={botConfig ?? []}
      esSuperAdmin={esSuperAdmin}
      esRoot={esRoot}
      tiposCancha={tiposCancha ?? []}
      espacios={espacios ?? []}
      cutoffHour={configGeneral?.caja_cutoff_hour ?? 7}
    />
  );
}
