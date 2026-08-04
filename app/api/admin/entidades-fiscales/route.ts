import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/facturacion/crypto";
import { requireSuperAdmin } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("entidades_fiscales")
    .select("id, nombre_interno, cuit, razon_social, domicilio, condicion_iva, punto_venta, afipsdk_token, cert_encrypted, key_encrypted, modo, activo, predeterminada, updated_at, created_at")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Strip raw certs, replace with boolean flags
  const safe = (data ?? []).map(({ cert_encrypted, key_encrypted, ...rest }) => ({
    ...rest,
    tiene_cert: !!cert_encrypted,
    tiene_key: !!key_encrypted,
  }));

  return NextResponse.json(safe);
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { nombre_interno, cuit, razon_social, domicilio, condicion_iva, punto_venta, afipsdk_token, modo, activo, predeterminada, cert_pem, key_pem } = body;

  if (!nombre_interno?.trim()) {
    return NextResponse.json({ error: "nombre_interno es requerido" }, { status: 400 });
  }

  const insert: Record<string, unknown> = {
    nombre_interno: nombre_interno.trim(),
    cuit: cuit?.trim() || null,
    razon_social: razon_social?.trim() || null,
    domicilio: domicilio?.trim() || null,
    condicion_iva: condicion_iva || null,
    punto_venta: punto_venta ? Number(punto_venta) : null,
    afipsdk_token: afipsdk_token?.trim() || null,
    modo: modo ?? "testing",
    activo: activo ?? true,
    predeterminada: predeterminada ?? false,
  };

  if (cert_pem?.trim()) insert.cert_encrypted = encrypt(cert_pem.trim());
  if (key_pem?.trim()) insert.key_encrypted = encrypt(key_pem.trim());

  const supabase = await createSupabaseServerClient();

  // If setting predeterminada=true, unset all others first
  if (insert.predeterminada) {
    await supabase.from("entidades_fiscales").update({ predeterminada: false }).eq("predeterminada", true);
  }

  const { data, error } = await supabase
    .from("entidades_fiscales")
    .insert(insert)
    .select("id, nombre_interno, cuit, razon_social, domicilio, condicion_iva, punto_venta, afipsdk_token, modo, activo, predeterminada, updated_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, tiene_cert: !!insert.cert_encrypted, tiene_key: !!insert.key_encrypted }, { status: 201 });
}
