import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth.server";
import { redirect } from "next/navigation";
import { POSClient } from "@/components/admin/pos/POSClient";
import type { CuentaBancaria } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function POSPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const supabase = await createSupabaseServerClient();

  const { data: cuentasBancarias } = await supabase
    .from("cuentas_bancarias")
    .select("*")
    .eq("activo", true)
    .order("nombre_display");

  return (
    <POSClient cuentasBancarias={(cuentasBancarias ?? []) as CuentaBancaria[]} />
  );
}
