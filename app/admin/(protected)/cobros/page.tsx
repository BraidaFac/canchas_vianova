import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import CobrosClient from "@/components/admin/CobrosClient";

export default async function CobrosPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return <CobrosClient />;
}
