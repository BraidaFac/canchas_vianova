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

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onAbrirNueva: () => void;
  motivo?: string;
};

export default function ReabrirCajaDialog({ open, onClose, onSuccess, onAbrirNueva, motivo }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleReabrir() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/caja/reabrir", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Error al reabrir caja");
        return;
      }
      toast.success("Caja reabierta correctamente");
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
          <DialogTitle>La caja está cerrada</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {motivo && (
            <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">
              {motivo}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            La caja de esta jornada ya fue cerrada. Podés reabrirla para seguir registrando pagos, o iniciar una nueva jornada.
          </p>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="outline" size="sm" onClick={onAbrirNueva} disabled={loading}>
            Nueva jornada
          </Button>
          <Button size="sm" onClick={handleReabrir} disabled={loading}>
            {loading ? "Reabriendo..." : "Reabrir caja"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
