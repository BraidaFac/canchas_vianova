import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAfipClient } from "./afip-client";

export type EmitirParams = {
  pago_id: string;
  nombre_receptor?: string;
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
  const { pago_id, nombre_receptor } = params;
  const supabase = await createSupabaseServerClient();

  // Resolve pago → cuenta_bancaria → entidad_fiscal
  const { data: pago, error: pagoErr } = await supabase
    .from("pagos")
    .select(`
      *,
      cuenta_bancaria:cuentas_bancarias(
        *,
        entidad_fiscal:entidades_fiscales(*)
      )
    `)
    .eq("id", pago_id)
    .single();

  if (pagoErr || !pago) throw new Error("Pago no encontrado");
  if (pago.medio_pago !== "transferencia") {
    throw new Error("Solo se pueden emitir facturas para pagos por transferencia");
  }
  if (!pago.cuenta_bancaria) {
    throw new Error("El pago no tiene cuenta bancaria asociada");
  }

  const entidadFiscalId = pago.cuenta_bancaria.entidad_fiscal_id as string;
  const fechaHoy = new Date().toISOString().slice(0, 10);

  // Insert comprobante in pendiente state BEFORE calling ARCA.
  // If ARCA fails, the record stays for retry by cron.
  const { data: cbte, error: insertErr } = await supabase
    .from("comprobantes")
    .insert({
      pago_id,
      origen_tipo: pago.origen_tipo,
      fecha_cbte: fechaHoy,
      importe: pago.monto,
      nombre_receptor: nombre_receptor ?? null,
      estado: "pendiente",
      intentos: 0,
    })
    .select()
    .single();

  if (insertErr || !cbte) throw new Error("Error al crear registro de comprobante");

  try {
    const { client, config } = await getAfipClient(entidadFiscalId);
    const puntoVenta = config.punto_venta!;

    // monotributo → Factura C (11), responsable_inscripto → Factura B (6)
    const tipoCbte = config.condicion_iva === "responsable_inscripto" ? 6 : 11;

    const ultimoNro = await client.ElectronicBilling.getLastVoucher(puntoVenta, tipoCbte);
    const nroCbte = ultimoNro + 1;

    // For the service date: use today (pagos don't carry a fecha_reserva;
    // the reserva date is derivable from origen_tipo/origen_id if needed later)
    const payload = {
      CantReg: 1,
      PtoVta: puntoVenta,
      CbteTipo: tipoCbte,
      Concepto: 2,               // 2 = Servicios
      DocTipo: 99,               // 99 = Consumidor Final
      DocNro: 0,
      CbteDesde: nroCbte,
      CbteHasta: nroCbte,
      CbteFch: toDateInt(fechaHoy),
      ImpTotal: pago.monto,
      ImpTotConc: 0,
      ImpNeto: pago.monto,
      ImpOpEx: 0,
      ImpIVA: 0,
      ImpTrib: 0,
      MonId: "PES",
      MonCotiz: 1,
      CondicionIVAReceptorId: 5, // 5 = Consumidor Final
      FchServDesde: toDateInt(fechaHoy),
      FchServHasta: toDateInt(fechaHoy),
      FchVtoPago: toDateInt(fechaHoy),
    };

    // Save payload before sending (for debug if it fails mid-flight)
    await supabase
      .from("comprobantes")
      .update({
        tipo_cbte: tipoCbte,
        punto_venta: puntoVenta,
        nro_cbte: nroCbte,
        concepto: 2,
        doc_tipo: 99,
        doc_nro: 0,
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
      .update({ estado: "fallida", intentos: 1, ultimo_error: msg })
      .eq("id", cbte.id);
    throw err;
  }
}
