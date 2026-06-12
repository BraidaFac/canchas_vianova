import { createSupabaseServerClient } from "@/lib/supabase/server";
import ClientesClient from "@/components/admin/ClientesClient";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const supabase = await createSupabaseServerClient();

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nombre, telefono, created_at, reservas(count)")
    .order("created_at", { ascending: false })
    .limit(200);

  // Flatten count: Supabase returns reservas as [{count: N}]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientesConCount = (clientes ?? []).map((c: any) => ({
    ...c,
    reservas_count: c.reservas?.[0]?.count ?? 0,
  }));

  return <ClientesClient clientes={clientesConCount} />;
}
