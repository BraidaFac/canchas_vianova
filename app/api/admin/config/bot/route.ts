import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRoot } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireRoot();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bot_config")
    .select("clave, valor, descripcion, updated_at")
    .order("clave");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireRoot();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { clave, valor } = await req.json();
  if (!clave || valor === undefined) {
    return NextResponse.json({ error: "clave y valor son requeridos" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("bot_config")
    .update({ valor, updated_at: new Date().toISOString() })
    .eq("clave", clave);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
