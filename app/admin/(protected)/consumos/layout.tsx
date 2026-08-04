import { getModulos } from "@/lib/get-modulos";
import ModuloNoContratado from "@/components/admin/ModuloNoContratado";

export default async function ConsumosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const modulos = await getModulos();
  if (!modulos.pos) return <ModuloNoContratado modulo="Consumos / Punto de Venta" />;
  return <>{children}</>;
}
