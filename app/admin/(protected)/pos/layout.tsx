import { getModulos } from "@/lib/get-modulos";
import ModuloNoContratado from "@/components/admin/ModuloNoContratado";

export default async function PosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const modulos = await getModulos();
  if (!modulos.pos) return <ModuloNoContratado modulo="Punto de Venta (POS)" />;
  return <>{children}</>;
}
