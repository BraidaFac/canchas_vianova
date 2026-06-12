import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import EmpleadosClient from "@/components/admin/EmpleadosClient";

export const dynamic = "force-dynamic";

export default async function EmpleadosPage() {
  const session = await getSession();
  if (!session || session.rol !== "superadmin") redirect("/admin/grilla");

  const supabase = await createSupabaseServerClient();
  const { data: empleados } = await supabase
    .from("admins")
    .select("id, telefono, nombre, rol, activo, created_at")
    .order("created_at");

  return <EmpleadosClient empleados={empleados ?? []} sessionId={session.id} />;
}
