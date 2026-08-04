import { getSession } from "@/lib/auth.server";
import { redirect } from "next/navigation";
import ConsumosClient from "@/components/admin/ConsumosClient";

export default async function ConsumosPage() {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return <ConsumosClient />;
}
