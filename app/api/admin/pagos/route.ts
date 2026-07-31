import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { emitirFactura } from "@/lib/facturacion/emitir";
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

  // Verify origen_id exists (only reserva supported now; consumo table added in future plan)
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

  // Insert all pagos
  const insertRows = pagosInput.map((p) => ({
    origen_tipo,
    origen_id,
    medio_pago: p.medio_pago,
    monto: Number(p.monto),
    cuenta_bancaria_id: p.cuenta_bancaria_id ?? null,
    empleado_id: session.id,
  }));

  const { data: pagosCreados, error: pagosErr } = await supabase
    .from("pagos")
    .insert(insertRows)
    .select("*");

  if (pagosErr || !pagosCreados) {
    return NextResponse.json({ error: pagosErr?.message ?? "Error al crear pagos" }, { status: 500 });
  }

  // For each transferencia pago, attempt to emit factura
  const comprobantes: unknown[] = [];
  const erroresEmision: { pago_id: string; error: string }[] = [];

  for (let i = 0; i < pagosCreados.length; i++) {
    const pago = pagosCreados[i];
    if (pago.medio_pago === "transferencia") {
      try {
        const result = await emitirFactura({
          pago_id: pago.id,
          nombre_receptor: pagosInput[i].nombre_receptor,
        });
        // Fetch the created comprobante
        const { data: cbte } = await supabase
          .from("comprobantes")
          .select("*")
          .eq("id", result.comprobanteId)
          .single();
        if (cbte) comprobantes.push(cbte);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        erroresEmision.push({ pago_id: pago.id, error: msg });
      }
    }
  }

  return NextResponse.json(
    {
      pagos: pagosCreados,
      comprobantes,
      ...(erroresEmision.length > 0 ? { errores_emision: erroresEmision } : {}),
    },
    { status: 201 }
  );
}
