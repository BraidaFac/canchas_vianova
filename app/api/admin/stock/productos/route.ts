import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function calcMargen(precio: number, costoNeto: number | null): number | null {
  if (!costoNeto || precio <= 0) return null;
  return parseFloat(((precio - costoNeto) / precio * 100).toFixed(1));
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("productos")
    .select(`
      id, nombre, categoria_id, precio, costo_con_iva, costo_neto,
      iva_alicuota_id, stock_actual, tiene_stock, unidad, activo, created_at,
      categoria:categorias(id, nombre, color, orden, activo),
      iva_alicuota:iva_alicuotas(id, nombre, porcentaje, predeterminada, activo)
    `)
    .order("nombre");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const withMargen = (data ?? []).map((p) => ({
    ...p,
    margen: calcMargen(p.precio, p.costo_neto),
  }));

  return NextResponse.json(withMargen);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
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
  } = body as {
    nombre: string;
    categoria_id?: string | null;
    precio: number;
    costo_con_iva?: number | null;
    iva_alicuota_id?: string | null;
    stock_actual?: number;
    tiene_stock?: boolean;
    unidad?: 'unidad' | 'kg' | 'litro';
    activo?: boolean;
  };

  if (!nombre?.trim()) {
    return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  }
  if (precio === undefined || precio === null) {
    return NextResponse.json({ error: "Precio requerido" }, { status: 400 });
  }

  // Derive costo_neto if we have costo_con_iva and an alicuota
  let costoNeto: number | null = null;
  if (costo_con_iva != null && iva_alicuota_id) {
    const supabase = await createSupabaseServerClient();
    const { data: iva } = await supabase
      .from("iva_alicuotas")
      .select("porcentaje")
      .eq("id", iva_alicuota_id)
      .single();
    if (iva) costoNeto = costo_con_iva / (1 + iva.porcentaje / 100);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("productos")
    .insert({
      nombre: nombre.trim(),
      categoria_id: categoria_id ?? null,
      precio,
      costo_con_iva: costo_con_iva ?? null,
      costo_neto: costoNeto,
      iva_alicuota_id: iva_alicuota_id ?? null,
      stock_actual: stock_actual ?? 0,
      tiene_stock: tiene_stock ?? true,
      unidad: unidad ?? 'unidad',
      activo: activo ?? true,
    })
    .select(`
      id, nombre, categoria_id, precio, costo_con_iva, costo_neto,
      iva_alicuota_id, stock_actual, tiene_stock, unidad, activo, created_at,
      categoria:categorias(id, nombre, color, orden, activo),
      iva_alicuota:iva_alicuotas(id, nombre, porcentaje, predeterminada, activo)
    `)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(
    { ...data, margen: calcMargen(data.precio, data.costo_neto) },
    { status: 201 }
  );
}
