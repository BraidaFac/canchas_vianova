import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { cancha_id, dia_semana, habilitada } = await request.json();
  const supabase = await createSupabaseServerClient();

  // Get cancha info
  const { data: cancha } = await supabase
    .from("canchas")
    .select("espacio_id, tipo")
    .eq("id", cancha_id)
    .single();

  if (!cancha) return NextResponse.json({ error: "Cancha no encontrada" }, { status: 404 });

  if (habilitada) {
    if (cancha.tipo === "f8") {
      // Reject if any F5 in same espacio is enabled for this day
      const { data: f5canchas } = await supabase
        .from("canchas")
        .select("id")
        .eq("espacio_id", cancha.espacio_id)
        .eq("tipo", "f5")
        .eq("activa", true);

      if (f5canchas && f5canchas.length > 0) {
        const { data: enabledF5 } = await supabase
          .from("disponibilidad_cancha")
          .select("cancha_id")
          .in("cancha_id", f5canchas.map((c) => c.id))
          .eq("dia_semana", dia_semana)
          .eq("habilitada", true);

        if (enabledF5 && enabledF5.length > 0) {
          return NextResponse.json(
            { error: "No se puede habilitar: hay una cancha F5 habilitada en el mismo espacio para este día" },
            { status: 409 }
          );
        }
      }
    } else if (cancha.tipo === "f5") {
      // Auto-disable F8 canchas in same espacio for this day
      const { data: f8canchas } = await supabase
        .from("canchas")
        .select("id")
        .eq("espacio_id", cancha.espacio_id)
        .eq("tipo", "f8")
        .eq("activa", true);

      if (f8canchas && f8canchas.length > 0) {
        await supabase.from("disponibilidad_cancha").upsert(
          f8canchas.map((c) => ({ cancha_id: c.id, dia_semana, habilitada: false })),
          { onConflict: "cancha_id,dia_semana" }
        );
      }
    }
  }

  const { error } = await supabase
    .from("disponibilidad_cancha")
    .upsert({ cancha_id, dia_semana, habilitada }, { onConflict: "cancha_id,dia_semana" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
