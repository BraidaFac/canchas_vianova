-- ============================================================
-- Migration: Initial Schema
-- Source: production DB introspection 2026-08-01
--
-- NOTE ON EVENT TRIGGER:
--   `ensure_rls` (calls rls_auto_enable) is a Supabase-managed
--   event trigger — it already exists in any fresh Supabase project.
--   Do NOT recreate it here.
--
-- NOTE ON RLS:
--   All tables get RLS auto-enabled by `ensure_rls` on CREATE TABLE.
--   No explicit ENABLE ROW LEVEL SECURITY needed.
--   Policies must be added separately (not included here — they were
--   not captured in the introspection).
--
-- CRON JOBS (pg_cron — run after tables exist):
--   Job 1 (*/10 * * * *): auto-cancel reservas pendiente_pago > 1h
--   Job 2 (0 6 * * 1):    generate reservas from reservas_recurrentes
--
-- VERCEL CRON (vercel.json — NOT a DB job):
--   /api/admin/facturacion/procesar-cola — every 10 min
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Trigger function ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ── Tables ────────────────────────────────────────────────────

CREATE TABLE espacios_fisicos (
  id     smallserial PRIMARY KEY,
  nombre text        NOT NULL UNIQUE,
  activo bool        NOT NULL DEFAULT true
);

CREATE TABLE tipos_cancha (
  id        serial  PRIMARY KEY,
  nombre    text    NOT NULL,
  jugadores integer NOT NULL,
  clave     text    UNIQUE,
  activo    bool    NOT NULL DEFAULT true
);

CREATE TABLE turnos (
  id          smallint PRIMARY KEY,
  hora_inicio time     NOT NULL UNIQUE,
  hora_fin    time     NOT NULL
);

CREATE TABLE canchas (
  id             smallint PRIMARY KEY,
  espacio_id     smallint NOT NULL REFERENCES espacios_fisicos(id),
  nombre         text     NOT NULL UNIQUE,
  tipo           text     NOT NULL CHECK (tipo IN ('f5','f8')),
  jugadores      smallint NOT NULL,
  activa         bool     NOT NULL DEFAULT true,
  tipo_cancha_id integer  NOT NULL REFERENCES tipos_cancha(id)
);

