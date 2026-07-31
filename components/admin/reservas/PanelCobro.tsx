"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import type { CuentaBancaria, MedioPago } from "@/lib/facturacion/types";

type PagoRow = {
  medio_pago: MedioPago;
  monto: string;
  cuenta_bancaria_id: string;
  nombre_receptor: string;
};

type Props = {
  reservaId: string;
  total: number;
  cuentasBancarias: CuentaBancaria[];
  onSuccess: () => void;
};

const MEDIO_LABELS: Record<MedioPago, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  otro: "Otro",
};

function emptyRow(): PagoRow {
  return { medio_pago: "efectivo", monto: "", cuenta_bancaria_id: "", nombre_receptor: "" };
}

export function PanelCobro({ reservaId, total, cuentasBancarias, onSuccess }: Props) {
  const [pagos, setPagos] = useState<PagoRow[]>([emptyRow()]);
  const [loading, setLoading] = useState(false);

  const registrado = pagos.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
  const completo = registrado >= total;

  function updateRow(idx: number, patch: Partial<PagoRow>) {
    setPagos((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setPagos((prev) => [...prev, emptyRow()]);
  }

  function removeRow(idx: number) {
    setPagos((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleConfirmar() {
    // Validate
    for (const [i, p] of pagos.entries()) {
      if (!p.monto || parseFloat(p.monto) <= 0) {
        toast.error(`Fila ${i + 1}: el monto debe ser mayor a 0`);
        return;
      }
      if (p.medio_pago === "transferencia" && !p.cuenta_bancaria_id) {
        toast.error(`Fila ${i + 1}: seleccioná una cuenta bancaria para transferencia`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origen_tipo: "reserva",
          origen_id: reservaId,
          pagos: pagos.map((p) => ({
            medio_pago: p.medio_pago,
            monto: parseFloat(p.monto),
            cuenta_bancaria_id: p.cuenta_bancaria_id || null,
            nombre_receptor: p.nombre_receptor.trim() || undefined,
          })),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Error al registrar cobro");
        return;
      }

      const nComprobantes = (json.comprobantes as unknown[]).length;
      const nErrores = (json.errores_emision as unknown[] | undefined)?.length ?? 0;

      if (nComprobantes > 0 && nErrores === 0) {
        toast.success(`Cobro registrado. ${nComprobantes} factura(s) emitida(s).`);
      } else if (nComprobantes > 0 && nErrores > 0) {
        toast.success(`Cobro registrado. ${nErrores} factura(s) fallaron — revisar en Facturación.`);
      } else {
        toast.success("Cobro registrado.");
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Registrar cobro</p>

      <div className="space-y-2">
        {pagos.map((pago, idx) => (
          <div key={idx} className="flex flex-wrap items-start gap-2">
            {/* Medio de pago */}
            <Select
              value={pago.medio_pago}
              onValueChange={(v) => updateRow(idx, { medio_pago: v as MedioPago, cuenta_bancaria_id: "" })}
            >
              <SelectTrigger className="h-8 w-36 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["efectivo", "transferencia", "otro"] as MedioPago[]).map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {MEDIO_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Monto */}
            <Input
              type="number"
              min={0}
              step="any"
              placeholder="Monto"
              value={pago.monto}
              onChange={(e) => updateRow(idx, { monto: e.target.value })}
              className="h-8 w-28 text-xs"
            />

            {/* Cuenta bancaria — only for transferencia */}
            {pago.medio_pago === "transferencia" && (
              <Select
                value={pago.cuenta_bancaria_id}
                onValueChange={(v) => updateRow(idx, { cuenta_bancaria_id: v })}
              >
                <SelectTrigger className="h-8 w-48 text-xs">
                  <SelectValue placeholder="Cuenta bancaria" />
                </SelectTrigger>
                <SelectContent>
                  {cuentasBancarias
                    .filter((c) => c.activo)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">
                        {c.nombre_display}
                        {c.alias ? ` (${c.alias})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            )}

            {/* Nombre receptor (optional, for factura) */}
            {pago.medio_pago === "transferencia" && (
              <Input
                placeholder="Nombre receptor (opcional)"
                value={pago.nombre_receptor}
                onChange={(e) => updateRow(idx, { nombre_receptor: e.target.value })}
                className="h-8 w-44 text-xs"
              />
            )}

            {/* Remove row */}
            {pagos.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(idx)}
              >
                <X size={13} />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Add row */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 text-xs text-muted-foreground"
        onClick={addRow}
      >
        <Plus size={12} />
        Agregar forma de pago
      </Button>

      {/* Running total */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          Registrado:{" "}
          <span className={completo ? "text-green-600 font-medium" : "font-medium"}>
            ${registrado.toLocaleString("es-AR")}
          </span>
        </span>
        <span className="text-muted-foreground">
          Total: <span className="font-medium">${total.toLocaleString("es-AR")}</span>
        </span>
        {registrado > total && (
          <span className="text-amber-600 text-xs">
            Excede en ${(registrado - total).toLocaleString("es-AR")}
          </span>
        )}
      </div>

      {/* Confirm */}
      <Button
        size="sm"
        disabled={!completo || loading}
        onClick={handleConfirmar}
        className="w-full sm:w-auto"
      >
        {loading ? "Registrando..." : "Confirmar cobro"}
      </Button>
    </div>
  );
}
