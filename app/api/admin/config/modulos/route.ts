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
    .from("config_modulos")
    .select("*")
    .eq("id", 1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const allowed = ["facturacion", "pos", "stock"] as const;
  const updates: Record<string, unknown> = {};

  for (const key of allowed) {
    if (key in body && typeof body[key] === "boolean") {
      updates[key] = body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("config_modulos")
    .update(updates)
    .eq("id", 1)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
