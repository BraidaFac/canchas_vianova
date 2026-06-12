import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("clientes")
    .select("id, nombre, telefono")
    .order("nombre")
    .limit(20);

  if (q.trim()) {
    query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const { telefono, nombre } = body;

  if (!telefono) {
    return NextResponse.json({ error: "Teléfono requerido" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("clientes")
    .upsert({ telefono, nombre: nombre ?? telefono }, { onConflict: "telefono" })
    .select("id, nombre, telefono")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
