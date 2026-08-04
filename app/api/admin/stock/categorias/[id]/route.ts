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
  const body = await req.json();
  const { nombre, color, orden, activo } = body as Partial<{
    nombre: string;
    color: string;
    orden: number;
    activo: boolean;
  }>;

  const patch: Record<string, unknown> = {};
  if (nombre !== undefined) patch.nombre = nombre.trim();
  if (color !== undefined) patch.color = color;
  if (orden !== undefined) patch.orden = orden;
  if (activo !== undefined) patch.activo = activo;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categorias")
    .update(patch)
    .eq("id", id)
    .select("id, nombre, color, orden, activo")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Block if productos reference this categoria
  const { count, error: countError } = await supabase
    .from("productos")
    .select("id", { count: "exact", head: true })
    .eq("categoria_id", id);

  if (countError) return NextResponse.json({ error: countError.message }, { status: 400 });
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: hay ${count} producto(s) en esta categoría` },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("categorias").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
