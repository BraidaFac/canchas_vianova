-- supabase/migrations/20260802000000_caja_operativa.sql

-- ── 1. JornadaOperativa ──────────────────────────────────────────────────────
CREATE TABLE jornadas_operativas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha_jornada         date NOT NULL,
  estado                text NOT NULL DEFAULT 'abierta'
                          CHECK (estado IN ('abierta', 'cerrada')),
  abierta_at            timestamptz NOT NULL DEFAULT now(),
  cerrada_at            timestamptz,
  admin_apertura_id     uuid REFERENCES admins(id) ON DELETE SET NULL,
  admin_cierre_id       uuid REFERENCES admins(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Solo una jornada abierta a la vez (partial unique index)
CREATE UNIQUE INDEX jornadas_una_abierta
  ON jornadas_operativas (estado)
  WHERE estado = 'abierta';

-- ── 2. SesionCaja ───────────────────────────────────────────────────────────
CREATE TABLE sesiones_caja (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id              uuid NOT NULL REFERENCES jornadas_operativas(id) ON DELETE CASCADE,
  estado                  text NOT NULL DEFAULT 'abierta'
                            CHECK (estado IN ('abierta', 'cerrada')),
  monto_apertura          numeric(12,2) NOT NULL DEFAULT 0,
  monto_cierre_declarado  numeric(12,2),
  abierta_at              timestamptz NOT NULL DEFAULT now(),
  cerrada_at              timestamptz,
  admin_id                uuid REFERENCES admins(id) ON DELETE SET NULL,
  resumen_json            jsonb,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- Solo una sesión abierta a la vez
CREATE UNIQUE INDEX sesiones_una_abierta
  ON sesiones_caja (estado)
  WHERE estado = 'abierta';

-- ── 3. Columna sesion_caja_id en pagos ──────────────────────────────────────
ALTER TABLE pagos
  ADD COLUMN sesion_caja_id uuid REFERENCES sesiones_caja(id) ON DELETE SET NULL;

-- ── 4. Columna caja_cutoff_hour en config_modulos ───────────────────────────
ALTER TABLE config_modulos
  ADD COLUMN caja_cutoff_hour int NOT NULL DEFAULT 7
    CHECK (caja_cutoff_hour >= 0 AND caja_cutoff_hour <= 23);

-- ── 5. Permisos ──────────────────────────────────────────────────────────────
GRANT ALL ON jornadas_operativas TO service_role;
GRANT ALL ON sesiones_caja TO service_role;
