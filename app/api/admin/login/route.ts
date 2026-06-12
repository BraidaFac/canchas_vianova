import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signSession, getSessionCookieConfig } from "@/lib/auth";
import { createHash } from "crypto";

export async function POST(request: NextRequest) {
  const { telefono, pin } = await request.json();

  if (!telefono || !pin) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const pinHash = createHash("sha256").update(String(pin)).digest("hex");

  const { data: admin, error } = await supabase
    .from("admins")
    .select("id, nombre, rol, telefono, activo")
    .eq("telefono", telefono)
    .eq("pin_hash", pinHash)
    .eq("activo", true)
    .single();

  if (error || !admin) {
    return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
  }

  const token = await signSession({
    id: admin.id,
    nombre: admin.nombre,
    rol: admin.rol,
    telefono: admin.telefono,
  });

  const response = NextResponse.json({ ok: true, nombre: admin.nombre, rol: admin.rol });
  response.cookies.set(getSessionCookieConfig(token));
  return response;
}
