"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Search, Plus, Pencil, X, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReservaModal from "./ReservaModal";
import CancelReservaDialog from "./CancelReservaDialog";

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
  recurrente_id: number | null;
  monto_total: number;
  monto_abonado: number;
  created_at: string;
  clientes: { id?: string; nombre: string; telefono: string } | null;
  canchas: { nombre: string; tipo: string } | null;
  turnos: { hora_inicio: string } | null;
};


function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; className: string }> = {
    confirmada: {
      label: "Confirmada",
      className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    },
    pendiente_pago: {
      label: "Pend. pago",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    cancelada: {
      label: "Cancelada",
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    },
  };
  const cfg = map[estado] ?? { label: estado, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

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
  const [cancelDialog, setCancelDialog] = useState<Reserva | null>(null);

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
      recurrente_id: r.recurrente_id,
      clientes: r.clientes,
    };
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold mb-3">Reservas</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 sm:max-w-xs">
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
            className="h-8 shrink-0"
            onClick={() => setModalCreate(true)}
            title="Nueva reserva"
          >
            <Plus size={13} />
            <span className="hidden sm:inline text-xs">Nueva reserva</span>
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
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">Estado</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden sm:table-cell">Monto</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map((r) => {
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
                      {r.recurrente_id != null && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          Fijo
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <EstadoBadge estado={r.estado} />
                    </td>
                    <td className="px-3 py-2.5 text-right hidden sm:table-cell">
                      <div>${r.monto_abonado.toLocaleString("es-AR")}</div>
                      <div className="text-muted-foreground/60">/{r.monto_total.toLocaleString("es-AR")}</div>
                    </td>
                    <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      {/* Desktop */}
                      <div className="hidden sm:flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Editar" onClick={() => setModalEdit(r)}>
                          <Pencil size={11} />
                        </Button>
                        {r.estado !== "cancelada" && (
                          <Button
                            variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" title="Cancelar"
                            onClick={() => setCancelDialog(r)}
                          >
                            <X size={11} />
                          </Button>
                        )}
                      </div>
                      {/* Mobile */}
                      <div className="flex sm:hidden items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical size={13} /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setModalEdit(r)}>
                              <Pencil size={13} className="mr-2" />Editar
                            </DropdownMenuItem>
                            {r.estado !== "cancelada" && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setCancelDialog(r)}
                              >
                                <X size={13} className="mr-2" />Cancelar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
          reservasExistentes={reservas}
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

      {cancelDialog && (
        <CancelReservaDialog
          open={true}
          onClose={() => setCancelDialog(null)}
          onSuccess={() => { setCancelDialog(null); router.refresh(); }}
          reserva={{
            id: cancelDialog.id,
            id_legible: cancelDialog.id_legible,
            fecha: cancelDialog.fecha,
            monto_abonado: cancelDialog.monto_abonado,
            recurrente_id: cancelDialog.recurrente_id,
            clientes: cancelDialog.clientes
              ? { nombre: cancelDialog.clientes.nombre, telefono: cancelDialog.clientes.telefono }
              : null,
          }}
        />
      )}
    </div>
  );
}
