import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth.server";
import { hasMinRole } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("config_modulos")
    .select("caja_cutoff_hour")
    .eq("id", 1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!hasMinRole(session, "superadmin")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await request.json();
  const { caja_cutoff_hour } = body;

  if (
    typeof caja_cutoff_hour !== "number" ||
    caja_cutoff_hour < 0 ||
    caja_cutoff_hour > 23
  ) {
    return NextResponse.json({ error: "caja_cutoff_hour debe ser entre 0 y 23" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("config_modulos")
    .update({ caja_cutoff_hour })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
