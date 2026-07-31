export type ReservaEstado = "pendiente_pago" | "confirmada" | "cancelada";
export type ReservaCanal = "whatsapp" | "web" | "manual";
export type AdminRol = "admin" | "superadmin";

export type TipoCancha = {
  id: number;
  nombre: string;
  jugadores: number;
  clave: string | null;
  activo: boolean;
};

export type PrecioRegla = {
  id: number;
  tipo_cancha_id: number;
  hora_desde: string;   // "HH:MM"
  hora_hasta: string;   // "HH:MM"
  dias_semana: number[] | null;
  precio: number;
  vigente_desde: string; // YYYY-MM-DD
  activa: boolean;
  tipo_cancha?: TipoCancha;
};

export type Cancha = {
  id: number;
  espacio_id: number;
  nombre: string;
  tipo_cancha_id: number;
  tipo_cancha?: TipoCancha;
  jugadores: number;
  activa: boolean;
};

export type Turno = {
  id: number;
  hora_inicio: string; // "HH:MM:SS"
  hora_fin: string;
};

export type Cliente = {
  id: string;
  telefono: string;
  nombre: string;
  created_at: string;
};

export type Reserva = {
  id: string;
  id_legible: string;
  cliente_id: string;
  cancha_id: number;
  turno_id: number;
  fecha: string; // YYYY-MM-DD
  monto_total: number;
  monto_abonado: number;
  estado: ReservaEstado;
  canal: ReservaCanal;
  recurrente_id: number | null;
  evento_id: number | null;
  created_at: string;
  // joined
  cliente?: Cliente;
  cancha?: Cancha;
  turno?: Turno;
};

export type Admin = {
  id: string;
  telefono: string;
  nombre: string;
  rol: AdminRol;
  activo: boolean;
  created_at: string;
};

export type Precio = {
  id: number;
  cancha_id: number;
  precio: number;
  vigente_desde: string;
};

export type DatosBancarios = {
  id: number;
  nombre_cuenta: string;
  alias: string;
  cbu: string;
  vigente_desde: string;
  activo: boolean;
};

export type DisponibilidadCancha = {
  cancha_id: number;
  dia_semana: number; // 0=domingo ... 6=sabado
  habilitada: boolean;
};

export type DisponibilidadOverride = {
  id: number;
  cancha_id: number | null;
  fecha: string;
  habilitada: boolean;
  motivo: string | null;
};

// Grilla cell data
export type SlotGrilla = {
  cancha_id: number;
  cancha_nombre: string;
  cancha_tipo_nombre: string;
  turno_id: number;
  hora_inicio: string;
  hora_fin: string;
  reserva: Reserva | null;
  es_fijo: boolean;
  disponible: boolean; // fn_cancha_disponible result
};

// ── Stock module ────────────────────────────────────────────────────────────

export type Categoria = {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  activo: boolean;
};

export type Producto = {
  id: string;
  nombre: string;
  categoria_id: string | null;
  precio: number;
  costo_con_iva: number | null;
  costo_neto: number | null;
  iva_alicuota_id: string | null;
  stock_actual: number;
  tiene_stock: boolean;
  unidad: 'unidad' | 'kg' | 'litro';
  activo: boolean;
  created_at: string;
  // joined
  categoria?: Categoria | null;
  iva_alicuota?: import("./facturacion/types").IvaAlicuota | null;
  margen?: number | null; // derived: (precio - costo_neto) / precio * 100
};

export type CompraItem = {
  id: string;
  compra_id: string;
  producto_id: string;
  cantidad: number;
  costo_con_iva: number;
  iva_alicuota_id: string;
  costo_neto: number;
  // joined
  producto?: Pick<Producto, 'id' | 'nombre'> | null;
  iva_alicuota?: import("./facturacion/types").IvaAlicuota | null;
};

export type Compra = {
  id: string;
  fecha: string;
  proveedor: string | null;
  notas: string | null;
  empleado_id: string | null;
  created_at: string;
  items?: CompraItem[];
};

export type {
  ConfigFacturacion,
  ConfigFacturacionRaw,
  Comprobante,
  ComprobanteEstado,
  EntidadFiscal,
  EntidadFiscalRaw,
  CuentaBancaria,
  Pago,
  MedioPago,
  OrigenTipo,
  EstadoFiscal,
  IvaAlicuota,
  ConfigModulos,
  PagoConComprobante,
  CobroOrigen,
} from "./facturacion/types";
