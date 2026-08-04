import { getModulos } from "@/lib/get-modulos";
import ModuloNoContratado from "@/components/admin/ModuloNoContratado";

export default async function StockLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const modulos = await getModulos();
  if (!modulos.stock) return <ModuloNoContratado modulo="Stock" />;
  return <>{children}</>;
}
