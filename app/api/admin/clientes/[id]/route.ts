import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const update: Record<string, unknown> = {};
  if (body.nombre !== undefined) update.nombre = body.nombre;
  if (body.telefono !== undefined) update.telefono = body.telefono;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("clientes")
    .update(update)
    .eq("id", id)
    .select("id, nombre, telefono")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  try {
    const { error } = await supabase
      .from("clientes")
      .update({ activo: false })
      .eq("id", id);

    if (error) {
      if (error.message.includes("activo") || error.code === "PGRST204" || error.code === "42703") {
        return NextResponse.json(
          {
            error:
              "Requiere migración: ALTER TABLE clientes ADD COLUMN activo BOOLEAN NOT NULL DEFAULT true;",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error:
          "Requiere migración: ALTER TABLE clientes ADD COLUMN activo BOOLEAN NOT NULL DEFAULT true;",
      },
      { status: 400 }
    );
  }
}
