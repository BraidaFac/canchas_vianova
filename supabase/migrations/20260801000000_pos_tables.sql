-- ============================================================
-- Migration: POS module tables
-- Moved from scripts/migration_pos_tables.sql
-- ============================================================

CREATE TABLE consumos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id uuid        REFERENCES reservas(id),
  empleado_id uuid       REFERENCES admins(id),
  total      numeric     NOT NULL,
  notas      text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE consumo_items (
  id              uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  consumo_id      uuid     NOT NULL REFERENCES consumos(id) ON DELETE CASCADE,
  producto_id     uuid     NOT NULL REFERENCES productos(id),
  cantidad        integer  NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric  NOT NULL
);
