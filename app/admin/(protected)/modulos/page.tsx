import { getSession } from "@/lib/auth.server";
import { redirect } from "next/navigation";
import { hasMinRole } from "@/lib/auth";
import ModulosClient from "@/components/admin/ModulosClient";

export default async function ModulosPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  if (!hasMinRole(session, "root")) redirect("/admin");

  return <ModulosClient />;
}
