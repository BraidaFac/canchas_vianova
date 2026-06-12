"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Search, Plus, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import ReservaModal from "./ReservaModal";

type Cancha = { id: number; nombre: string; tipo: string; jugadores: number };
type Turno = { id: number; hora_inicio: string; hora_fin: string };

type Reserva = {
  id: string;
  id_legible: string;
  fecha: string;
  estado: string;
  canal: string;
  cancha_id: number;
  turno_id: number;
  monto_total: number;
  monto_abonado: number;
  created_at: string;
  clientes: { id?: string; nombre: string; telefono: string } | null;
  canchas: { nombre: string; tipo: string } | null;
  turnos: { hora_inicio: string } | null;
};

const estadoConfig: Record<string, { label: string; className: string }> = {
  confirmada: { label: "Confirmada", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  pendiente_pago: { label: "Pend. pago", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  cancelada: { label: "Cancelada", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};


export default function ReservasClient({
  reservas,
  filtroEstado,
  busqueda: busquedaInicial,
  canchas,
  turnos,
  precios,
}: {
  reservas: Reserva[];
  filtroEstado: string;
  busqueda: string;
  canchas: Cancha[];
  turnos: Turno[];
  precios: Record<number, number>;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const [modalCreate, setModalCreate] = useState(false);
  const [modalEdit, setModalEdit] = useState<Reserva | null>(null);

  function cambiarFiltro(estado: string) {
    const params = new URLSearchParams();
    if (estado !== "todas") params.set("estado", estado);
    router.push(`/admin/reservas?${params.toString()}`);
  }

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return reservas;
    const q = busqueda.toLowerCase();
    return reservas.filter(
      (r) =>
        r.id_legible.toLowerCase().includes(q) ||
        r.clientes?.nombre.toLowerCase().includes(q) ||
        r.clientes?.telefono.includes(q)
    );
  }, [reservas, busqueda]);

  // Build a ReservaFull-compatible object from Reserva for the modal
  function toReservaFull(r: Reserva) {
    return {
      id: r.id,
      id_legible: r.id_legible,
      estado: r.estado,
      cancha_id: r.cancha_id,
      turno_id: r.turno_id,
      fecha: r.fecha,
      monto_total: r.monto_total,
      monto_abonado: r.monto_abonado,
      clientes: r.clientes,
    };
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold mb-3">Reservas</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, teléfono o ID..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Select value={filtroEstado} onValueChange={cambiarFiltro}>
            <SelectTrigger size="sm" className="text-sm w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="confirmada">Confirmadas</SelectItem>
              <SelectItem value="pendiente_pago">Pend. pago</SelectItem>
              <SelectItem value="cancelada">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 h-8 px-3 shrink-0"
            onClick={() => setModalCreate(true)}
          >
            <Plus size={13} />
            <span className="text-xs">Nueva reserva</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {filtradas.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Sin reservas
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">ID</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Cliente</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">Cancha</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden md:table-cell">Fecha</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden md:table-cell">Hora</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden sm:table-cell">Monto</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map((r) => {
                const cfg = estadoConfig[r.estado] ?? { label: r.estado, className: "" };
                return (
                  <tr
                    key={r.id}
                    className="odd:bg-background even:bg-muted/30 hover:bg-accent/40 transition-colors cursor-pointer"
                    onClick={() => setModalEdit(r)}
                  >
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">
                      {r.id_legible}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-medium">{r.clientes?.nombre ?? "—"}</div>
                      <div className="text-muted-foreground">{r.clientes?.telefono}</div>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      {r.canchas?.nombre ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      {format(parseISO(r.fecha), "dd/MM/yyyy")}
                    </td>
                    <td className="px-3 py-2.5 font-mono hidden md:table-cell">
                      {r.turnos?.hora_inicio.slice(0, 5) ?? "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", cfg.className)}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                      <div>${r.monto_abonado.toLocaleString("es-AR")}</div>
                      <div className="text-muted-foreground/60">/{r.monto_total.toLocaleString("es-AR")}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Editar"
                          onClick={() => setModalEdit(r)}
                        >
                          <Pencil size={11} />
                        </Button>
                        {r.estado !== "cancelada" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:text-destructive"
                            title="Cancelar"
                            onClick={async () => {
                              if (!confirm(`¿Cancelar la reserva ${r.id_legible}?`)) return;
                              const res = await fetch(`/api/admin/reservas/${r.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ estado: "cancelada" }),
                              });
                              if (res.ok) router.refresh();
                            }}
                          >
                            <X size={11} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalCreate && (
        <ReservaModal
          open={true}
          onClose={() => setModalCreate(false)}
          onSuccess={() => { setModalCreate(false); router.refresh(); }}
          canchas={canchas}
          turnos={turnos}
          precios={precios}
        />
      )}

      {modalEdit && (
        <ReservaModal
          open={true}
          onClose={() => setModalEdit(null)}
          onSuccess={() => { setModalEdit(null); router.refresh(); }}
          canchas={canchas}
          turnos={turnos}
          precios={precios}
          reserva={toReservaFull(modalEdit)}
        />
      )}
    </div>
  );
}
