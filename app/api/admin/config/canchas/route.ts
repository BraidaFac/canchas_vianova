import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth.server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("canchas")
    .select("id, nombre, espacio_id, tipo_cancha_id, jugadores, activa, tipos_cancha(id, nombre, clave), espacios_fisicos(id, nombre)")
    .order("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { nombre, espacio_id, tipo_cancha_id, jugadores, activa } = body;

  if (!nombre || !nombre.trim()) {
    return NextResponse.json({ error: "nombre es requerido" }, { status: 400 });
  }
  if (!espacio_id) {
    return NextResponse.json({ error: "espacio_id es requerido" }, { status: 400 });
  }
  if (!tipo_cancha_id) {
    return NextResponse.json({ error: "tipo_cancha_id es requerido" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Resolve jugadores default from tipos_cancha if not provided
  let jugadoresVal = jugadores ? Number(jugadores) : null;
  if (!jugadoresVal) {
    const { data: tc } = await supabase
      .from("tipos_cancha")
      .select("jugadores")
      .eq("id", Number(tipo_cancha_id))
      .single();
    jugadoresVal = tc?.jugadores ?? 0;
  }

  const { data, error } = await supabase
    .from("canchas")
    .insert({
      nombre: nombre.trim(),
      espacio_id: Number(espacio_id),
      tipo_cancha_id: Number(tipo_cancha_id),
      jugadores: jugadoresVal,
      activa: activa ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
