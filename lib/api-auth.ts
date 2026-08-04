import { getSession } from "@/lib/auth.server";
import { hasMinRole, type Role } from "@/lib/auth";

export async function requireRole(min: Role) {
  const session = await getSession();
  if (!session) return { error: "No autenticado", status: 401 as const };
  if (!hasMinRole(session, min)) return { error: `Requiere rol ${min}`, status: 403 as const };
  return session;
}

export const requireAdmin = () => requireRole("admin");
export const requireSuperAdmin = () => requireRole("superadmin");
export const requireRoot = () => requireRole("root");
