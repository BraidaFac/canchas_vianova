import { SignJWT, jwtVerify } from "jose";

export const SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET ?? "fallback-dev-secret-change-in-prod"
);

export const COOKIE_NAME = "admin_session";

export type Role = "admin" | "superadmin" | "root";

export const ROLE_LEVEL: Record<Role, number> = {
  admin: 0,
  superadmin: 1,
  root: 2,
};

export function hasMinRole(session: AdminSession, min: Role): boolean {
  return ROLE_LEVEL[session.rol] >= ROLE_LEVEL[min];
}

export type AdminSession = {
  id: string;
  nombre: string;
  rol: Role;
  telefono: string;
};

export async function signSession(payload: AdminSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("12h")
    .setIssuedAt()
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<AdminSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as AdminSession;
  } catch {
    return null;
  }
}

export function getSessionCookieConfig(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 12, // 12h
  };
}
