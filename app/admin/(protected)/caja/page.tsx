import { getSession } from "@/lib/auth.server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import CajaClient from "@/components/admin/CajaClient";

export default async function CajaPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const supabase = await createSupabaseServerClient();
  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("pos")
    .eq("id", 1)
    .single();

  if (!modulos?.pos) redirect("/admin");

  return <CajaClient />;
}
