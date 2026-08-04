"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Layers, Receipt, ShoppingCart, Package } from "lucide-react";
import { TabLoader } from "@/components/ui/tab-loader";

type Modulos = {
  facturacion: boolean;
  pos: boolean;
  stock: boolean;
};

const MODULOS: { key: keyof Modulos; label: string; description: string; icon: React.ElementType }[] = [
  {
    key: "facturacion",
    label: "Facturación Electrónica",
    description: "Emisión de comprobantes AFIP (facturas, notas de crédito).",
    icon: Receipt,
  },
  {
    key: "pos",
    label: "Punto de Venta (POS)",
    description: "Cobros en mostrador, caja y cierre de caja.",
    icon: ShoppingCart,
  },
  {
    key: "stock",
    label: "Stock",
    description: "Gestión de productos, categorías y compras.",
    icon: Package,
  },
];

export default function ModulosClient() {
  const router = useRouter();
  const [modulos, setModulos] = useState<Modulos | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<keyof Modulos | null>(null);

  useEffect(() => {
    fetch("/api/admin/config/modulos")
      .then((r) => r.json())
      .then((d) => setModulos(d))
      .catch(() => toast.error("Error al cargar módulos"))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: keyof Modulos) {
    if (!modulos) return;
    const next = !modulos[key];
    setSaving(key);
    const res = await fetch("/api/admin/config/modulos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    });
    if (res.ok) {
      setModulos((prev) => prev ? { ...prev, [key]: next } : prev);
      toast.success(`Módulo ${next ? "activado" : "desactivado"}`);
      router.refresh();
    } else {
      toast.error("Error al guardar");
    }
    setSaving(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-[#133D34]" />
          <h1 className="text-sm font-semibold">Módulos</h1>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
        {loading ? (
          <TabLoader />
        ) : (
          <div className="max-w-xl space-y-4">
            <p className="text-sm text-muted-foreground">
              Activá o desactivá módulos del sistema. Los cambios son inmediatos.
            </p>
            <div className="space-y-2">
              {MODULOS.map(({ key, label, description, icon: Icon }) => {
                const active = modulos?.[key] ?? false;
                const isSaving = saving === key;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border bg-card p-3 gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => toggle(key)}
                      disabled={isSaving}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                        active ? "bg-[#133D34]" : "bg-input"
                      }`}
                      aria-label={`Toggle ${label}`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                          active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
