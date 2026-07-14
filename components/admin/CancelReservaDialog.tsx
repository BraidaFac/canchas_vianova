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
import { AlertTriangle, MessageCircle } from "lucide-react";

type ReservaInfo = {
  id: string;
  id_legible: string;
  fecha: string;
  monto_abonado: number;
  recurrente_id: number | null;
  clientes: { nombre: string; telefono: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reserva: ReservaInfo;
};

function buildWspLink(
  telefono: string,
  nombre: string,
  id_legible: string,
  fecha: string,
  monto: number,
) {
  const phone = telefono.replace(/\D/g, "");
  const fechaFmt = fecha.split("-").reverse().join("/");
  const msg =
    `Hola ${nombre}, te contactamos del predio. ` +
    `Tu reserva ${id_legible} del ${fechaFmt} fue cancelada. ` +
    `Tenés un monto abonado de $${monto.toLocaleString("es-AR")}. ` +
    `¿Podés enviarnos los datos de tu cuenta (CBU/alias) para hacerte la devolución? ¡Gracias!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export default function CancelReservaDialog({
  open,
  onClose,
  onSuccess,
  reserva,
}: Props) {
  const esFijo = reserva.recurrente_id != null;
  const tieneAbonado = reserva.monto_abonado > 0;
  const [scope, setScope] = useState<"solo" | "baja">("solo");
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const body: Record<string, unknown> = { estado: "cancelada" };
      if (esFijo && scope === "baja") {
        body.cancelar_recurrente = true;
      }
      const res = await fetch(`/api/admin/reservas/${reserva.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Error al cancelar");
        return;
      }
      toast.success(
        scope === "baja"
          ? "Reserva cancelada y turno fijo dado de baja"
          : "Reserva cancelada",
      );
      onSuccess();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[26rem] sm:max-w-[26rem]">
        <DialogHeader>
          <DialogTitle className="text-base">Cancelar reserva</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            <span className="font-mono font-medium text-foreground">
              {reserva.id_legible}
            </span>
            {" — "}
            {reserva.clientes?.nombre ?? "Sin cliente"}
            {" — "}
            {reserva.fecha.split("-").reverse().join("/")}
          </p>

          {esFijo && (
            <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 p-3 space-y-2">
              <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wide">
                Turno fijo
              </p>
              <div className="space-y-2">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cancel-scope"
                    value="solo"
                    checked={scope === "solo"}
                    onChange={() => setScope("solo")}
                    className="mt-0.5 accent-orange-500"
                  />
                  <div>
                    <div className="font-medium text-foreground">
                      Solo este turno
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Cancela únicamente la reserva de esta fecha. El turno fijo
                      sigue activo las semanas siguientes.
                    </div>
                  </div>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cancel-scope"
                    value="baja"
                    checked={scope === "baja"}
                    onChange={() => setScope("baja")}
                    className="mt-0.5 accent-orange-500"
                  />
                  <div>
                    <div className="font-medium text-foreground">
                      Dar de baja el turno fijo
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Cancela esta reserva y desactiva la suscripción semanal
                      completa.
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}

          {tieneAbonado && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle size={14} />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Monto a reintegrar
                </span>
              </div>
              <p className="text-foreground">
                <span className="font-bold text-base">
                  ${reserva.monto_abonado.toLocaleString("es-AR")}
                </span>
                {" abonado por "}
                <span className="font-medium">
                  {reserva.clientes?.nombre ?? "el cliente"}
                </span>
              </p>
              {reserva.clientes?.telefono && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">
                    Tel:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {reserva.clientes.telefono}
                    </span>
                  </p>
                  <a
                    href={buildWspLink(
                      reserva.clientes.telefono,
                      reserva.clientes.nombre,
                      reserva.id_legible,
                      reserva.fecha,
                      reserva.monto_abonado,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#25D366] hover:bg-[#1ebe5d] text-white text-xs font-medium transition-colors"
                  >
                    <MessageCircle size={13} />
                    Pedir datos para devolución por WhatsApp
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
          >
            Volver
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Cancelando..." : "Confirmar cancelación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
