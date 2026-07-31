-- ============================================================
-- Migration: Plan 1 Foundation
-- 2026-07-31
-- ============================================================

-- 1. entidades_fiscales (replaces config_facturacion single-row)
CREATE TABLE entidades_fiscales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_interno  text NOT NULL DEFAULT 'Principal',
  cuit            text,
  razon_social    text,
  domicilio       text,
  condicion_iva   text CHECK (condicion_iva IN ('monotributo','responsable_inscripto')),
  punto_venta     int,
  afipsdk_token   text,
  cert_encrypted  text,
  key_encrypted   text,
  modo            text NOT NULL DEFAULT 'testing' CHECK (modo IN ('testing','produccion')),
  activo          bool NOT NULL DEFAULT true,
  predeterminada  bool NOT NULL DEFAULT false,
  updated_at      timestamptz DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

-- Migrate existing row from config_facturacion
INSERT INTO entidades_fiscales (
  nombre_interno, cuit, razon_social, domicilio,
  condicion_iva, punto_venta, afipsdk_token,
  cert_encrypted, key_encrypted, modo, activo, predeterminada, updated_at
)
SELECT
  'Principal', cuit, razon_social, domicilio,
  condicion_iva, punto_venta, afipsdk_token,
  cert_encrypted, key_encrypted, modo, activo, true, updated_at
FROM config_facturacion
WHERE id = 1;

DROP TABLE config_facturacion;

-- 2. cuentas_bancarias
CREATE TABLE cuentas_bancarias (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_display     text NOT NULL,
  banco              text,
  cbu                text,
  alias              text,
  entidad_fiscal_id  uuid NOT NULL REFERENCES entidades_fiscales(id) ON DELETE CASCADE,
  activo             bool NOT NULL DEFAULT true,
  created_at         timestamptz DEFAULT now()
);

-- 3. pagos (polymorphic)
CREATE TABLE pagos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen_tipo         text NOT NULL CHECK (origen_tipo IN ('reserva','consumo')),
  origen_id           uuid NOT NULL,
  medio_pago          text NOT NULL CHECK (medio_pago IN ('efectivo','transferencia','otro')),
  monto               numeric NOT NULL CHECK (monto > 0),
  cuenta_bancaria_id  uuid REFERENCES cuentas_bancarias(id),
  empleado_id         uuid REFERENCES empleados(id),
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_pagos_origen ON pagos(origen_tipo, origen_id);

-- 4. Alter comprobantes — add pago_id + origen_tipo
--    reserva_id kept for backwards compat during migration; drop later
ALTER TABLE comprobantes
  ADD COLUMN pago_id     uuid REFERENCES pagos(id),
  ADD COLUMN origen_tipo text CHECK (origen_tipo IN ('reserva','consumo'));

-- 5. config_modulos (single-row feature flags)
CREATE TABLE config_modulos (
  id           int PRIMARY KEY DEFAULT 1,
  facturacion  bool NOT NULL DEFAULT false,
  pos          bool NOT NULL DEFAULT false,
  stock        bool NOT NULL DEFAULT false,
  CHECK (id = 1)
);

INSERT INTO config_modulos DEFAULT VALUES;

-- Copy current facturacion activo state from migrated entidad
UPDATE config_modulos
SET facturacion = (
  SELECT activo FROM entidades_fiscales WHERE predeterminada = true LIMIT 1
);

-- 6. iva_alicuotas
CREATE TABLE iva_alicuotas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL,
  porcentaje     numeric NOT NULL,
  predeterminada bool NOT NULL DEFAULT false,
  activo         bool NOT NULL DEFAULT true
);

INSERT INTO iva_alicuotas (nombre, porcentaje, predeterminada) VALUES
  ('21%',   21.00, true),
  ('10.5%', 10.50, false),
  ('Exento', 0.00, false);
