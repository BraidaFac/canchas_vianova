import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { error: "No autorizado", status: 401 as const };
  if (session.rol !== "superadmin") return { error: "Requiere superadmin", status: 403 as const };
  return { session };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();

  const allowed = ["nombre_display", "banco", "cbu", "alias", "entidad_fiscal_id", "activo"] as const;
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cuentas_bancarias")
    .update(updates)
    .eq("id", id)
    .select("*, entidad_fiscal:entidades_fiscales(id, nombre_interno, cuit)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Block if pagos reference this cuenta
  const { count } = await supabase
    .from("pagos")
    .select("id", { count: "exact", head: true })
    .eq("cuenta_bancaria_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${count} pago(s) vinculado(s)` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("cuentas_bancarias").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
