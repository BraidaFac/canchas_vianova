import { getModulos } from "@/lib/get-modulos";
import ModuloNoContratado from "@/components/admin/ModuloNoContratado";

export default async function FacturacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const modulos = await getModulos();
  if (!modulos.facturacion) return <ModuloNoContratado modulo="Facturación Electrónica" />;
  return <>{children}</>;
}
