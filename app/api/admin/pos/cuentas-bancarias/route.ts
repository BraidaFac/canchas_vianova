import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("cuentas_bancarias")
    .select("id, nombre_display")
    .eq("activo", true)
    .order("nombre_display");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
