import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkConflictos } from "../route";

type SlotInput = { cancha_id: number; turno_id: number; dia_semana: number | null };

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { nombre, tipo, fecha_inicio, fecha_fin, notas, estado, slots } = body;

  const supabase = await createSupabaseServerClient();

  // If slots are being updated, validate conflicts
  // Need current event dates if not being changed
  if (slots !== undefined && !estado) {
    const { data: eventoActual } = await supabase
      .from("eventos")
      .select("fecha_inicio, fecha_fin")
      .eq("id", id)
      .single();

    if (eventoActual && slots.length > 0) {
      const rangoInicio = fecha_inicio ?? eventoActual.fecha_inicio;
      const rangoFin = fecha_fin ?? eventoActual.fecha_fin;
      const conflictos = await checkConflictos(
        supabase,
        slots as SlotInput[],
        rangoInicio,
        rangoFin,
        Number(id)
      );
      if (conflictos.length) {
        return NextResponse.json(
          {
            error: `Hay ${conflictos.length} reserva(s) activa(s) que se superponen con los slots del evento`,
            conflictos,
          },
          { status: 409 }
        );
      }
    }
  }

  const updates: Record<string, unknown> = {};
  if (nombre !== undefined) updates.nombre = nombre;
  if (tipo !== undefined) updates.tipo = tipo;
  if (fecha_inicio !== undefined) updates.fecha_inicio = fecha_inicio;
  if (fecha_fin !== undefined) updates.fecha_fin = fecha_fin;
  if (notas !== undefined) updates.notas = notas || null;
  if (estado !== undefined) updates.estado = estado;

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("eventos")
      .update(updates)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace slots if provided
  if (slots !== undefined) {
    await supabase.from("evento_slots").delete().eq("evento_id", id);
    if (slots.length > 0) {
      const slotsToInsert = slots.map((s: SlotInput) => ({
        evento_id: Number(id),
        cancha_id: s.cancha_id,
        turno_id: s.turno_id,
        dia_semana: s.dia_semana ?? null,
      }));
      const { error: slotError } = await supabase.from("evento_slots").insert(slotsToInsert);
      if (slotError) return NextResponse.json({ error: slotError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("eventos").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
