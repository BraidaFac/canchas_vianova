import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { nombre_cuenta, alias, cbu } = await request.json();

  if (!nombre_cuenta || !alias || !cbu) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  // Deactivate previous entries
  await supabase.from("datos_bancarios").update({ activo: false }).eq("activo", true);

  // Insert new active entry
  const { error } = await supabase.from("datos_bancarios").insert({
    nombre_cuenta,
    alias,
    cbu,
    vigente_desde: new Date().toISOString().slice(0, 10),
    activo: true,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
