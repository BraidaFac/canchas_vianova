import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function calcMargen(precio: number, costoNeto: number | null): number | null {
  if (!costoNeto || precio <= 0) return null;
  return parseFloat(((precio - costoNeto) / precio * 100).toFixed(1));
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json();

  const supabase = await createSupabaseServerClient();

  // Fetch current producto to detect precio change
  const { data: current, error: fetchError } = await supabase
    .from("productos")
    .select("precio, costo_con_iva, costo_neto, iva_alicuota_id")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  const {
    nombre,
    categoria_id,
    precio,
    costo_con_iva,
    iva_alicuota_id,
    stock_actual,
    tiene_stock,
    unidad,
    activo,
  } = body as Partial<{
    nombre: string;
    categoria_id: string | null;
    precio: number;
    costo_con_iva: number | null;
    iva_alicuota_id: string | null;
    stock_actual: number;
    tiene_stock: boolean;
    unidad: 'unidad' | 'kg' | 'litro';
    activo: boolean;
  }>;

  if (nombre !== undefined) patch.nombre = nombre.trim();
  if (categoria_id !== undefined) patch.categoria_id = categoria_id;
  if (precio !== undefined) patch.precio = precio;
  if (costo_con_iva !== undefined) patch.costo_con_iva = costo_con_iva;
  if (iva_alicuota_id !== undefined) patch.iva_alicuota_id = iva_alicuota_id;
  if (stock_actual !== undefined) patch.stock_actual = stock_actual;
  if (tiene_stock !== undefined) patch.tiene_stock = tiene_stock;
  if (unidad !== undefined) patch.unidad = unidad;
  if (activo !== undefined) patch.activo = activo;

  // Recalculate costo_neto when costo_con_iva or iva_alicuota_id changes
  const newCostoConIva = costo_con_iva !== undefined ? costo_con_iva : current.costo_con_iva;
  const newIvaId = iva_alicuota_id !== undefined ? iva_alicuota_id : current.iva_alicuota_id;
  if ((costo_con_iva !== undefined || iva_alicuota_id !== undefined) && newCostoConIva && newIvaId) {
    const { data: iva } = await supabase
      .from("iva_alicuotas")
      .select("porcentaje")
      .eq("id", newIvaId)
      .single();
    if (iva) patch.costo_neto = newCostoConIva / (1 + iva.porcentaje / 100);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("productos")
    .update(patch)
    .eq("id", id)
    .select(`
      id, nombre, categoria_id, precio, costo_con_iva, costo_neto,
      iva_alicuota_id, stock_actual, tiene_stock, unidad, activo, created_at,
      categoria:categorias(id, nombre, color, orden, activo),
      iva_alicuota:iva_alicuotas(id, nombre, porcentaje, predeterminada, activo)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Auto-insert price history if precio changed
  if (precio !== undefined && precio !== current.precio) {
    await supabase.from("producto_precios").insert({
      producto_id: id,
      precio,
      vigente_desde: new Date().toISOString().split("T")[0],
    });
  }

  return NextResponse.json(
    { ...data, margen: calcMargen(data.precio, data.costo_neto) }
  );
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
