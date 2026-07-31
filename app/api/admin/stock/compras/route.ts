import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("compras")
    .select(`
      id, fecha, proveedor, notas, empleado_id, created_at,
      items:compra_items(
        id, compra_id, producto_id, cantidad, costo_con_iva, iva_alicuota_id, costo_neto,
        producto:productos(id, nombre),
        iva_alicuota:iva_alicuotas(id, nombre, porcentaje, predeterminada, activo)
      )
    `)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? []);
}

type PostItem = {
  producto_id: string;
  cantidad: number;
  costo_con_iva: number;
  iva_alicuota_id: string;
  costo_neto: number;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { fecha, proveedor, notas, items } = body as {
    fecha?: string;
    proveedor?: string;
    notas?: string;
    items: PostItem[];
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Se requiere al menos un ítem" }, { status: 400 });
  }

  for (const item of items) {
    if (!item.producto_id || !item.iva_alicuota_id) {
      return NextResponse.json({ error: "Cada ítem requiere producto e IVA" }, { status: 400 });
    }
    if (!item.cantidad || item.cantidad <= 0) {
      return NextResponse.json({ error: "Cantidad debe ser mayor a 0" }, { status: 400 });
    }
    if (item.costo_con_iva < 0) {
      return NextResponse.json({ error: "Costo no puede ser negativo" }, { status: 400 });
    }
  }

  const supabase = await createSupabaseServerClient();

  // 1. Create compra header
  const { data: compra, error: compraError } = await supabase
    .from("compras")
    .insert({
      fecha: fecha ?? new Date().toISOString().split("T")[0],
      proveedor: proveedor ?? null,
      notas: notas ?? null,
    })
    .select("id, fecha, proveedor, notas, empleado_id, created_at")
    .single();

  if (compraError || !compra) {
    return NextResponse.json({ error: compraError?.message ?? "Error al crear compra" }, { status: 400 });
  }

  // 2. Insert items
  const itemsToInsert = items.map((item) => ({
    compra_id: compra.id,
    producto_id: item.producto_id,
    cantidad: item.cantidad,
    costo_con_iva: item.costo_con_iva,
    iva_alicuota_id: item.iva_alicuota_id,
    costo_neto: item.costo_neto,
  }));

  const { error: itemsError } = await supabase.from("compra_items").insert(itemsToInsert);
  if (itemsError) {
    // Rollback: delete the compra (cascade deletes items too)
    await supabase.from("compras").delete().eq("id", compra.id);
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  // 3. Update stock and costs for each producto
  for (const item of items) {
    const { data: prod } = await supabase
      .from("productos")
      .select("stock_actual")
      .eq("id", item.producto_id)
      .single();

    if (!prod) continue;

    await supabase
      .from("productos")
      .update({
        stock_actual: (prod.stock_actual ?? 0) + item.cantidad,
        costo_con_iva: item.costo_con_iva,
        costo_neto: item.costo_neto,
        iva_alicuota_id: item.iva_alicuota_id,
      })
      .eq("id", item.producto_id);
  }

  // 4. Return compra with items
  const { data: full, error: fullError } = await supabase
    .from("compras")
    .select(`
      id, fecha, proveedor, notas, empleado_id, created_at,
      items:compra_items(
        id, compra_id, producto_id, cantidad, costo_con_iva, iva_alicuota_id, costo_neto,
        producto:productos(id, nombre),
        iva_alicuota:iva_alicuotas(id, nombre, porcentaje, predeterminada, activo)
      )
    `)
    .eq("id", compra.id)
    .single();

  if (fullError) return NextResponse.json({ error: fullError.message }, { status: 400 });
  return NextResponse.json(full, { status: 201 });
}
