import { cookies } from "next/headers";
import { COOKIE_NAME, verifySession } from "@/lib/auth";
import type { AdminSession } from "@/lib/auth";

export async function getSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
