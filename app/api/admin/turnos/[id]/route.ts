import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  // Check if turno is used in any active reserva
  const { data: enUso } = await supabase
    .from("reservas")
    .select("id")
    .eq("turno_id", id)
    .in("estado", ["pendiente_pago", "confirmada"])
    .limit(1);

  if (enUso && enUso.length > 0) {
    return NextResponse.json(
      { error: "No se puede eliminar: el turno tiene reservas activas" },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("turnos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
