import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tipos_cancha")
    .select("id, nombre, jugadores, clave, activo")
    .order("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const { nombre, jugadores, clave, activo } = body;

  if (!nombre || !nombre.trim()) {
    return NextResponse.json({ error: "nombre es requerido" }, { status: 400 });
  }
  if (!jugadores || Number(jugadores) <= 0) {
    return NextResponse.json({ error: "jugadores debe ser mayor a 0" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("tipos_cancha")
    .insert({
      nombre: nombre.trim(),
      jugadores: Number(jugadores),
      clave: clave?.trim() || null,
      activo: activo ?? true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
