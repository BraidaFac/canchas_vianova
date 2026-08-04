"use client";

import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JornadaOperativa, SesionCaja, ResumenCaja } from "@/lib/caja/types";

type Comprobante = {
  id: string;
  estado: string;
  cae: string | null;
  importe: number;
  emitida_at: string | null;
  tipo_cbte: number;
  nro_cbte: number | null;
};

type Props = {
  open: boolean;
  jornadaId: string;
  onClose: () => void;
};

const ESTADO_CBTE: Record<string, { label: string; className: string }> = {
  emitida:   { label: "Emitida",   className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  fallida:   { label: "Fallida",   className: "bg-red-100 text-red-700 border-red-200" },
  pendiente: { label: "Pendiente", className: "bg-amber-100 text-amber-700 border-amber-200" },
};

export default function CajaDetalleModal({ open, jornadaId, onClose }: Props) {
  const [jornada, setJornada] = useState<JornadaOperativa | null>(null);
  const [sesion, setSesion] = useState<SesionCaja | null>(null);
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !jornadaId) return;
    setLoading(true);
    fetch(`/api/admin/caja/${jornadaId}`)
      .then((r) => r.json())
      .then((data) => {
        setJornada(data.jornada);
        setSesion(data.sesion);
        setComprobantes(data.comprobantes ?? []);
      })
      .finally(() => setLoading(false));
  }, [open, jornadaId]);

  const resumen = sesion?.resumen_json as ResumenCaja | null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Jornada {jornada ? format(parseISO(jornada.fecha_jornada + "T12:00:00"), "dd/MM/yyyy") : "—"}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Cargando...</div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Horarios */}
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Apertura</p>
                <p className="font-medium">
                  {sesion ? format(parseISO(sesion.abierta_at), "HH:mm", { locale: es }) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cierre</p>
                <p className="font-medium">
                  {sesion?.cerrada_at
                    ? format(parseISO(sesion.cerrada_at), "HH:mm", { locale: es })
                    : "—"}
                </p>
              </div>
            </div>

            {/* Resumen financiero */}
            {resumen && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resumen</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <span className="text-muted-foreground">Efectivo</span>
                  <span className="text-right font-medium">${resumen.total_efectivo.toLocaleString("es-AR")}</span>
                  <span className="text-muted-foreground">Transferencia</span>
                  <span className="text-right font-medium">${resumen.total_transferencia.toLocaleString("es-AR")}</span>
                  <span className="text-muted-foreground">Otro</span>
                  <span className="text-right font-medium">${resumen.total_otro.toLocaleString("es-AR")}</span>
                  <span className="text-muted-foreground">Reservas</span>
                  <span className="text-right font-medium">${resumen.total_reservas.toLocaleString("es-AR")}</span>
                  <span className="text-muted-foreground">Consumos</span>
                  <span className="text-right font-medium">${resumen.total_consumos.toLocaleString("es-AR")}</span>
                </div>
                <div className={`flex justify-between text-sm font-semibold border-t border-border pt-2 ${resumen.diferencia_efectivo < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  <span>Diferencia efectivo</span>
                  <span>{resumen.diferencia_efectivo >= 0 ? "+" : ""}${resumen.diferencia_efectivo.toLocaleString("es-AR")}</span>
                </div>
              </div>
            )}

            {/* Comprobantes */}
            {comprobantes.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Comprobantes emitidos ({comprobantes.length})
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  {comprobantes.map((c) => {
                    const cfg = ESTADO_CBTE[c.estado] ?? { label: c.estado, className: "bg-slate-100 text-slate-500 border-slate-200" };
                    return (
                      <div key={c.id} className="flex items-center px-3 py-2 border-b border-border last:border-0 gap-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.className}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono flex-1">
                          {c.nro_cbte ? `#${c.nro_cbte}` : "—"}
                        </span>
                        <span className="text-sm font-medium">${Number(c.importe).toLocaleString("es-AR")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
