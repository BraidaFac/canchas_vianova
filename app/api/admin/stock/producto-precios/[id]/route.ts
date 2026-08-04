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
  const body = await req.json() as { precio?: number; vigente_desde?: string };

  const patch: Record<string, unknown> = {};
  if (body.precio !== undefined) patch.precio = body.precio;
  if (body.vigente_desde !== undefined) patch.vigente_desde = body.vigente_desde;

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("producto_precios")
    .update(patch)
    .eq("id", id)
    .select("id, precio, vigente_desde, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
