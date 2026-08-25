import { createSupabaseServerClient } from "@/lib/supabase/server";
import SesionesBotClient from "@/components/admin/SesionesBotClient";

export const dynamic = "force-dynamic";

export default async function BotPage() {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("sesiones_bot")
    .select("telefono, estado, ultima_actividad, datos_pendientes, cliente_id")
    .order("ultima_actividad", { ascending: false });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <SesionesBotClient sesiones={(data ?? []) as any[]} />;
}
