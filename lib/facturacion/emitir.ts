import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAfipClientDefault } from "./afip-client";

export type EmitirParams = {
  reservaId: string | null;
  monto: number;
  fechaReserva: string;    // YYYY-MM-DD — fecha del servicio
  nombreReceptor?: string;
};

export type EmitirResult = {
  cae: string;
  nroCbte: number;
  comprobanteId: string;
};

function toDateInt(dateStr: string): number {
  return parseInt(dateStr.replace(/-/g, ""), 10);
}

export async function emitirFactura(params: EmitirParams): Promise<EmitirResult> {
  const { reservaId, monto, fechaReserva, nombreReceptor } = params;
  const supabase = await createSupabaseServerClient();
  const fechaHoy = new Date().toISOString().slice(0, 10);

  // Insertar comprobante en estado pendiente ANTES de llamar a ARCA.
  // Si ARCA falla, el registro queda para reintento por el cron.
  const { data: cbte, error: insertErr } = await supabase
    .from("comprobantes")
    .insert({
      reserva_id: reservaId,
      fecha_cbte: fechaHoy,
      importe: monto,
      nombre_receptor: nombreReceptor ?? null,
      estado: "pendiente",
    })
    .select()
    .single();

  if (insertErr || !cbte) throw new Error("Error al crear registro de comprobante");

  try {
    const { client, config } = await getAfipClientDefault();
    const puntoVenta = config.punto_venta!;

    // monotributo → Factura C (11), responsable_inscripto → Factura B (6)
    const tipoCbte = config.condicion_iva === "responsable_inscripto" ? 6 : 11;

    const ultimoNro = await client.ElectronicBilling.getLastVoucher(
      puntoVenta,
      tipoCbte
    );
    const nroCbte = ultimoNro + 1;

    const payload = {
      CantReg: 1,
      PtoVta: puntoVenta,
      CbteTipo: tipoCbte,
      Concepto: 2,                    // 2 = Servicios
      DocTipo: 99,                    // 99 = Consumidor Final
      DocNro: 0,
      CbteDesde: nroCbte,
      CbteHasta: nroCbte,
      CbteFch: toDateInt(fechaHoy),
      ImpTotal: monto,
      ImpTotConc: 0,
      ImpNeto: monto,
      ImpOpEx: 0,
      ImpIVA: 0,
      ImpTrib: 0,
      MonId: "PES",
      MonCotiz: 1,
      CondicionIVAReceptorId: 5,      // 5 = Consumidor Final
      // Obligatorios para Concepto 2 (Servicios):
      FchServDesde: toDateInt(fechaReserva),
      FchServHasta: toDateInt(fechaReserva),
      FchVtoPago: toDateInt(fechaHoy),
    };

    // Guardar payload antes de enviar (para debug si falla durante el envío)
    await supabase
      .from("comprobantes")
      .update({
        tipo_cbte: tipoCbte,
        punto_venta: puntoVenta,
        nro_cbte: nroCbte,
        datos_envio: payload,
      })
      .eq("id", cbte.id);

    const respuesta = await client.ElectronicBilling.createVoucher(payload);

    const vencimientoStr = String(respuesta.CAEFchVto);
    const vencimiento = `${vencimientoStr.slice(0, 4)}-${vencimientoStr.slice(4, 6)}-${vencimientoStr.slice(6, 8)}`;

    await supabase
      .from("comprobantes")
      .update({
        estado: "emitida",
        cae: respuesta.CAE,
        vencimiento_cae: vencimiento,
        datos_respuesta: respuesta as Record<string, unknown>,
        emitida_at: new Date().toISOString(),
      })
      .eq("id", cbte.id);

    return { cae: respuesta.CAE, nroCbte, comprobanteId: cbte.id };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("comprobantes")
      .update({
        estado: "fallida",
        intentos: 1,
        ultimo_error: msg,
      })
      .eq("id", cbte.id);
    throw err;
  }
}
