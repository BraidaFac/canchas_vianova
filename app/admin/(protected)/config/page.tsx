import { createSupabaseServerClient } from "@/lib/supabase/server";
import ConfigClient from "@/components/admin/ConfigClient";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const session = await getSession();
  const supabase = await createSupabaseServerClient();

  const esSuperAdmin = session?.rol === "superadmin";

  const [
    { data: canchas },
    { data: precios },
    { data: datosBancarios },
    { data: disponibilidad },
    { data: turnos },
    { data: botConfig },
  ] = await Promise.all([
    supabase.from("canchas").select("id, espacio_id, nombre, tipo, jugadores, activa").order("id"),
    supabase
      .from("precios")
      .select("id, cancha_id, precio, vigente_desde")
      .order("vigente_desde", { ascending: false }),
    supabase
      .from("datos_bancarios")
      .select("id, nombre_cuenta, alias, cbu, vigente_desde, activo")
      .order("vigente_desde", { ascending: false }),
    supabase
      .from("disponibilidad_cancha")
      .select("cancha_id, dia_semana, habilitada")
      .order("cancha_id"),
    supabase.from("turnos").select("id, hora_inicio, hora_fin").order("hora_inicio"),
    esSuperAdmin
      ? supabase.from("bot_config").select("clave, valor, descripcion, updated_at").order("clave")
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <ConfigClient
      canchas={canchas ?? []}
      precios={precios ?? []}
      datosBancarios={datosBancarios ?? []}
      disponibilidad={disponibilidad ?? []}
      turnos={turnos ?? []}
      botConfig={botConfig ?? []}
      esSuperAdmin={esSuperAdmin}
    />
  );
}
