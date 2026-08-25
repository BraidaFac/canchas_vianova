import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth.server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const allowed = ["precio", "hora_desde", "hora_hasta", "dias_semana", "activa", "vigente_desde"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Si se cambia algún campo de horario/días, validar solapamiento
  const afectaHorario = ["hora_desde", "hora_hasta", "dias_semana"].some((k) => k in updates);
  if (afectaHorario) {
    const { data: actual, error: fetchErr } = await supabase
      .from("precio_reglas")
      .select("tipo_cancha_id, hora_desde, hora_hasta, dias_semana, vigente_desde")
      .eq("id", Number(id))
      .single();

    if (fetchErr || !actual) {
      return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
    }

    const horaDesde = (updates.hora_desde as string | undefined) ?? actual.hora_desde.slice(0, 5);
    const horaHasta = (updates.hora_hasta as string | undefined) ?? actual.hora_hasta.slice(0, 5);
    const diasSemana = "dias_semana" in updates
      ? (updates.dias_semana as number[] | null)
      : (actual.dias_semana as number[] | null);

    if (horaHasta !== "00:00" && horaDesde >= horaHasta) {
      return NextResponse.json({ error: "hora_desde debe ser anterior a hora_hasta" }, { status: 400 });
    }

    // Normaliza "00:00" a "24:00" para comparación de strings
    function norm(h: string) { return h === "00:00" ? "24:00" : h; }

    const vigenciaEfectiva = "vigente_desde" in updates
      ? (updates.vigente_desde as string)
      : actual.vigente_desde;

    const { data: existentes } = await supabase
      .from("precio_reglas")
      .select("id, hora_desde, hora_hasta, dias_semana, vigente_desde")
      .eq("tipo_cancha_id", actual.tipo_cancha_id)
      .eq("activa", true)
      .neq("id", Number(id));

    const conflicto = (existentes ?? []).find((r) => {
      if (r.vigente_desde !== vigenciaEfectiva) return false;
      const hd = norm(r.hora_desde.slice(0, 5));
      const hh = norm(r.hora_hasta.slice(0, 5));
      if (!(horaDesde < hh && hd < norm(horaHasta))) return false;
      const bDias: number[] | null = r.dias_semana as number[] | null;
      if (diasSemana === null || bDias === null) return true;
      return diasSemana.some((d) => bDias.includes(d));
    });

    if (conflicto) {
      const hd = conflicto.hora_desde.slice(0, 5);
      const hh = conflicto.hora_hasta.slice(0, 5);
      return NextResponse.json(
        { error: `Horario se solapa con regla existente (${hd}–${hh})` },
        { status: 409 }
      );
    }
  }

  const { data, error } = await supabase
    .from("precio_reglas")
    .update(updates)
    .eq("id", Number(id))
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("precio_reglas")
    .delete()
    .eq("id", Number(id));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
