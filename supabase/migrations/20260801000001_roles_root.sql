-- ============================================================
-- Migration: Add root role
-- Spec: docs/superpowers/specs/2026-07-31-roles-design.md
-- ============================================================

-- 1. Update rol CHECK constraint on admins to include 'root'
ALTER TABLE admins
  DROP CONSTRAINT IF EXISTS admins_rol_check;

ALTER TABLE admins
  ADD CONSTRAINT admins_rol_check
    CHECK (rol IN ('admin', 'superadmin', 'root'));

-- 2. Partial unique index — only one root allowed in the entire system
CREATE UNIQUE INDEX unique_root_admin ON admins (rol) WHERE rol = 'root';

  GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;                                                                                   
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role; 
