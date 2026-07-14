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
  if (body.estado !== undefined) update.estado = body.estado;
  if (body.monto_total !== undefined) update.monto_total = body.monto_total;
  if (body.monto_abonado !== undefined) update.monto_abonado = body.monto_abonado;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("reservas")
    .update(update)
    .eq("id", id)
    .select("id, recurrente_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (body.cancelar_recurrente && data.recurrente_id) {
    const today = new Date().toISOString().slice(0, 10);

    // Cancel all future reservas tied to this subscription (excluding the one already updated)
    const { error: futureErr } = await supabase
      .from("reservas")
      .update({ estado: "cancelada" })
      .eq("recurrente_id", data.recurrente_id)
      .neq("id", id)
      .gte("fecha", today)
      .in("estado", ["pendiente_pago", "confirmada"]);
    if (futureErr) {
      return NextResponse.json({ error: futureErr.message }, { status: 400 });
    }

    // Deactivate the subscription itself
    const { error: recErr } = await supabase
      .from("reservas_recurrentes")
      .update({ activa: false })
      .eq("id", data.recurrente_id);
    if (recErr) {
      return NextResponse.json({ error: recErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({ id: data.id });
}
