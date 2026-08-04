import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getModulos() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("config_modulos")
    .select("facturacion, pos, stock")
    .eq("id", 1)
    .single();
  return data ?? { facturacion: false, pos: false, stock: false };
}
