"use client";

import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";

type PagoPendiente = {
  id: string;
  monto: number;
  origen_tipo: string;
  origen_id: string;
  created_at: string;
  cuenta_bancaria: { id: string; nombre_display: string } | null;
};

type ResumenPrevio = {
  monto_apertura: number;
  total_efectivo: number;
  total_transferencia: number;
  total_otro: number;
  total_reservas: number;
  total_consumos: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  sesionId: string;
  montoApertura: number;
};

export default function CerrarCajaDialog({ open, onClose, onSuccess, sesionId, montoApertura }: Props) {
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [montoCierre, setMontoCierre] = useState("");
  const [resumen, setResumen] = useState<ResumenPrevio | null>(null);
  const [pendientesDelDia, setPendientesDelDia] = useState<PagoPendiente[]>([]);
  const [pendientesOtros, setPendientesOtros] = useState<PagoPendiente[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!open) return;
    setPaso(1);
    setMontoCierre("");
    setLoadingData(true);

    Promise.all([
      fetch(`/api/admin/caja/pendientes-facturacion`).then((r) => r.json()),
      fetch(`/api/admin/caja/resumen-previo`).then((r) => r.json()),
    ]).then(([pendientesData, resumenData]) => {
      const delDia: PagoPendiente[] = pendientesData.del_dia ?? [];
      const otros: PagoPendiente[] = pendientesData.otros ?? [];
      setPendientesDelDia(delDia);
      setPendientesOtros(otros);
      setSeleccionados(new Set(delDia.map((p: PagoPendiente) => p.id)));
      if (!resumenData.error) setResumen(resumenData);
    }).catch(() => {
      toast.error("Error al cargar datos de cierre");
    }).finally(() => setLoadingData(false));
  }, [open, sesionId]);

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCerrar(facturar: boolean) {
    const montoNum = parseFloat(montoCierre.replace(",", "."));
    if (isNaN(montoNum) || montoNum < 0) {
      toast.error("Ingresá el monto de efectivo contado");
      return;
    }

    setLoading(true);
    try {
      const pago_ids_facturar = facturar ? Array.from(seleccionados) : [];
      const res = await fetch("/api/admin/caja/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto_cierre_declarado: montoNum,
          pago_ids_facturar,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Error al cerrar caja");
        return;
      }
      const fac = json.facturacion as { emitidas: number; fallidas: number; total: number } | undefined;
      if (fac && fac.fallidas > 0) {
        toast.warning(
          `Caja cerrada. ${fac.emitidas} factura${fac.emitidas !== 1 ? "s" : ""} emitida${fac.emitidas !== 1 ? "s" : ""}, ${fac.fallidas} fallida${fac.fallidas !== 1 ? "s" : ""}. Revisá Facturación.`
        );
      } else if (fac && fac.emitidas > 0) {
        toast.success(
          `Caja cerrada. ${fac.emitidas} factura${fac.emitidas !== 1 ? "s" : ""} emitida${fac.emitidas !== 1 ? "s" : ""} correctamente.`
        );
      } else {
        toast.success(facturar ? "Caja cerrada y facturación iniciada" : "Caja cerrada sin facturar");
      }
      window.dispatchEvent(new CustomEvent("caja-estado-changed"));
      onSuccess();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  const montoNum = parseFloat(montoCierre.replace(",", "."));
  const diferencia = !isNaN(montoNum) ? montoNum - montoApertura : null;

  const titulosPaso = {
    1: "Cerrar caja — Conciliación efectivo",
    2: "Cerrar caja — Resumen del día",
    3: "Cerrar caja — Facturación",
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titulosPaso[paso]}</DialogTitle>
        </DialogHeader>

        {loadingData ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Cargando datos...</div>
        ) : paso === 1 ? (
          /* ── Paso 1: Efectivo ── */
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Conciliación efectivo</p>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Efectivo inicial</span>
                <span className="font-medium">${montoApertura.toLocaleString("es-AR")}</span>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="monto_cierre" className="text-xs">Efectivo contado al cierre</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    id="monto_cierre"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0"
                    value={montoCierre}
                    onChange={(e) => setMontoCierre(e.target.value)}
                    className="pl-7"
                    autoFocus
                  />
                </div>
              </div>
              {diferencia !== null && (
                <div className={`flex justify-between text-sm font-medium ${diferencia < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  <span>Diferencia</span>
                  <span>{diferencia >= 0 ? "+" : ""}${diferencia.toLocaleString("es-AR")}</span>
                </div>
              )}
            </div>
          </div>
        ) : paso === 2 ? (
          /* ── Paso 2: Resumen ── */
          <div className="space-y-3 py-2">
            {resumen ? (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Totales de la sesión</p>
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
                {diferencia !== null && (
                  <div className={`flex justify-between text-sm font-semibold border-t border-border pt-2 ${diferencia < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    <span>Diferencia efectivo</span>
                    <span>{diferencia >= 0 ? "+" : ""}${diferencia.toLocaleString("es-AR")}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No se pudo cargar el resumen.</p>
            )}
          </div>
        ) : (
          /* ── Paso 3: Facturación ── */
          <div className="space-y-3 py-2 max-h-96 overflow-y-auto">
            {pendientesDelDia.length === 0 && pendientesOtros.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No hay transferencias pendientes de facturar.
              </p>
            ) : (
              <>
                {pendientesDelDia.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Del día</p>
                    {pendientesDelDia.map((p) => (
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/30 cursor-pointer">
                        <Checkbox
                          checked={seleccionados.has(p.id)}
                          onCheckedChange={() => toggleSeleccion(p.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground capitalize">{p.origen_tipo}</span>
                          {p.cuenta_bancaria && (
                            <span className="text-xs text-muted-foreground ml-1">· {p.cuenta_bancaria.nombre_display}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium shrink-0">${Number(p.monto).toLocaleString("es-AR")}</span>
                      </label>
                    ))}
                  </div>
                )}
                {pendientesOtros.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pendientes de otros días</p>
                    {pendientesOtros.map((p) => (
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted/30 cursor-pointer">
                        <Checkbox
                          checked={seleccionados.has(p.id)}
                          onCheckedChange={() => toggleSeleccion(p.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-muted-foreground capitalize">{p.origen_tipo}</span>
                          {p.cuenta_bancaria && (
                            <span className="text-xs text-muted-foreground ml-1">· {p.cuenta_bancaria.nombre_display}</span>
                          )}
                        </div>
                        <span className="text-sm font-medium shrink-0">${Number(p.monto).toLocaleString("es-AR")}</span>
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {paso === 1 ? (
            <>
              <Button variant="outline" size="sm" onClick={onClose} disabled={loading}>Cancelar</Button>
              <Button
                size="sm"
                onClick={() => setPaso(2)}
                disabled={!montoCierre || loading}
              >
                Siguiente →
              </Button>
            </>
          ) : paso === 2 ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setPaso(1)} disabled={loading}>← Anterior</Button>
              <Button size="sm" onClick={() => setPaso(3)} disabled={loading}>
                Siguiente →
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setPaso(2)} disabled={loading}>← Anterior</Button>
              {pendientesDelDia.length === 0 && pendientesOtros.length === 0 ? (
                <Button size="sm" onClick={() => handleCerrar(false)} disabled={loading}>
                  {loading ? "Cerrando..." : "Cerrar caja"}
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleCerrar(false)} disabled={loading}>
                    Cerrar sin facturar
                  </Button>
                  <Button size="sm" onClick={() => handleCerrar(true)} disabled={loading}>
                    {loading ? "Cerrando..." : `Facturar (${seleccionados.size}) y cerrar`}
                  </Button>
                </>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