CREATE TABLE clientes (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  telefono   text        NOT NULL UNIQUE,
  nombre     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX clientes_telefono_idx ON clientes (telefono);

CREATE TABLE admins (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  telefono   text        NOT NULL UNIQUE,
  nombre     text        NOT NULL,
  pin_hash   text        NOT NULL,
  activo     bool        NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  rol        text        NOT NULL DEFAULT 'admin' CHECK (rol IN ('superadmin','admin')),
  username   text        UNIQUE
);

CREATE TABLE audit_log (
  id              bigserial   PRIMARY KEY,
  admin_id        uuid        REFERENCES admins(id),
  accion          text        NOT NULL,
  entidad         text        NOT NULL,
  entidad_id      text,
  payload_antes   jsonb,
  payload_despues jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bot_config (
  clave       text        PRIMARY KEY,
  valor       text        NOT NULL,
  descripcion text,
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE datos_bancarios (
  id            serial  PRIMARY KEY,
  nombre_cuenta text    NOT NULL,
  alias         text    NOT NULL,
  cbu           text    NOT NULL,
  vigente_desde date    NOT NULL DEFAULT CURRENT_DATE,
  activo        bool    NOT NULL DEFAULT true
);

CREATE TABLE disponibilidad_cancha (
  cancha_id  smallint NOT NULL REFERENCES canchas(id),
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  habilitada bool     NOT NULL DEFAULT true,
  PRIMARY KEY (cancha_id, dia_semana)
);

CREATE TABLE disponibilidad_overrides (
  id         serial   PRIMARY KEY,
  cancha_id  smallint REFERENCES canchas(id),
  fecha      date     NOT NULL,
  habilitada bool     NOT NULL,
  motivo     text,
  UNIQUE (cancha_id, fecha)
);

CREATE TABLE precio_reglas (
  id             serial   PRIMARY KEY,
  tipo_cancha_id integer  NOT NULL REFERENCES tipos_cancha(id),
  hora_desde     time     NOT NULL,
  hora_hasta     time     NOT NULL,
  dias_semana    integer[],
  precio         numeric  NOT NULL,
  vigente_desde  date     NOT NULL DEFAULT CURRENT_DATE,
  activa         bool     NOT NULL DEFAULT true
);

CREATE TABLE precios (
  id            serial   PRIMARY KEY,
  cancha_id     smallint NOT NULL REFERENCES canchas(id),
  precio        integer  NOT NULL,
  vigente_desde date     NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (cancha_id, vigente_desde)
);

CREATE TABLE reservas_recurrentes (
  id          serial   PRIMARY KEY,
  cliente_id  uuid     NOT NULL REFERENCES clientes(id),
  cancha_id   smallint NOT NULL REFERENCES canchas(id),
  turno_id    smallint NOT NULL REFERENCES turnos(id),
  dia_semana  smallint NOT NULL,
  activa      bool     NOT NULL DEFAULT true,
  fecha_desde date     NOT NULL,
  fecha_hasta date,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX reservas_recurrentes_slot_idx
  ON reservas_recurrentes (cancha_id, turno_id, dia_semana)
  WHERE activa = true;

CREATE UNIQUE INDEX reservas_recurrentes_active_unique
  ON reservas_recurrentes (cancha_id, turno_id, dia_semana, fecha_desde)
  WHERE activa = true;

CREATE TABLE eventos (
  id           serial      PRIMARY KEY,
  nombre       text        NOT NULL,
  tipo         text        NOT NULL CHECK (tipo IN ('liga','copa','cumpleanos','otro')),
  fecha_inicio date        NOT NULL,
  fecha_fin    date        NOT NULL,
  estado       text        NOT NULL DEFAULT 'activo'
                           CHECK (estado IN ('activo','cancelado','finalizado')),
  notas        text,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE evento_slots (
  id         serial   PRIMARY KEY,
  evento_id  integer  NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  cancha_id  smallint NOT NULL REFERENCES canchas(id),
  turno_id   smallint NOT NULL REFERENCES turnos(id),
  dia_semana smallint CHECK (dia_semana BETWEEN 0 AND 6)
);

CREATE TABLE reservas (
  id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_legible    text        NOT NULL UNIQUE,
  cliente_id    uuid        NOT NULL REFERENCES clientes(id),
  cancha_id     smallint    NOT NULL REFERENCES canchas(id),
  turno_id      smallint    NOT NULL REFERENCES turnos(id),
  fecha         date        NOT NULL,
  monto_total   integer     NOT NULL,
  monto_abonado integer     NOT NULL DEFAULT 0,
  estado        text        NOT NULL DEFAULT 'pendiente_pago'
                            CHECK (estado IN ('pendiente_pago','confirmada','cancelada')),
  canal         text        NOT NULL DEFAULT 'whatsapp'
                            CHECK (canal IN ('whatsapp','web','manual')),
  recurrente_id integer     REFERENCES reservas_recurrentes(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  evento_id     integer     REFERENCES eventos(id)
);

CREATE INDEX reservas_fecha_estado_idx ON reservas (fecha, estado);
CREATE INDEX reservas_slot_fecha_idx
  ON reservas (fecha, cancha_id, turno_id)
  WHERE estado IN ('pendiente_pago','confirmada');
CREATE UNIQUE INDEX reservas_slot_activa_idx
  ON reservas (cancha_id, turno_id, fecha)
  WHERE estado IN ('pendiente_pago','confirmada');

CREATE TABLE lista_espera (
  id          serial      PRIMARY KEY,
  cliente_id  uuid        NOT NULL,
  cancha_id   smallint,
  tipo_cancha text,
  turno_id    smallint    NOT NULL,
  fecha       date        NOT NULL,
  notificado  bool        NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lista_espera_pendiente_idx
  ON lista_espera (fecha, cancha_id, turno_id)
  WHERE notificado = false;

CREATE TABLE sesiones_bot (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  telefono         text        NOT NULL UNIQUE,
  cliente_id       uuid,
  canal            text        NOT NULL DEFAULT 'whatsapp',
  estado           text        NOT NULL DEFAULT 'IDLE',
  datos_temp       jsonb,
  historial        jsonb       NOT NULL DEFAULT '[]',
  monto_acumulado  integer     NOT NULL DEFAULT 0,
  ultima_actividad timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sesiones_bot_actividad_idx ON sesiones_bot (ultima_actividad);

CREATE TABLE reembolsos (
  id         serial      PRIMARY KEY,
  reserva_id uuid        NOT NULL REFERENCES reservas(id),
  monto      integer     NOT NULL,
  motivo     text        NOT NULL,
  estado     text        NOT NULL DEFAULT 'pendiente',
  admin_id   uuid        REFERENCES admins(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE n8n_chat_histories (
  id         serial      PRIMARY KEY,
  session_id text        NOT NULL,
  message    jsonb       NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX n8n_chat_histories_session_id_idx ON n8n_chat_histories (session_id);

-- Original single-row invoicing config (dropped by foundation migration)
CREATE TABLE config_facturacion (
  id             integer     PRIMARY KEY DEFAULT 1,
  cuit           text,
  razon_social   text,
  domicilio      text,
  condicion_iva  text        DEFAULT 'monotributo',
  punto_venta    integer,
  afipsdk_token  text,
  cert_encrypted text,
  key_encrypted  text,
  modo           text        DEFAULT 'testing',
  activo         boolean     DEFAULT false,
  updated_at     timestamptz DEFAULT now()
);

INSERT INTO config_facturacion (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- comprobantes: original WITHOUT pago_id / origen_tipo
-- (those columns added by 20260731000001_foundation.sql)
CREATE TABLE comprobantes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id      uuid        REFERENCES reservas(id) ON DELETE SET NULL,
  tipo_cbte       integer     NOT NULL DEFAULT 11,
  punto_venta     integer,
  nro_cbte        bigint,
  fecha_cbte      date        NOT NULL,
  cae             text,
  vencimiento_cae date,
  importe         numeric     NOT NULL,
  concepto        integer     DEFAULT 2,
  doc_tipo        integer     DEFAULT 99,
  doc_nro         bigint      DEFAULT 0,
  nombre_receptor text,
  estado          text        DEFAULT 'pendiente',
  cae_manual      boolean     DEFAULT false,
  intentos        integer     DEFAULT 0,
  datos_envio     jsonb,
  datos_respuesta jsonb,
  ultimo_error    text,
  emitida_at      timestamptz,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX comprobantes_reserva_id_idx  ON comprobantes (reserva_id);
CREATE INDEX comprobantes_estado_idx      ON comprobantes (estado);
CREATE INDEX comprobantes_created_at_idx  ON comprobantes (created_at DESC);
CREATE UNIQUE INDEX comprobantes_unique_nro
  ON comprobantes (punto_venta, nro_cbte, tipo_cbte)
  WHERE nro_cbte IS NOT NULL;

-- ── Functions ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_cancha_disponible(p_cancha_id smallint, p_fecha date)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_override    BOOLEAN;
  v_dia         SMALLINT;
  v_semanal     BOOLEAN;
  v_espacio_id  SMALLINT;
  v_tipo        TEXT;
  v_f5_activa   BOOLEAN;
BEGIN
  SELECT habilitada INTO v_override
  FROM disponibilidad_overrides
  WHERE fecha = p_fecha
    AND (cancha_id = p_cancha_id OR cancha_id IS NULL)
  ORDER BY cancha_id NULLS LAST
  LIMIT 1;

  IF v_override IS NOT NULL THEN
    RETURN v_override;
  END IF;

  v_dia := EXTRACT(DOW FROM p_fecha)::SMALLINT;

  SELECT habilitada INTO v_semanal
  FROM disponibilidad_cancha
  WHERE cancha_id = p_cancha_id AND dia_semana = v_dia;

  IF v_semanal IS NULL OR NOT v_semanal THEN
    RETURN false;
  END IF;

  SELECT espacio_id, tipo INTO v_espacio_id, v_tipo
  FROM canchas WHERE id = p_cancha_id;

  IF v_tipo = 'f8' THEN
    SELECT EXISTS (
      SELECT 1
      FROM canchas c
      JOIN disponibilidad_cancha dc ON dc.cancha_id = c.id
      WHERE c.espacio_id = v_espacio_id
        AND c.tipo = 'f5'
        AND c.activa = true
        AND dc.dia_semana = v_dia
        AND dc.habilitada = true
    ) INTO v_f5_activa;

    IF v_f5_activa THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_precio(p_cancha_id smallint)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT precio FROM precios
  WHERE cancha_id = p_cancha_id
    AND vigente_desde <= CURRENT_DATE
  ORDER BY vigente_desde DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fn_get_datos_bancarios()
RETURNS TABLE(alias text, cbu text, nombre_cuenta text)
LANGUAGE sql
STABLE
AS $$
  SELECT alias, cbu, nombre_cuenta FROM datos_bancarios
  WHERE activo = true
  ORDER BY vigente_desde DESC
  LIMIT 1;
$$;

-- ── View ──────────────────────────────────────────────────────
-- No RLS — accessed server-side via service role key only.
-- ensure_rls event trigger does NOT fire on CREATE VIEW.

CREATE OR REPLACE VIEW v_slots_disponibles AS
SELECT
  c.id          AS cancha_id,
  c.nombre      AS cancha_nombre,
  c.tipo        AS cancha_tipo,
  t.id          AS turno_id,
  t.hora_inicio,
  t.hora_fin,
  d.fecha,
  fn_get_precio(c.id) AS precio
FROM canchas c
CROSS JOIN turnos t
CROSS JOIN (
  SELECT generate_series(
    CURRENT_DATE::timestamp,
    (CURRENT_DATE + '14 days'::interval),
    '1 day'::interval
  )::date AS fecha
) d
WHERE c.activa = true
  AND fn_cancha_disponible(c.id, d.fecha)
  AND NOT EXISTS (
    SELECT 1 FROM reservas r
    WHERE r.cancha_id = c.id
      AND r.turno_id = t.id
      AND r.fecha = d.fecha
      AND r.estado IN ('pendiente_pago','confirmada')
  )
  AND NOT EXISTS (
    SELECT 1 FROM reservas_recurrentes rr
    WHERE rr.cancha_id = c.id
      AND rr.turno_id = t.id
      AND rr.dia_semana = EXTRACT(DOW FROM d.fecha)::smallint
      AND rr.activa = true
      AND rr.fecha_desde <= d.fecha
      AND (rr.fecha_hasta IS NULL OR rr.fecha_hasta >= d.fecha)
      AND NOT EXISTS (
        SELECT 1 FROM reservas r
        WHERE r.recurrente_id = rr.id
          AND r.fecha = d.fecha
          AND r.estado = 'cancelada'
      )
  )
  AND NOT EXISTS (
    SELECT 1
    FROM evento_slots es
    JOIN eventos ev ON ev.id = es.evento_id
    WHERE es.cancha_id = c.id
      AND es.turno_id = t.id
      AND ev.estado = 'activo'
      AND ev.fecha_inicio <= d.fecha
      AND ev.fecha_fin >= d.fecha
      AND (es.dia_semana IS NULL OR es.dia_semana = EXTRACT(DOW FROM d.fecha)::smallint)
  );

-- ── Table & view grants ────────────────────────────────────────
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

GRANT SELECT ON v_slots_disponibles TO anon;
GRANT SELECT ON v_slots_disponibles TO authenticated;

-- ── Triggers ──────────────────────────────────────────────────

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_reservas_updated_at
  BEFORE UPDATE ON reservas
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

CREATE TRIGGER trg_reembolsos_updated_at
  BEFORE UPDATE ON reembolsos
  FOR EACH ROW EXECUTE FUNCTION fn_update_updated_at();

-- ── pg_cron jobs ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job 1: auto-cancel reservas pendiente_pago older than 1 hour
SELECT cron.schedule(
  'auto-cancel-reservas',
  '*/10 * * * *',
  $$
    UPDATE reservas
    SET estado = 'cancelada', updated_at = NOW()
    WHERE estado = 'pendiente_pago'
      AND created_at < NOW() - INTERVAL '1 hour';
  $$
);

-- Job 2: generate reservas from active reservas_recurrentes (next 14 days)
-- Runs every Monday at 06:00
SELECT cron.schedule(
  'generar-reservas-recurrentes',
  '0 6 * * 1',
  $$
    INSERT INTO reservas (
      id_legible, cliente_id, cancha_id, turno_id, fecha,
      monto_total, monto_abonado, estado, canal, recurrente_id
    )
    SELECT
      'FIJO-' || rr.id || '-' || to_char(d.fecha, 'YYYYMMDD'),
      rr.cliente_id,
      rr.cancha_id,
      rr.turno_id,
      d.fecha,
      COALESCE(fn_get_precio(rr.cancha_id), 0),
      0,
      'confirmada',
      'manual',
      rr.id
    FROM reservas_recurrentes rr
    CROSS JOIN (
      SELECT generate_series(
        CURRENT_DATE,
        CURRENT_DATE + 14,
        '1 day'::interval
      )::date AS fecha
    ) d
    WHERE rr.activa = true
      AND rr.fecha_desde <= d.fecha
      AND (rr.fecha_hasta IS NULL OR rr.fecha_hasta >= d.fecha)
      AND EXTRACT(DOW FROM d.fecha)::SMALLINT = rr.dia_semana
      AND fn_cancha_disponible(rr.cancha_id, d.fecha)
    ON CONFLICT (id_legible) DO NOTHING;
  $$
);
