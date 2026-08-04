import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth.server";
import { validarSesionActiva } from "@/lib/caja/validar";
import type { MedioPago, OrigenTipo } from "@/lib/facturacion/types";

type PagoInput = {
  medio_pago: MedioPago;
  monto: number;
  cuenta_bancaria_id?: string | null;
  nombre_receptor?: string;
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await request.json();
  const {
    origen_tipo,
    origen_id,
    pagos: pagosInput,
  }: {
    origen_tipo: OrigenTipo;
    origen_id: string;
    pagos: PagoInput[];
  } = body;

  if (!origen_tipo || !["reserva", "consumo"].includes(origen_tipo)) {
    return NextResponse.json({ error: "origen_tipo inválido" }, { status: 400 });
  }
  if (!origen_id) {
    return NextResponse.json({ error: "origen_id es requerido" }, { status: 400 });
  }
  if (!Array.isArray(pagosInput) || pagosInput.length === 0) {
    return NextResponse.json({ error: "pagos debe ser un array no vacío" }, { status: 400 });
  }

  for (const p of pagosInput) {
    if (!p.medio_pago || !["efectivo", "transferencia", "otro"].includes(p.medio_pago)) {
      return NextResponse.json({ error: `medio_pago inválido: ${p.medio_pago}` }, { status: 400 });
    }
    if (!p.monto || Number(p.monto) <= 0) {
      return NextResponse.json({ error: "monto debe ser mayor a 0" }, { status: 400 });
    }
    if (p.medio_pago === "transferencia" && !p.cuenta_bancaria_id) {
      return NextResponse.json(
        { error: "cuenta_bancaria_id es requerido para pagos por transferencia" },
        { status: 400 }
      );
    }
  }

  const supabase = await createSupabaseServerClient();

  // Validar sesión de caja activa
  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("caja_cutoff_hour")
    .eq("id", 1)
    .single();

  const cutoffHour = modulos?.caja_cutoff_hour ?? 7;
  const cajaValidation = await validarSesionActiva(supabase, cutoffHour);

  if (!cajaValidation.ok) {
    return NextResponse.json(
      { error: "caja_requerida", code: cajaValidation.code },
      { status: 422 }
    );
  }

  const sesionCajaId = cajaValidation.sesion.id;

  // Verify origen_id exists
  if (origen_tipo === "reserva") {
    const { data: reserva } = await supabase
      .from("reservas")
      .select("id")
      .eq("id", origen_id)
      .single();
    if (!reserva) {
      return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
    }
  }

  // Insert pagos con sesion_caja_id
  const insertRows = pagosInput.map((p) => ({
    origen_tipo,
    origen_id,
    medio_pago: p.medio_pago,
    monto: Number(p.monto),
    cuenta_bancaria_id: p.cuenta_bancaria_id ?? null,
    empleado_id: session.id,
    sesion_caja_id: sesionCajaId,
  }));

  const { data: pagosCreados, error: pagosErr } = await supabase
    .from("pagos")
    .insert(insertRows)
    .select("*");

  if (pagosErr || !pagosCreados) {
    return NextResponse.json({ error: pagosErr?.message ?? "Error al crear pagos" }, { status: 500 });
  }

  // NOTA: emitirFactura ya no se llama aquí.
  // La facturación se dispara al cerrar caja desde /api/admin/caja/cerrar.

  return NextResponse.json({ pagos: pagosCreados }, { status: 201 });
}
