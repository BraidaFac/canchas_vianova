import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { createHash } from "crypto";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.rol !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const supabase = await createSupabaseServerClient();

  // Build update payload — only include defined fields
  const update: Record<string, unknown> = {};
  if (body.nombre !== undefined) update.nombre = body.nombre;
  if (body.telefono !== undefined) update.telefono = body.telefono;
  if (body.username !== undefined) update.username = body.username || null;
  if (body.rol !== undefined) update.rol = body.rol;
  if (body.activo !== undefined) update.activo = body.activo;
  if (body.pin && body.pin.length >= 4) {
    update.pin_hash = createHash("sha256").update(String(body.pin)).digest("hex");
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const { error } = await supabase.from("admins").update(update).eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
