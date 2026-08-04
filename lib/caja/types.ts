// lib/caja/types.ts

export type JornadaEstado = "abierta" | "cerrada";
export type SesionEstado = "abierta" | "cerrada";

export type EstadoCajaCode =
  | "ok"                        // sesión abierta y de la jornada actual
  | "jornada_vencida"           // sesión abierta pero de otra jornada
  | "caja_cerrada_misma_jornada" // sesión cerrada, misma jornada del día
  | "sin_caja";                 // no hay sesión ni jornada del día

export type JornadaOperativa = {
  id: string;
  fecha_jornada: string;        // YYYY-MM-DD
  estado: JornadaEstado;
  abierta_at: string;
  cerrada_at: string | null;
  admin_apertura_id: string | null;
  admin_cierre_id: string | null;
  created_at: string;
};

export type SesionCaja = {
  id: string;
  jornada_id: string;
  estado: SesionEstado;
  monto_apertura: number;
  monto_cierre_declarado: number | null;
  abierta_at: string;
  cerrada_at: string | null;
  admin_id: string | null;
  resumen_json: ResumenCaja | null;
  created_at: string;
  // joined
  jornada?: JornadaOperativa | null;
};

export type ResumenCaja = {
  total_efectivo: number;
  total_transferencia: number;
  total_otro: number;
  total_reservas: number;
  total_consumos: number;
  diferencia_efectivo: number;   // monto_apertura + cobros_efectivo - monto_cierre_declarado
};

export type CajaValidationResult =
  | { ok: true; sesion: SesionCaja }
  | { ok: false; code: Exclude<EstadoCajaCode, "ok"> };

export type EstadoCajaResponse = {
  code: EstadoCajaCode;
  sesion: SesionCaja | null;
  jornada: JornadaOperativa | null;
  fecha_jornada_actual: string;
};
