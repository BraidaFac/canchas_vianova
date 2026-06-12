export type CanchaType = "f5" | "f8";
export type ReservaEstado = "pendiente_pago" | "confirmada" | "cancelada";
export type ReservaCanal = "whatsapp" | "web" | "manual";
export type AdminRol = "admin" | "superadmin";

export type Cancha = {
  id: number;
  espacio_id: number;
  nombre: string;
  tipo: CanchaType;
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
  cancha_tipo: CanchaType;
  turno_id: number;
  hora_inicio: string;
  hora_fin: string;
  reserva: Reserva | null;
  es_fijo: boolean;
  disponible: boolean; // fn_cancha_disponible result
};
