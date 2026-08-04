import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createSupabaseServerClient();

  const { data: productos, error } = await supabase
    .from("productos")
    .select(`
      *,
      categorias ( nombre, color ),
      consumo_items ( cantidad )
    `)
    .eq("activo", true)
    .order("nombre");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const mapped = (productos ?? []).map((p: any) => {
    const total_vendido = (p.consumo_items ?? []).reduce(
      (sum: number, ci: any) => sum + (ci.cantidad ?? 0),
      0
    );
    return {
      ...p,
      categoria_nombre: p.categorias?.nombre ?? "",
      categoria_color: p.categorias?.color ?? "#6b7280",
      total_vendido,
      categorias: undefined,
      consumo_items: undefined,
    };
  });

  // Sort: most sold first, then alphabetical
  mapped.sort((a: any, b: any) => {
    if (b.total_vendido !== a.total_vendido) return b.total_vendido - a.total_vendido;
    return a.nombre.localeCompare(b.nombre);
  });

  return NextResponse.json(mapped);
}
