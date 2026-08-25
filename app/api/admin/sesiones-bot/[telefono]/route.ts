import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ telefono: string }> }
) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { telefono } = await params;
  const supabase = await createSupabaseServerClient();

  // Only allow liberating pausado_por_bot sessions
  const { data: sesion } = await supabase
    .from("sesiones_bot")
    .select("estado")
    .eq("telefono", telefono)
    .single();

  if (!sesion) return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  if (sesion.estado !== "pausado_por_bot") {
    return NextResponse.json({ error: "Solo se pueden liberar sesiones pausadas" }, { status: 400 });
  }

  const { error } = await supabase
    .from("sesiones_bot")
    .update({ estado: "activo", ultima_actividad: new Date().toISOString() })
    .eq("telefono", telefono);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
