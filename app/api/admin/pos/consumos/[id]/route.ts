import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // 1. Fetch items to revert stock
  const { data: oldItems } = await supabase
    .from("consumo_items")
    .select("producto_id, cantidad")
    .eq("consumo_id", id);

  // 2. Revert stock
  for (const item of oldItems ?? []) {
    const { data: producto } = await supabase
      .from("productos")
      .select("tiene_stock, stock_actual")
      .eq("id", item.producto_id)
      .single();

    if (producto?.tiene_stock) {
      await supabase
        .from("productos")
        .update({ stock_actual: (producto.stock_actual ?? 0) + item.cantidad })
        .eq("id", item.producto_id);
    }
  }

  // 3. Delete pagos
  await supabase
    .from("pagos")
    .delete()
    .eq("origen_tipo", "consumo")
    .eq("origen_id", id);

  // 4. Delete consumo_items
  await supabase.from("consumo_items").delete().eq("consumo_id", id);

  // 5. Delete consumo
  const { error } = await supabase.from("consumos").delete().eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json();

  const { items, pagos, notas, total } = body as {
    items: Array<{ producto_id: string; cantidad: number; precio_unitario: number }>;
    pagos: Array<{ medio_pago: string; monto: number; cuenta_bancaria_id?: string | null }>;
    notas?: string | null;
    total: number;
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Debe haber al menos un producto" }, { status: 400 });
  }
  if (!pagos || pagos.length === 0) {
    return NextResponse.json({ error: "Debe haber al menos un medio de pago" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // 1. Fetch old items to revert stock
  const { data: oldItems } = await supabase
    .from("consumo_items")
    .select("producto_id, cantidad")
    .eq("consumo_id", id);

  // 2. Revert old stock
  for (const item of oldItems ?? []) {
    const { data: producto } = await supabase
      .from("productos")
      .select("tiene_stock, stock_actual")
      .eq("id", item.producto_id)
      .single();

    if (producto?.tiene_stock) {
      await supabase
        .from("productos")
        .update({ stock_actual: (producto.stock_actual ?? 0) + item.cantidad })
        .eq("id", item.producto_id);
    }
  }

  // 3. Delete old consumo_items
  await supabase.from("consumo_items").delete().eq("consumo_id", id);

  // 4. Insert new consumo_items
  const { error: itemsError } = await supabase.from("consumo_items").insert(
    items.map((item) => ({
      consumo_id: id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
    }))
  );

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // 5. Apply new stock
  for (const item of items) {
    const { data: producto } = await supabase
      .from("productos")
      .select("tiene_stock, stock_actual")
      .eq("id", item.producto_id)
      .single();

    if (producto?.tiene_stock) {
      await supabase
        .from("productos")
        .update({ stock_actual: (producto.stock_actual ?? 0) - item.cantidad })
        .eq("id", item.producto_id);
    }
  }

  // 6. Delete old pagos
  await supabase
    .from("pagos")
    .delete()
    .eq("origen_tipo", "consumo")
    .eq("origen_id", id);

  // 7. Insert new pagos
  await supabase.from("pagos").insert(
    pagos.map((p) => ({
      origen_tipo: "consumo",
      origen_id: id,
      medio_pago: p.medio_pago,
      monto: p.monto,
      cuenta_bancaria_id: p.cuenta_bancaria_id ?? null,
    }))
  );

  // 8. Update consumo
  const { error } = await supabase
    .from("consumos")
    .update({ total, notas: notas ?? null })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
