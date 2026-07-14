import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { error: "No autorizado", status: 401 };
  if (session.rol !== "superadmin") return { error: "Requiere superadmin", status: 403 };
  return { session };
}

export async function GET() {
  const check = await requireSuperAdmin();
  if (check.error) return NextResponse.json({ error: check.error }, { status: check.status });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("bot_config")
    .select("clave, valor, descripcion, updated_at")
    .order("clave");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  const check = await requireSuperAdmin();
  if (check.error) return NextResponse.json({ error: check.error }, { status: check.status });

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
