import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) return { error: "No autorizado", status: 401 as const };
  if (session.rol !== "superadmin") return { error: "Requiere superadmin", status: 403 as const };
  return { session };
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cuentas_bancarias")
    .select("*, entidad_fiscal:entidades_fiscales(id, nombre_interno, cuit)")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { nombre_display, banco, cbu, alias, entidad_fiscal_id, activo } = body;

  if (!nombre_display?.trim()) {
    return NextResponse.json({ error: "nombre_display es requerido" }, { status: 400 });
  }
  if (!entidad_fiscal_id) {
    return NextResponse.json({ error: "entidad_fiscal_id es requerido" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("cuentas_bancarias")
    .insert({
      nombre_display: nombre_display.trim(),
      banco: banco?.trim() || null,
      cbu: cbu?.trim() || null,
      alias: alias?.trim() || null,
      entidad_fiscal_id,
      activo: activo ?? true,
    })
    .select("*, entidad_fiscal:entidades_fiscales(id, nombre_interno, cuit)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
