import { getModulos } from "@/lib/get-modulos";
import ModuloNoContratado from "@/components/admin/ModuloNoContratado";

export default async function CajaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const modulos = await getModulos();
  if (!modulos.pos) return <ModuloNoContratado modulo="Caja / Punto de Venta" />;
  return <>{children}</>;
}
