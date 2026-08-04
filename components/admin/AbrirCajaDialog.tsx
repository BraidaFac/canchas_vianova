"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  motivo?: string;
};

export default function AbrirCajaDialog({ open, onClose, onSuccess, motivo }: Props) {
  const [monto, setMonto] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const montoNum = parseFloat(monto.replace(",", "."));
    if (isNaN(montoNum) || montoNum < 0) {
      toast.error("Ingresá un monto inicial válido (puede ser 0)");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/caja/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto_apertura: montoNum }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Error al abrir caja");
        return;
      }
      toast.success("Caja abierta correctamente");
      window.dispatchEvent(new CustomEvent("caja-estado-changed"));
      onSuccess();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Abrir caja</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {motivo && (
            <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">
              {motivo}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="monto_apertura">Efectivo inicial en caja</Label>
            <div className="flex items-center border border-input rounded-md bg-background focus-within:ring-1 focus-within:ring-ring">
              <span className="pl-3 pr-1 text-sm text-muted-foreground select-none">$</span>
              <Input
                id="monto_apertura"
                type="number"
                min="0"
                step="0.01"
                placeholder="0"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 pl-0"
                autoFocus
              />
            </div>
            <p className="text-xs text-muted-foreground">Ingresá el fondo de caja inicial en efectivo.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button size="sm" onClick={handleSubmit} disabled={loading}>
            {loading ? "Abriendo..." : "Abrir caja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
