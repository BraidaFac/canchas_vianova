import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [preciosRes, comprasRes] = await Promise.all([
    supabase
      .from("producto_precios")
      .select("id, precio, vigente_desde, created_at")
      .eq("producto_id", id)
      .order("vigente_desde", { ascending: false }),
    supabase
      .from("compra_items")
      .select(`
        id, cantidad, costo_con_iva, costo_neto,
        compra:compras(id, fecha, proveedor, created_at)
      `)
      .eq("producto_id", id)
      .order("compra_id", { ascending: false }),
  ]);

  return NextResponse.json({
    precios: preciosRes.data ?? [],
    compras: comprasRes.data ?? [],
  });
}
