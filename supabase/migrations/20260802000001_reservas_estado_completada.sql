-- ── Migración: agregar estado "completada" a reservas ─────────────────────────
-- Elimina "pendiente_pago" del constraint y agrega "completada".
-- Las reservas pendiente_pago existentes pasan a "confirmada".

-- Migrar datos primero
UPDATE reservas SET estado = 'confirmada' WHERE estado = 'pendiente_pago';

-- Reemplazar constraint
ALTER TABLE reservas DROP CONSTRAINT reservas_estado_check;
ALTER TABLE reservas
  ADD CONSTRAINT reservas_estado_check
  CHECK (estado IN ('confirmada', 'completada', 'cancelada'));

-- Actualizar DEFAULT (ya era confirmada implícitamente, pero lo dejamos explícito)
ALTER TABLE reservas ALTER COLUMN estado SET DEFAULT 'confirmada';
