import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function generateIdLegible(fecha: string): string {
  // fecha is YYYY-MM-DD → take last 6 as YYMMDD
  const parts = fecha.split("-");
  const yy = parts[0].slice(2);
  const mm = parts[1];
  const dd = parts[2];
  const datePart = yy + mm + dd;
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let rand = "";
  for (let i = 0; i < 4; i++) {
    rand += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MAN-${datePart}-${rand}`;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json();
  const {
    cliente_id,
    telefono,
    nombre,
    cancha_id,
    turno_id,
    fecha,
    monto_total,
    monto_abonado = 0,
    estado = "pendiente_pago",
    es_fijo = false,
    fecha_hasta,
    recurrente_id: recurrenteIdDirect,
  } = body;

  const supabase = await createSupabaseServerClient();

  let clienteId = cliente_id;

  // If no cliente_id provided but telefono is given, find or create client
  if (!clienteId && telefono) {
    const { data: existing } = await supabase
      .from("clientes")
      .select("id")
      .eq("telefono", telefono)
      .maybeSingle();

    if (existing) {
      clienteId = existing.id;
    } else {
      const { data: newCliente, error: createError } = await supabase
        .from("clientes")
        .insert({ telefono, nombre: nombre ?? telefono })
        .select("id")
        .single();

      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }
      clienteId = newCliente.id;
    }
  }

  // Turno fijo: usar recurrente_id existente o crear uno nuevo
  let recurrenteId: number | null = recurrenteIdDirect ?? null;
  if (!recurrenteId && es_fijo && clienteId) {
    const diaSemana = new Date(fecha + "T12:00:00").getDay();
    const { data: rec, error: recErr } = await supabase
      .from("reservas_recurrentes")
      .insert({
        cliente_id: clienteId,
        cancha_id,
        turno_id,
        dia_semana: diaSemana,
        fecha_desde: fecha,
        fecha_hasta: fecha_hasta ?? null,
        activa: true,
      })
      .select("id")
      .single();
    if (recErr) {
      return NextResponse.json({ error: recErr.message }, { status: 400 });
    }
    recurrenteId = rec.id;
  }

  const id_legible = generateIdLegible(fecha);

  const { data: reserva, error } = await supabase
    .from("reservas")
    .insert({
      cliente_id: clienteId ?? null,
      cancha_id,
      turno_id,
      fecha,
      monto_total,
      monto_abonado,
      // Fijos siempre confirmados
      estado: recurrenteId ? "confirmada" : estado,
      canal: "manual",
      id_legible,
      recurrente_id: recurrenteId,
    })
    .select("id, id_legible")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: reserva.id, id_legible: reserva.id_legible }, { status: 201 });
}
