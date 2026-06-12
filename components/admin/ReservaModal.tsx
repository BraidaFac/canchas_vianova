"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

type Cancha = { id: number; nombre: string; tipo: string; jugadores: number };
type Turno = { id: number; hora_inicio: string; hora_fin: string };
type ClienteResult = { id: string; nombre: string; telefono: string };

type ReservaFull = {
  id: string;
  id_legible: string;
  estado: string;
  cancha_id: number;
  turno_id: number;
  fecha: string;
  monto_total: number;
  monto_abonado: number;
  clientes: { id?: string; nombre: string; telefono: string } | null;
};

type ReservaModalProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  canchas: Cancha[];
  turnos: Turno[];
  precios: Record<number, number>;
  prefill?: { canchaId?: number; turnoId?: number; fecha?: string };
  reserva?: ReservaFull;
};

function fmt(hora: string) {
  return hora.slice(0, 5);
}

export default function ReservaModal({
  open,
  onClose,
  onSuccess,
  canchas,
  turnos,
  precios,
  prefill,
  reserva,
}: ReservaModalProps) {
  const isEdit = !!reserva;

  // ── Edit mode state ──
  const [editMontoTotal, setEditMontoTotal] = useState(String(reserva?.monto_total ?? 0));
  const [editMontoAbonado, setEditMontoAbonado] = useState(String(reserva?.monto_abonado ?? 0));
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [loadingCompletar, setLoadingCompletar] = useState(false);

  // ── Create mode state ──
  // Client selection
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteResults, setClienteResults] = useState<ClienteResult[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<ClienteResult | null>(null);
  const [showNewCliente, setShowNewCliente] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newTelefono, setNewTelefono] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Slot
  const [canchaId, setCanchaId] = useState<string>(
    prefill?.canchaId ? String(prefill.canchaId) : (canchas[0] ? String(canchas[0].id) : "")
  );
  const [turnoId, setTurnoId] = useState<string>(
    prefill?.turnoId ? String(prefill.turnoId) : (turnos[0] ? String(turnos[0].id) : "")
  );
  const [fecha, setFecha] = useState<string>(prefill?.fecha ?? "");

  // Payment
  const [montoTotal, setMontoTotal] = useState<string>(() => {
    const initId = prefill?.canchaId ?? canchas[0]?.id;
    return initId && precios[initId] ? String(precios[initId]) : "";
  });
  const [montoAbonado, setMontoAbonado] = useState("0");
  const [estado, setEstado] = useState("pendiente_pago");

  // Fijo
  const [esFijo, setEsFijo] = useState(false);
  const [fechaHasta, setFechaHasta] = useState("");

  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync price when cancha changes
  useEffect(() => {
    if (!isEdit && canchaId && precios[Number(canchaId)]) {
      setMontoTotal(String(precios[Number(canchaId)]));
    }
  }, [canchaId, precios, isEdit]);

  // Debounced client search
  const searchClientes = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setClienteResults([]);
      setDropdownOpen(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/clientes?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setClienteResults(data.slice(0, 5));
          setDropdownOpen(true);
        }
      } catch {
        // ignore
      }
    }, 300);
  }, []);

  function handleClienteSearchChange(val: string) {
    setClienteSearch(val);
    searchClientes(val);
  }

  function selectCliente(c: ClienteResult) {
    setSelectedCliente(c);
    setClienteSearch("");
    setClienteResults([]);
    setDropdownOpen(false);
    setShowNewCliente(false);
  }

  function deselectCliente() {
    setSelectedCliente(null);
  }

  function handleNewClienteOption() {
    setShowNewCliente(true);
    setDropdownOpen(false);
    setSelectedCliente(null);
  }

  // ── Submit handlers ──

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reservas/${reserva!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto_total: Number(editMontoTotal),
          monto_abonado: Number(editMontoAbonado),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Error al actualizar");
        return;
      }
      toast.success("Reserva actualizada");
      onSuccess();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelReserva() {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reservas/${reserva!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: "cancelada" }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Error al cancelar");
        return;
      }
      toast.success("Reserva cancelada");
      onSuccess();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
      setConfirmCancel(false);
    }
  }

  async function handleCompletar() {
    setLoadingCompletar(true);
    try {
      const res = await fetch(`/api/admin/reservas/${reserva!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estado: "completada",
          monto_total: Number(editMontoTotal),
          monto_abonado: Number(editMontoAbonado),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Error al completar");
        return;
      }
      toast.success("Reserva completada");
      onSuccess();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoadingCompletar(false);
    }
  }

  async function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canchaId || !turnoId || !fecha) {
      toast.error("Completá cancha, turno y fecha");
      return;
    }

    const body: Record<string, unknown> = {
      cancha_id: Number(canchaId),
      turno_id: Number(turnoId),
      fecha,
      monto_total: Number(montoTotal) || 0,
      monto_abonado: Number(montoAbonado) || 0,
      estado,
    };

    if (selectedCliente) {
      body.cliente_id = selectedCliente.id;
    } else if (showNewCliente && newTelefono) {
      body.telefono = newTelefono;
      body.nombre = newNombre;
    }

    if (esFijo) {
      body.es_fijo = true;
      if (fechaHasta) body.fecha_hasta = fechaHasta;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Error al crear reserva");
        return;
      }
      const data = await res.json();
      toast.success(`Reserva creada: ${data.id_legible}`);
      onSuccess();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  const canchaName = canchas.find((c) => c.id === reserva?.cancha_id)?.nombre ?? "—";
  const turnoObj = turnos.find((t) => t.id === reserva?.turno_id);
  const turnoLabel = turnoObj ? `${fmt(turnoObj.hora_inicio)} – ${fmt(turnoObj.hora_fin)}` : "—";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
        {isEdit ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-mono text-sm text-muted-foreground">
                {reserva!.id_legible}
              </DialogTitle>
            </DialogHeader>

            {/* Non-editable info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm bg-muted/40 rounded-lg p-3">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Cancha</div>
                <div className="font-medium">{canchaName}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Horario</div>
                <div className="font-medium">{turnoLabel}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Fecha</div>
                <div className="font-medium">{reserva!.fecha.split("-").reverse().join("/")}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Cliente</div>
                <div className="font-medium">{reserva!.clientes?.nombre ?? "—"}</div>
                {reserva!.clientes?.telefono && (
                  <div className="text-xs text-muted-foreground">{reserva!.clientes.telefono}</div>
                )}
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Monto Total</label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={editMontoTotal}
                    onChange={(e) => setEditMontoTotal(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Monto Abonado</label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={editMontoAbonado}
                    onChange={(e) => setEditMontoAbonado(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                {/* Completar — full width, with hint when disabled */}
                {reserva!.estado !== "completada" && reserva!.estado !== "cancelada" && (
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      !(Number(editMontoTotal) > 0 && Number(editMontoAbonado) === Number(editMontoTotal)) ||
                      loading || loadingCompletar
                    }
                    onClick={handleCompletar}
                    title={
                      !(Number(editMontoTotal) > 0 && Number(editMontoAbonado) === Number(editMontoTotal))
                        ? "El monto abonado debe coincidir con el monto total"
                        : undefined
                    }
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40"
                  >
                    {loadingCompletar ? "Completando..." : "Completar reserva"}
                  </Button>
                )}
                {!(Number(editMontoTotal) > 0 && Number(editMontoAbonado) === Number(editMontoTotal)) &&
                  reserva!.estado !== "completada" && reserva!.estado !== "cancelada" && (
                  <p className="text-[11px] text-muted-foreground text-center -mt-1">
                    El monto abonado debe coincidir con el total para completar
                  </p>
                )}
                <div className="flex gap-2 justify-between">
                  {estado !== "cancelada" && estado !== "completada" && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleCancelReserva}
                      disabled={loading || loadingCompletar}
                    >
                      {confirmCancel ? "¿Confirmar?" : "Cancelar reserva"}
                    </Button>
                  )}
                  <Button
                    type="submit"
                    size="sm"
                    disabled={loading || loadingCompletar}
                    className="ml-auto"
                  >
                    {loading ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Nueva Reserva</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Cliente section */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1.5">Cliente</label>

                {selectedCliente ? (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 bg-muted rounded-md">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{selectedCliente.nombre}</div>
                      <div className="text-xs text-muted-foreground">{selectedCliente.telefono}</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={deselectCliente}
                    >
                      <X size={12} />
                    </Button>
                  </div>
                ) : showNewCliente ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Nombre"
                      value={newNombre}
                      onChange={(e) => setNewNombre(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      placeholder="Teléfono"
                      value={newTelefono}
                      onChange={(e) => setNewTelefono(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => { setShowNewCliente(false); setNewNombre(""); setNewTelefono(""); }}
                    >
                      Cancelar
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      placeholder="Buscar por teléfono o nombre..."
                      value={clienteSearch}
                      onChange={(e) => handleClienteSearchChange(e.target.value)}
                      onFocus={() => { if (clienteResults.length > 0) setDropdownOpen(true); }}
                      className="h-8 text-sm"
                    />
                    {dropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-popover border border-border rounded-md shadow-md overflow-hidden">
                        {clienteResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                            onClick={() => selectCliente(c)}
                          >
                            <div className="font-medium">{c.nombre}</div>
                            <div className="text-xs text-muted-foreground">{c.telefono}</div>
                          </button>
                        ))}
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-accent transition-colors border-t border-border"
                          onClick={handleNewClienteOption}
                        >
                          + Nuevo cliente
                        </button>
                      </div>
                    )}
                    {!dropdownOpen && clienteSearch.trim() === "" && (
                      <button
                        type="button"
                        className="mt-1 text-xs text-primary hover:underline"
                        onClick={handleNewClienteOption}
                      >
                        + Nuevo cliente
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Slot section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Cancha</label>
                  <Select value={canchaId} onValueChange={setCanchaId}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Cancha..." />
                    </SelectTrigger>
                    <SelectContent>
                      {canchas.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Turno</label>
                  <Select value={turnoId} onValueChange={setTurnoId}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Turno..." />
                    </SelectTrigger>
                    <SelectContent>
                      {turnos.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {fmt(t.hora_inicio)} – {fmt(t.hora_fin)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha</label>
                <DatePicker
                  value={fecha}
                  onChange={setFecha}
                  placeholder="Seleccionar fecha"
                />
              </div>

              {/* Payment section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Monto Total</label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={montoTotal}
                    onChange={(e) => setMontoTotal(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Monto Abonado</label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={montoAbonado}
                    onChange={(e) => setMontoAbonado(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Estado</label>
                <Select value={estado} onValueChange={setEstado}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente_pago">Pendiente de pago</SelectItem>
                    <SelectItem value="confirmada">Confirmada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Turno fijo */}
              <div className="rounded-lg border border-border p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={esFijo}
                    onChange={(e) => setEsFijo(e.target.checked)}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  <span className="text-sm font-medium">Turno fijo</span>
                  <span className="text-xs text-muted-foreground">— se repite cada semana automáticamente</span>
                </label>
                {esFijo && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha hasta (opcional)</label>
                    <DatePicker
                      value={fechaHasta}
                      onChange={setFechaHasta}
                      placeholder="Sin fecha de fin"
                      minDate={fecha}
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? "Creando..." : "Crear reserva"}
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
