import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AdminLayoutClient from "@/components/admin/AdminLayoutClient";
import { Toaster } from "sonner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  manifest: "/admin/manifest.webmanifest",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  const supabase = await createSupabaseServerClient();
  const { data: modulos } = await supabase
    .from("config_modulos")
    .select("facturacion, pos, stock")
    .eq("id", 1)
    .single();

  return (
    <>
      <AdminLayoutClient
        session={session}
        facturacionActiva={modulos?.facturacion ?? false}
        posActivo={modulos?.pos ?? false}
        stockActivo={modulos?.stock ?? false}
      >
        {children}
      </AdminLayoutClient>
      <Toaster richColors position="top-right" />
    </>
  );
}
