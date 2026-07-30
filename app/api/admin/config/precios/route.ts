import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { cancha_id, precio, tipo_cancha_id } = body;

  const supabase = await createSupabaseServerClient();
  const hoy = new Date().toISOString().slice(0, 10);

  // Bulk update by tipo_cancha_id
  if (tipo_cancha_id && precio != null && precio > 0) {
    const { data: canchas } = await supabase
      .from("canchas")
      .select("id")
      .eq("tipo_cancha_id", tipo_cancha_id)
      .eq("activa", true);

    if (!canchas || canchas.length === 0) {
      return NextResponse.json({ error: "No hay canchas activas de ese tipo" }, { status: 400 });
    }

    const { error } = await supabase.from("precios").upsert(
      canchas.map((c) => ({ cancha_id: c.id, precio, vigente_desde: hoy })),
      { onConflict: "cancha_id,vigente_desde" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  // Single cancha update
  if (!cancha_id || precio == null || precio <= 0) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const { error } = await supabase.from("precios").upsert(
    { cancha_id, precio, vigente_desde: hoy },
    { onConflict: "cancha_id,vigente_desde" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
