-- Add activo_bot flag to cuentas_bancarias.
-- Only one row can have activo_bot = true at a time (enforced in application layer).
alter table cuentas_bancarias
  add column if not exists activo_bot boolean not null default false;

-- Ensure at most one row is active for bot at any time (partial unique index)
create unique index if not exists cuentas_bancarias_single_bot_active
  on cuentas_bancarias (activo_bot)
  where activo_bot = true;
