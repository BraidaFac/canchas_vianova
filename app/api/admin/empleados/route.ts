import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { createHash } from "crypto";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.rol !== "superadmin") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { nombre, telefono, pin, rol } = await request.json();

  if (!nombre || !telefono || !pin) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const pinHash = createHash("sha256").update(String(pin)).digest("hex");

  const { error } = await supabase.from("admins").insert({
    nombre,
    telefono,
    pin_hash: pinHash,
    rol: rol ?? "admin",
    activo: true,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Teléfono ya registrado" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
