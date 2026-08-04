import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/facturacion/crypto";
import { requireSuperAdmin } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();

  const allowed = ["nombre_interno", "cuit", "razon_social", "domicilio", "condicion_iva", "punto_venta", "afipsdk_token", "modo", "activo", "predeterminada"] as const;
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (body.cert_pem?.trim()) updates.cert_encrypted = encrypt(body.cert_pem.trim());
  if (body.key_pem?.trim()) updates.key_encrypted = encrypt(body.key_pem.trim());

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  updates.updated_at = new Date().toISOString();

  const supabase = await createSupabaseServerClient();

  // When setting predeterminada=true: clear flag on all others
  if (updates.predeterminada === true) {
    await supabase
      .from("entidades_fiscales")
      .update({ predeterminada: false })
      .neq("id", id);
  }

  const { data, error } = await supabase
    .from("entidades_fiscales")
    .update(updates)
    .eq("id", id)
    .select("id, nombre_interno, cuit, razon_social, domicilio, condicion_iva, punto_venta, afipsdk_token, cert_encrypted, key_encrypted, modo, activo, predeterminada, updated_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { cert_encrypted, key_encrypted, ...rest } = data;
  return NextResponse.json({ ...rest, tiene_cert: !!cert_encrypted, tiene_key: !!key_encrypted });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Block deletion if cuentas_bancarias reference this entity
  const { count } = await supabase
    .from("cuentas_bancarias")
    .select("id", { count: "exact", head: true })
    .eq("entidad_fiscal_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `No se puede eliminar: tiene ${count} cuenta(s) bancaria(s) vinculada(s)` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("entidades_fiscales").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
