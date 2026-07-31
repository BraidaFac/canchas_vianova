export type ComprobanteEstado = "pendiente" | "emitida" | "fallida" | "anulada";
export type CondicionIVA = "monotributo" | "responsable_inscripto";
export type ModoAfip = "testing" | "produccion";
export type MedioPago = "efectivo" | "transferencia" | "otro";
export type OrigenTipo = "reserva" | "consumo";
export type EstadoFiscal = "facturado" | "mixto" | "sin_comprobante";

// ─── Entidades Fiscales ──────────────────────────────────────────────────────

export type EntidadFiscal = {
  id: string;
  nombre_interno: string;
  cuit: string | null;
  razon_social: string | null;
  domicilio: string | null;
  condicion_iva: CondicionIVA | null;
  punto_venta: number | null;
  afipsdk_token: string | null;
  tiene_cert: boolean;
  tiene_key: boolean;
  modo: ModoAfip;
  activo: boolean;
  predeterminada: boolean;
  updated_at: string;
  created_at: string;
};

// Internal type with raw encrypted fields — server only, never sent to client
export type EntidadFiscalRaw = Omit<EntidadFiscal, "tiene_cert" | "tiene_key"> & {
  cert_encrypted: string | null;
  key_encrypted: string | null;
};

// ─── Cuentas Bancarias ───────────────────────────────────────────────────────

export type CuentaBancaria = {
  id: string;
  nombre_display: string;
  banco: string | null;
  cbu: string | null;
  alias: string | null;
  entidad_fiscal_id: string;
  activo: boolean;
  created_at: string;
  // joined
  entidad_fiscal?: Pick<EntidadFiscal, "id" | "nombre_interno" | "cuit"> | null;
};

// ─── Pagos ───────────────────────────────────────────────────────────────────

export type Pago = {
  id: string;
  origen_tipo: OrigenTipo;
  origen_id: string;
  medio_pago: MedioPago;
  monto: number;
  cuenta_bancaria_id: string | null;
  empleado_id: string | null;
  created_at: string;
  // joined
  cuenta_bancaria?: CuentaBancaria | null;
};

// ─── Comprobantes ────────────────────────────────────────────────────────────

export type Comprobante = {
  id: string;
  // New columns (pago_id replaces reserva_id for new flow)
  pago_id: string | null;
  origen_tipo: OrigenTipo | null;
  // Legacy column kept during transition
  reserva_id: string | null;
  tipo_cbte: number;
  punto_venta: number | null;
  nro_cbte: number | null;
  fecha_cbte: string;       // YYYY-MM-DD
  cae: string | null;
  vencimiento_cae: string | null;
  importe: number;
  concepto: number;
  doc_tipo: number;
  doc_nro: number;
  nombre_receptor: string | null;
  estado: ComprobanteEstado;
  cae_manual: boolean;
  intentos: number;
  datos_envio: Record<string, unknown> | null;
  datos_respuesta: Record<string, unknown> | null;
  ultimo_error: string | null;
  emitida_at: string | null;
  created_at: string;
  // joined
  reserva?: { id: string; id_legible: string; fecha: string } | null;
  pago?: (Pago & { cuenta_bancaria?: CuentaBancaria | null }) | null;
};

// ─── IVA Alícuotas ───────────────────────────────────────────────────────────

export type IvaAlicuota = {
  id: string;
  nombre: string;
  porcentaje: number;
  predeterminada: boolean;
  activo: boolean;
};

// ─── Config Módulos ──────────────────────────────────────────────────────────

export type ConfigModulos = {
  id: 1;
  facturacion: boolean;
  pos: boolean;
  stock: boolean;
};

// ─── Cobros (derived view type) ──────────────────────────────────────────────

export type PagoConComprobante = Pago & {
  comprobante?: Pick<Comprobante, "id" | "cae" | "estado" | "importe"> | null;
};

export type CobroOrigen = {
  id: string;
  tipo: OrigenTipo;
  descripcion: string;    // e.g. "Reserva #R-001" or "Consumo"
  fecha: string;          // ISO date string
  total: number;          // sum of all pagos
  estado_fiscal: EstadoFiscal;
  pagos: PagoConComprobante[];
};

// ─── Legacy types (kept for any code not yet migrated) ───────────────────────

/** @deprecated Use EntidadFiscal instead */
export type ConfigFacturacion = {
  id: 1;
  cuit: string | null;
  razon_social: string | null;
  domicilio: string | null;
  condicion_iva: CondicionIVA;
  punto_venta: number | null;
  afipsdk_token: string | null;
  tiene_cert: boolean;
  tiene_key: boolean;
  modo: ModoAfip;
  activo: boolean;
  updated_at: string;
};

/** @deprecated Use EntidadFiscalRaw instead */
export type ConfigFacturacionRaw = Omit<ConfigFacturacion, "tiene_cert" | "tiene_key"> & {
  cert_encrypted: string | null;
  key_encrypted: string | null;
};
