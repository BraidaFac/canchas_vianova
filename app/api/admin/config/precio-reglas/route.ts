import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth.server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("precio_reglas")
    .select("id, tipo_cancha_id, hora_desde, hora_hasta, dias_semana, precio, vigente_desde, activa, tipos_cancha(id, nombre, jugadores, clave, activo)")
    .order("tipo_cancha_id")
    .order("hora_desde")
    .order("vigente_desde", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { tipo_cancha_id, hora_desde, hora_hasta, dias_semana, precio, vigente_desde } = body;

  if (!tipo_cancha_id) {
    return NextResponse.json({ error: "tipo_cancha_id es requerido" }, { status: 400 });
  }
  if (!hora_desde || !hora_hasta || hora_desde >= hora_hasta) {
    return NextResponse.json({ error: "hora_desde debe ser anterior a hora_hasta" }, { status: 400 });
  }
  if (!precio || Number(precio) <= 0) {
    return NextResponse.json({ error: "El precio debe ser mayor a 0" }, { status: 400 });
  }

  const hoy = new Date().toISOString().slice(0, 10);

  const supabase = await createSupabaseServerClient();

  // Validar solapamiento con reglas activas del mismo tipo
  const { data: existentes } = await supabase
    .from("precio_reglas")
    .select("id, hora_desde, hora_hasta, dias_semana")
    .eq("tipo_cancha_id", Number(tipo_cancha_id))
    .eq("activa", true);

  const conflicto = (existentes ?? []).find((r) => {
    const hDesde = r.hora_desde.slice(0, 5);
    const hHasta = r.hora_hasta.slice(0, 5);
    if (!(hora_desde < hHasta && hDesde < hora_hasta)) return false;
    const aDias: number[] | null = dias_semana ?? null;
    const bDias: number[] | null = r.dias_semana as number[] | null;
    if (aDias === null || bDias === null) return true;
    return aDias.some((d) => bDias.includes(d));
  });

  if (conflicto) {
    const hd = conflicto.hora_desde.slice(0, 5);
    const hh = conflicto.hora_hasta.slice(0, 5);
    return NextResponse.json(
      { error: `Horario se solapa con regla existente (${hd}–${hh})` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from("precio_reglas")
    .insert({
      tipo_cancha_id: Number(tipo_cancha_id),
      hora_desde,
      hora_hasta,
      dias_semana: dias_semana ?? null,
      precio: Number(precio),
      vigente_desde: vigente_desde ?? hoy,
      activa: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
