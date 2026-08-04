import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json() as { costo_con_iva?: number; cantidad?: number };

  const supabase = await createSupabaseServerClient();

  const patch: Record<string, unknown> = {};
  if (body.costo_con_iva !== undefined) patch.costo_con_iva = body.costo_con_iva;
  if (body.cantidad !== undefined) patch.cantidad = body.cantidad;

  // Recalculate costo_neto if costo_con_iva changed
  if (body.costo_con_iva !== undefined) {
    const { data: item } = await supabase
      .from("compra_items")
      .select("iva_alicuota_id")
      .eq("id", id)
      .single();
    if (item?.iva_alicuota_id) {
      const { data: iva } = await supabase
        .from("iva_alicuotas")
        .select("porcentaje")
        .eq("id", item.iva_alicuota_id)
        .single();
      if (iva) patch.costo_neto = body.costo_con_iva / (1 + iva.porcentaje / 100);
    }
  }

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  const { data, error } = await supabase
    .from("compra_items")
    .update(patch)
    .eq("id", id)
    .select(`id, cantidad, costo_con_iva, costo_neto, compra:compras(id, fecha, proveedor, created_at)`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
