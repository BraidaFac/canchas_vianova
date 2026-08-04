"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import AbrirCajaDialog from "@/components/admin/AbrirCajaDialog";
import ReabrirCajaDialog from "@/components/admin/ReabrirCajaDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Plus, ChevronLeft, Search, Zap } from "lucide-react";
import type { CarritoItem, CuentaBancaria, MedioPago } from "@/lib/types";

type ReservaHoy = {
  id: string;
  id_legible: string;
  estado: string;
  monto_total: number;
  monto_abonado: number;
  clientes: { id: string; nombre: string; telefono: string } | null;
  canchas: { nombre: string } | null;
  turnos: { hora_inicio: string; hora_fin: string } | null;
};

interface PagoRow {
  medio_pago: MedioPago;
  monto: string;
  cuenta_bancaria_id?: string;
}

interface PagoOption {
  value: string;
  label: string;
  medio_pago: MedioPago;
  cuenta_bancaria_id?: string;
}

interface PanelCobroProps {
  items: CarritoItem[];
  total: number;
  cuentasBancarias: CuentaBancaria[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function PanelCobro({ items, total, cuentasBancarias, onSuccess, onCancel }: PanelCobroProps) {
  const [pagos, setPagos] = useState<PagoRow[]>([
    { medio_pago: "efectivo", monto: total.toString() },
  ]);
  const [enviando, setEnviando] = useState(false);
  const [abrirCajaOpen, setAbrirCajaOpen] = useState(false);
  const [reabrirCajaOpen, setRreabrirCajaOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);

  // Reserva search
  const [reservasHoy, setReservasHoy] = useState<ReservaHoy[]>([]);
  const [reservaBusqueda, setReservaBusqueda] = useState("");
  const [reservaSeleccionada, setReservaSeleccionada] = useState<ReservaHoy | null>(null);
  const [showResultados, setShowResultados] = useState(false);

  useEffect(() => {
    const hoy = new Date().toISOString().slice(0, 10);
    fetch(`/api/admin/reservas?fecha=${hoy}`)
      .then((r) => r.ok ? r.json() : [])
      .then(setReservasHoy)
      .catch(() => {});
  }, []);

  // Flat options: Efectivo | Transferencia · Cuenta A | Transferencia · Cuenta B | Otro
  const pagoOptions = useMemo<PagoOption[]>(() => [
    { value: "efectivo", label: "Efectivo", medio_pago: "efectivo" },
    ...cuentasBancarias.map((cb) => ({
      value: `transferencia::${cb.id}`,
      label: cuentasBancarias.length === 1 ? "Transferencia" : `Transferencia · ${cb.nombre_display}`,
      medio_pago: "transferencia" as MedioPago,
      cuenta_bancaria_id: cb.id,
    })),
    { value: "otro", label: "Otro", medio_pago: "otro" },
  ], [cuentasBancarias]);

  function getPagoValue(p: PagoRow): string {
    if (p.medio_pago === "transferencia" && p.cuenta_bancaria_id) {
      return `transferencia::${p.cuenta_bancaria_id}`;
    }
    return p.medio_pago;
  }

  const reservasFiltradas = reservaBusqueda.trim()
    ? reservasHoy.filter((r) =>
        r.clientes?.nombre.toLowerCase().includes(reservaBusqueda.toLowerCase()) ||
        r.id_legible.toLowerCase().includes(reservaBusqueda.toLowerCase())
      )
    : reservasHoy;

  const formatPrecio = (n: number) =>
    "$" + n.toLocaleString("es-AR", { minimumFractionDigits: 0 });

  const totalRegistrado = pagos.reduce((sum, p) => sum + (parseFloat(p.monto) || 0), 0);
  const diferencia = total - totalRegistrado;
  const balanceado = Math.abs(diferencia) <= 1;

  const updatePagoOpcion = (idx: number, val: string) => {
    const opt = pagoOptions.find((o) => o.value === val);
    if (!opt) return;
    setPagos((prev) => prev.map((p, i) =>
      i === idx
        ? { ...p, medio_pago: opt.medio_pago, cuenta_bancaria_id: opt.cuenta_bancaria_id }
        : p
    ));
  };

  const updateMonto = (idx: number, monto: string) => {
    setPagos((prev) => prev.map((p, i) => i === idx ? { ...p, monto } : p));
  };

  const removePago = (idx: number) => {
    setPagos((prev) => prev.filter((_, i) => i !== idx));
  };

  const addPago = () => {
    const usados = new Set(pagos.map(getPagoValue));
    const disponible = pagoOptions.find((o) => !usados.has(o.value));
    if (!disponible) return;
    setPagos((prev) => [...prev, {
      medio_pago: disponible.medio_pago,
      cuenta_bancaria_id: disponible.cuenta_bancaria_id,
      monto: "",
    }]);
  };

  const handleConfirmar = async () => {
    if (!balanceado) {
      toast.error("El monto registrado no coincide con el total");
      return;
    }
    for (const [i, p] of pagos.entries()) {
      if (p.medio_pago === "transferencia" && !p.cuenta_bancaria_id) {
        toast.error(`Pago ${i + 1}: seleccioná una cuenta bancaria para transferencia`);
        return;
      }
    }

    setEnviando(true);
    try {
      const body = {
        items: items.map((c) => ({
          producto_id: c.producto.id,
          cantidad: c.cantidad,
          precio_unitario: c.producto.precio,
        })),
        total,
        notas: undefined,
        reserva_id: reservaSeleccionada?.id || undefined,
        pagos: pagos.map((p) => ({
          medio_pago: p.medio_pago,
          monto: parseFloat(p.monto) || 0,
          cuenta_bancaria_id: p.cuenta_bancaria_id || undefined,
        })),
      };

      const res = await fetch("/api/admin/pos/consumos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "caja_requerida") {
          if (data.code === "jornada_vencida") {
            toast.error("Hay una caja sin cerrar de otro día. Cerrala desde la sección Caja antes de continuar.");
          } else if (data.code === "caja_cerrada_misma_jornada") {
            setPendingSubmit(true);
            setRreabrirCajaOpen(true);
          } else {
            setPendingSubmit(true);
            setAbrirCajaOpen(true);
          }
          return;
        }
        toast.error(data.error ?? "Error al registrar la venta");
        return;
      }

      toast.success("Venta registrada");
      onSuccess();
    } catch {
      toast.error("Error de conexión");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onCancel}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="font-semibold">Cobrar {formatPrecio(total)}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Items summary */}
        <div className="rounded-lg border p-3 space-y-1.5">
          {items.map((item) => (
            <div key={item.producto.id} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {item.producto.nombre} ×{item.cantidad}
              </span>
              <span>{formatPrecio(item.producto.precio * item.cantidad)}</span>
            </div>
          ))}
        </div>

        {/* Pagos */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Medios de pago</p>
          {pagos.map((pago, idx) => {
            const usadosEnOtrasFilas = new Set(
              pagos.filter((_, i) => i !== idx).map(getPagoValue)
            );
            const opcionesDisponibles = pagoOptions.filter(
              (o) => !usadosEnOtrasFilas.has(o.value)
            );
            const otherRowsTotal = pagos.reduce(
              (sum, p, i) => (i !== idx ? sum + (parseFloat(p.monto) || 0) : sum),
              0
            );
            const faltante = Math.round((total - otherRowsTotal) * 100) / 100;
            const showFill = pagos.length > 1 && faltante > 0;

            return (
              <div key={idx} className="flex gap-2 items-center">
                <Select
                  value={getPagoValue(pago)}
                  onValueChange={(val) => updatePagoOpcion(idx, val)}
                >
                  <SelectTrigger className="flex-1 min-w-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {opcionesDisponibles.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  placeholder="Monto"
                  value={pago.monto}
                  onChange={(e) => updateMonto(idx, e.target.value)}
                  className="w-28 shrink-0"
                />
                {showFill && (
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9 shrink-0"
                    title={`Completar con ${formatPrecio(faltante)}`}
                    onClick={() => updateMonto(idx, String(faltante))}
                  >
                    <Zap className="h-3.5 w-3.5" />
                  </Button>
                )}
                {pagos.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removePago(idx)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}

          {pagos.length < pagoOptions.length && (
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={addPago}>
              <Plus className="h-4 w-4" />
              Agregar pago
            </Button>
          )}
        </div>

        {/* Balance */}
        <div
          className={`flex justify-between items-center rounded-lg px-4 py-3 text-sm font-medium ${
            balanceado
              ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
              : diferencia > 0
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          <span>Registrado: {formatPrecio(totalRegistrado)}</span>
          <Badge
            variant="outline"
            className={balanceado ? "border-green-400 text-green-700" : "border-current text-current"}
          >
            {balanceado
              ? "Balanceado"
              : diferencia > 0
              ? `Faltan ${formatPrecio(diferencia)}`
              : `Excede por ${formatPrecio(Math.abs(diferencia))}`}
          </Badge>
        </div>

        {/* Optional: associate to reserva */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Asociar a reserva (opcional)</p>

          {reservaSeleccionada ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {reservaSeleccionada.clientes?.nombre ?? "Sin nombre"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {reservaSeleccionada.canchas?.nombre} · {reservaSeleccionada.turnos?.hora_inicio} · {reservaSeleccionada.id_legible}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => setReservaSeleccionada(null)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Buscar por nombre del cliente..."
                  value={reservaBusqueda}
                  onChange={(e) => { setReservaBusqueda(e.target.value); setShowResultados(true); }}
                  onFocus={() => setShowResultados(true)}
                  onBlur={() => setTimeout(() => setShowResultados(false), 150)}
                  className="h-8 text-sm pl-8"
                />
              </div>
              {showResultados && reservasFiltradas.length > 0 && (
                <div className="mt-1 rounded-md border bg-background shadow-sm divide-y divide-border overflow-hidden">
                  {reservasFiltradas.slice(0, 8).map((r) => (
                    <button
                      key={r.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setReservaSeleccionada(r);
                        setReservaBusqueda("");
                        setShowResultados(false);
                      }}
                    >
                      <p className="text-sm font-medium leading-tight">
                        {r.clientes?.nombre ?? "Sin nombre"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.canchas?.nombre} · {r.turnos?.hora_inicio} · <span className="font-mono">{r.id_legible}</span>
                      </p>
                    </button>
                  ))}
                </div>
              )}
              {showResultados && reservaBusqueda.trim() && reservasFiltradas.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground px-1">Sin resultados para &quot;{reservaBusqueda}&quot;</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t">
        <Button
          className="w-full"
          size="lg"
          disabled={!balanceado || enviando}
          onClick={handleConfirmar}
        >
          {enviando ? "Registrando..." : "Confirmar venta"}
        </Button>
      </div>

      {abrirCajaOpen && (
        <AbrirCajaDialog
          open={true}
          onClose={() => { setAbrirCajaOpen(false); setPendingSubmit(false); }}
          onSuccess={() => { setAbrirCajaOpen(false); if (pendingSubmit) handleConfirmar(); }}
          motivo="Para registrar esta venta necesitás abrir la caja primero."
        />
      )}
      {reabrirCajaOpen && (
        <ReabrirCajaDialog
          open={true}
          onClose={() => { setRreabrirCajaOpen(false); setPendingSubmit(false); }}
          onSuccess={() => { setRreabrirCajaOpen(false); if (pendingSubmit) handleConfirmar(); }}
          onAbrirNueva={() => { setRreabrirCajaOpen(false); setAbrirCajaOpen(true); }}
          motivo="Para registrar esta venta necesitás que la caja esté abierta."
        />
      )}
    </div>
  );
}
