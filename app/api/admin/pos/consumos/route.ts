import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validarSesionActiva } from "@/lib/caja/validar";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createSupabaseServerClient();

  const { data: consumos, error } = await supabase
    .from("consumos")
    .select(`
      *,
      consumo_items(*, productos(id, nombre)),
      reserva:reservas(id, id_legible)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch pagos for all consumos (pagos uses origen_tipo/origen_id, no direct FK)
  const consumoIds = (consumos ?? []).map((c) => c.id);
  const pagosMap = new Map<string, unknown[]>();
  if (consumoIds.length > 0) {
    const { data: pagos } = await supabase
      .from("pagos")
      .select(`*, cuenta_bancaria:cuentas_bancarias(id, nombre_display)`)
      .eq("origen_tipo", "consumo")
      .in("origen_id", consumoIds);
    for (const p of pagos ?? []) {
      if (!pagosMap.has(p.origen_id)) pagosMap.set(p.origen_id, []);
      pagosMap.get(p.origen_id)!.push(p);
    }
  }

  const result = (consumos ?? []).map((c) => ({
    ...c,
    pagos: pagosMap.get(c.id) ?? [],
  }));

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { items, total, notas, reserva_id, pagos } = body as {
    items: Array<{ producto_id: string; cantidad: number; precio_unitario: number }>;
    total: number;
    notas?: string;
    reserva_id?: string;
    pagos: Array<{ medio_pago: string; monto: number; cuenta_bancaria_id?: string }>;
  };

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }
  if (!pagos || pagos.length === 0) {
    return NextResponse.json({ error: "Debe registrar al menos un pago" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Validar sesión de caja activa
  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("caja_cutoff_hour")
    .eq("id", 1)
    .single();

  const cutoffHour = modulos?.caja_cutoff_hour ?? 7;
  const cajaValidation = await validarSesionActiva(supabase, cutoffHour);

  if (!cajaValidation.ok) {
    return NextResponse.json(
      { error: "caja_requerida", code: cajaValidation.code },
      { status: 422 }
    );
  }

  const sesionCajaId = cajaValidation.sesion.id;

  // 1. Insert consumo
  const { data: consumo, error: consumoError } = await supabase
    .from("consumos")
    .insert({
      total,
      notas: notas ?? null,
      reserva_id: reserva_id ?? null,
      empleado_id: auth.id,
    })
    .select()
    .single();

  if (consumoError || !consumo) {
    return NextResponse.json({ error: consumoError?.message ?? "Error al crear consumo" }, { status: 500 });
  }

  // 2. Insert consumo_items
  const itemsToInsert = items.map((item) => ({
    consumo_id: consumo.id,
    producto_id: item.producto_id,
    cantidad: item.cantidad,
    precio_unitario: item.precio_unitario,
  }));

  const { error: itemsError } = await supabase.from("consumo_items").insert(itemsToInsert);

  if (itemsError) {
    // Attempt rollback
    await supabase.from("consumos").delete().eq("id", consumo.id);
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // 3. Decrement stock for products with tiene_stock = true
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

  // 4. Register pagos
  let comprobantes: unknown[] = [];
  try {
    const { data: pagosData, error: pagosError } = await supabase
      .from("pagos")
      .insert(
        pagos.map((p) => ({
          origen_tipo: "consumo",
          origen_id: consumo.id,
          medio_pago: p.medio_pago,
          monto: p.monto,
          cuenta_bancaria_id: p.cuenta_bancaria_id ?? null,
          empleado_id: auth.id,
          sesion_caja_id: sesionCajaId,
        }))
      )
      .select();

    if (pagosError) {
      console.error("Error registering pagos:", pagosError.message);
    }

    comprobantes = pagosData ?? [];
  } catch (e) {
    console.error("Pagos registration failed:", e);
  }

  return NextResponse.json({ consumo, comprobantes }, { status: 201 });
}
