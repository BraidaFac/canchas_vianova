"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { format, addDays, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Plus,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import ReservaModal from "./ReservaModal";

type Cancha = {
  id: number;
  nombre: string;
  tipo: string;
  jugadores: number;
  activa: boolean;
};
type Turno = { id: number; hora_inicio: string; hora_fin: string };
type Reserva = {
  id: string;
  id_legible: string;
  estado: string;
  canal: string;
  cancha_id: number;
  turno_id: number;
  fecha: string;
  monto_total: number;
  monto_abonado: number;
  recurrente_id: number | null;
  clientes: { id?: string; nombre: string; telefono: string } | null;
};
type ReservaFull = Reserva;
type Fijo = {
  id: number;
  cancha_id: number;
  turno_id: number;
  dia_semana: number;
  clientes: { id?: string; nombre: string; telefono: string } | null;
};
type EventoActivo = {
  id: number;
  nombre: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
  evento_slots: {
    cancha_id: number;
    turno_id: number;
    dia_semana: number | null;
  }[];
};

type Props = {
  fecha: string;
  today: string;
  canchas: Cancha[];
  canchasLista: Cancha[];
  turnos: Turno[];
  reservas: Reserva[];
  fijosDelDia: Fijo[];
  allReservas: Reserva[];
  todosLosFijos: Fijo[];
  vistaInicial: "A" | "3";
  precios: Record<number, number>;
  eventosActivos: EventoActivo[];
};

function fmt(hora: string) {
  return hora.slice(0, 5);
}

function estadoBadge(_estado: string, esFijo: boolean) {
  if (!esFijo) return null;
  return (
    <Badge
      variant="outline"
      className="text-[10px] px-1 py-0 bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700"
    >
      FIJO
    </Badge>
  );
}

export default function GrillaClient({
  fecha,
  today,
  canchas,
  canchasLista,
  turnos,
  reservas,
  fijosDelDia,
  allReservas,
  todosLosFijos,
  vistaInicial,
  precios,
  eventosActivos,
}: Props) {
  const router = useRouter();
  const [vista, setVista] = useState<"A" | "3">(vistaInicial);
  const [canchaSeleccionada, setCanchaSeleccionada] = useState<string>(
    String(canchasLista[0]?.id ?? ""),
  );
  const [diasAMostrar, setDiasAMostrar] = useState(10);
  const [modalCreate, setModalCreate] = useState<{
    canchaId?: number;
    turnoId?: number;
    fecha?: string;
    recurrenteId?: number;
    clienteId?: string;
    clienteNombre?: string;
    clienteTelefono?: string;
  } | null>(null);
  const [modalEdit, setModalEdit] = useState<ReservaFull | null>(null);

  function navegarFecha(delta: number) {
    const nueva = format(addDays(parseISO(fecha), delta), "yyyy-MM-dd");
    router.push(`/admin/grilla?fecha=${nueva}`);
  }

  // Keyboard shortcut: press 'n' or 'N' to open create modal
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (e.key === "n" || e.key === "N") {
        setModalCreate({ fecha });
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [fecha]);

  // Vista A: slot para fecha actual
  function getSlotA(canchaId: number, turnoId: number) {
    const r = reservas.find(
      (r) =>
        r.cancha_id === canchaId &&
        r.turno_id === turnoId &&
        r.estado !== "cancelada",
    );
    if (r) return { reserva: r, esFijo: !!r.recurrente_id };
    // Cancelled reserva suppresses fijo display for this slot/date
    const hasCancelled = reservas.some(
      (r) =>
        r.cancha_id === canchaId &&
        r.turno_id === turnoId &&
        r.estado === "cancelada",
    );
    if (hasCancelled) return null;
    const f = fijosDelDia.find(
      (f) => f.cancha_id === canchaId && f.turno_id === turnoId,
    );
    if (f) return { fijo: f, esFijo: true };
    return null;
  }

  // Vista Lista: slot para fecha+dia específico
  function getSlotLista(
    canchaId: number,
    turnoId: number,
    fechaStr: string,
    diaSemana: number,
  ) {
    const r = allReservas.find(
      (r) =>
        r.cancha_id === canchaId &&
        r.turno_id === turnoId &&
        r.fecha === fechaStr &&
        r.estado !== "cancelada",
    );
    if (r) return { reserva: r, esFijo: !!r.recurrente_id };
    // Cancelled reserva suppresses fijo display for this slot/date
    const hasCancelled = allReservas.some(
      (r) =>
        r.cancha_id === canchaId &&
        r.turno_id === turnoId &&
        r.fecha === fechaStr &&
        r.estado === "cancelada",
    );
    if (hasCancelled) return null;
    const f = todosLosFijos.find(
      (f) =>
        f.cancha_id === canchaId &&
        f.turno_id === turnoId &&
        f.dia_semana === diaSemana,
    );
    if (f) return { fijo: f, esFijo: true };
    return null;
  }

  /** Returns the EventoActivo that blocks this cancha+turno on a specific date */
  function getEventoSlot(
    canchaId: number,
    turnoId: number,
    fechaStr: string,
  ): EventoActivo | null {
    const diaSemana = new Date(fechaStr + "T12:00:00").getDay();
    for (const evento of eventosActivos) {
      if (fechaStr < evento.fecha_inicio || fechaStr > evento.fecha_fin)
        continue;
      const match = evento.evento_slots.some(
        (s) =>
          s.cancha_id === canchaId &&
          s.turno_id === turnoId &&
          (s.dia_semana === null || s.dia_semana === diaSemana),
      );
      if (match) return evento;
    }
    return null;
  }

  const isToday = fecha === today;

  // Columnas para Vista Lista: N días desde hoy
  const diasCols = Array.from({ length: diasAMostrar }, (_, i) => {
    const d = addDays(parseISO(today), i);
    return {
      fechaStr: format(d, "yyyy-MM-dd"),
      diaSemana: d.getDay(),
      diaNombre: format(d, "EEE", { locale: es }),
      diaNum: format(d, "d"),
      mes: format(d, "MMM", { locale: es }),
      esHoy: i === 0,
    };
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ── MOBILE HEADER: 2 filas ── */}
      <div className="sm:hidden bg-card border-b border-border sticky top-0 z-10">
        {/* Fila 1: toggle vistas + nueva reserva */}
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-1">
            <Button
              variant={vista === "A" ? "default" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 px-2.5"
              onClick={() => setVista("A")}
            >
              <LayoutGrid size={13} />
              <span className="text-xs">Grilla</span>
            </Button>
            <Button
              variant={vista === "3" ? "default" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 px-2.5"
              onClick={() => setVista("3")}
            >
              <List size={13} />
              <span className="text-xs">Lista</span>
            </Button>
          </div>
          <Button
            variant="default"
            size="icon"
            className="h-8 w-8"
            onClick={() => setModalCreate({ fecha })}
            title="Nueva reserva"
          >
            <Plus size={14} />
          </Button>
        </div>
        {/* Fila 2: controles de contexto */}
        {vista === "A" && (
          <div className="flex items-center gap-1 px-4 pb-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => navegarFecha(-1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <DatePicker
              value={fecha}
              onChange={(val) => router.push(`/admin/grilla?fecha=${val}`)}
              className={cn(
                "flex-1 font-semibold text-sm",
                isToday &&
                  "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10",
              )}
              isToday={isToday}
              showDayName
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => navegarFecha(1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
        {vista === "3" && (
          <div className="flex items-center gap-2 px-4 pb-2">
            <Select
              value={canchaSeleccionada}
              onValueChange={setCanchaSeleccionada}
            >
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canchasLista.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ToggleGroup
              type="single"
              value={String(diasAMostrar)}
              onValueChange={(v) => {
                if (v) setDiasAMostrar(Number(v));
              }}
              className="border border-border rounded-md shrink-0"
            >
              <ToggleGroupItem value="7" className="h-8 px-2.5 text-xs">
                7d
              </ToggleGroupItem>
              <ToggleGroupItem value="10" className="h-8 px-2.5 text-xs">
                10d
              </ToggleGroupItem>
              <ToggleGroupItem value="15" className="h-8 px-2.5 text-xs">
                15d
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
      </div>

      {/* ── DESKTOP HEADER: 1 fila ── */}
      <div className="hidden sm:flex items-center justify-between gap-x-2 px-4 py-2 border-b border-border bg-card sticky top-0 z-10">
        {/* Vista A — navegación de fecha */}
        {vista === "A" && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => navegarFecha(-1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <DatePicker
              value={fecha}
              onChange={(val) => router.push(`/admin/grilla?fecha=${val}`)}
              className={cn(
                "min-w-[150px] font-semibold text-sm",
                isToday &&
                  "border-primary/40 bg-primary/5 text-primary hover:bg-primary/10",
              )}
              isToday={isToday}
              showDayName
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => navegarFecha(1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        )}
        {/* Vista Lista — cancha + cantidad días */}
        {vista === "3" && (
          <div className="flex items-center gap-2">
            <Select
              value={canchaSeleccionada}
              onValueChange={setCanchaSeleccionada}
            >
              <SelectTrigger className="h-8 text-xs w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canchasLista.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ToggleGroup
              type="single"
              value={String(diasAMostrar)}
              onValueChange={(v) => {
                if (v) setDiasAMostrar(Number(v));
              }}
              className="border border-border rounded-md"
            >
              <ToggleGroupItem value="7" className="h-8 px-2.5 text-xs">
                7d
              </ToggleGroupItem>
              <ToggleGroupItem value="10" className="h-8 px-2.5 text-xs">
                10d
              </ToggleGroupItem>
              <ToggleGroupItem value="15" className="h-8 px-2.5 text-xs">
                15d
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        )}
        {/* Desktop: acciones */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 h-8 px-3"
            onClick={() => setModalCreate({ fecha })}
          >
            <Plus size={13} />
            <span className="text-xs">Nueva</span>
          </Button>
          <Button
            variant={vista === "A" ? "default" : "outline"}
            size="sm"
            className="gap-1.5 h-8 px-3"
            onClick={() => setVista("A")}
          >
            <LayoutGrid size={13} />
            <span className="text-xs">Grilla</span>
          </Button>
          <Button
            variant={vista === "3" ? "default" : "outline"}
            size="sm"
            className="gap-1.5 h-8 px-3"
            onClick={() => setVista("3")}
          >
            <List size={13} />
            <span className="text-xs">Lista</span>
          </Button>
        </div>
      </div>

      {/* ── VISTA A: filas=turnos, columnas=canchas ── */}
      {vista === "A" && (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs border-collapse min-w-[600px]">
            <thead className="sticky top-0 bg-muted/60 z-10">
              <tr>
                <th className="w-14 px-2 py-2 text-center text-muted-foreground font-medium border-b border-r border-border">
                  Hora
                </th>
                {canchas.map((c) => (
                  <th
                    key={c.id}
                    className="px-2 py-2 text-center font-semibold text-foreground border-b border-r border-border last:border-r-0"
                  >
                    <div>{c.nombre}</div>
                    <div className="text-[10px] font-normal text-muted-foreground">
                      F{c.jugadores === 16 ? "8" : "5"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turnos.map((turno) => (
                <tr key={turno.id} className="hover:bg-accent/30">
                  <td className="px-2 py-1.5 text-foreground font-mono font-semibold text-center border-r border-b border-border whitespace-nowrap">
                    {fmt(turno.hora_inicio)}
                  </td>
                  {canchas.map((cancha) => {
                    const eventoSlot = getEventoSlot(
                      cancha.id,
                      turno.id,
                      fecha,
                    );
                    if (eventoSlot)
                      return (
                        <td
                          key={cancha.id}
                          className="h-10 align-middle px-2 py-1.5 border-r border-b border-border last:border-r-0 bg-purple-50 dark:bg-purple-950/30 ring-2 ring-inset ring-purple-400 cursor-default"
                          title={`Evento: ${eventoSlot.nombre}`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <Trophy
                              size={11}
                              className="text-purple-500 shrink-0"
                            />
                            <span className="text-purple-700 dark:text-purple-300 font-medium truncate text-[11px]">
                              {eventoSlot.nombre}
                            </span>
                          </div>
                        </td>
                      );

                    const slot = getSlotA(cancha.id, turno.id);
                    if (!slot)
                      return (
                        <td
                          key={cancha.id}
                          className="h-10 align-middle px-2 py-1.5 border-r border-b border-border last:border-r-0 text-center cursor-pointer hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-colors"
                          onClick={() =>
                            setModalCreate({
                              canchaId: cancha.id,
                              turnoId: turno.id,
                              fecha,
                            })
                          }
                        >
                          <span className="text-muted-foreground/30">—</span>
                        </td>
                      );
                    const cliente =
                      "reserva" in slot
                        ? slot.reserva?.clientes
                        : slot.fijo?.clientes;
                    return (
                      <td
                        key={cancha.id}
                        className={cn(
                          "h-10 align-middle px-2 py-1.5 border-r border-b border-border last:border-r-0 cursor-pointer relative",
                          slot.esFijo
                            ? "bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 ring-2 ring-inset ring-orange-400"
                            : "reserva" in slot &&
                                slot.reserva?.estado === "completada"
                              ? "bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 ring-2 ring-inset ring-emerald-500"
                              : "reserva" in slot &&
                                  slot.reserva?.estado === "confirmada"
                                ? "bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50 ring-2 ring-inset ring-green-500"
                                : "bg-yellow-50 dark:bg-yellow-950/30 hover:bg-yellow-100 dark:hover:bg-yellow-950/50 ring-2 ring-inset ring-yellow-500",
                        )}
                        onClick={() => {
                          if ("reserva" in slot && slot.reserva) {
                            setModalEdit(slot.reserva as ReservaFull);
                          } else if ("fijo" in slot && slot.fijo) {
                            setModalCreate({
                              canchaId: cancha.id,
                              turnoId: turno.id,
                              fecha,
                              recurrenteId: slot.fijo.id,
                              clienteId: slot.fijo.clientes?.id,
                              clienteNombre: slot.fijo.clientes?.nombre,
                              clienteTelefono: slot.fijo.clientes?.telefono,
                            });
                          }
                        }}
                      >
                        <div className="relative h-full flex items-center">
                          <span className="font-medium truncate max-w-[80px]">
                            {cliente?.nombre ?? "—"}
                          </span>
                          <div className="absolute top-0.5 right-0.5">
                            {"reserva" in slot
                              ? estadoBadge(
                                  slot.reserva?.estado ?? "",
                                  slot.esFijo,
                                )
                              : estadoBadge("", true)}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── VISTA LISTA: filas=turnos, columnas=días ── */}
      {vista === "3" && (
        <div className="flex-1 overflow-auto">
          <table
            className="w-full text-xs border-collapse"
            style={{ minWidth: `${80 + diasAMostrar * 100}px` }}
          >
            <thead className="sticky top-0 bg-muted/60 z-10">
              <tr>
                <th className="w-14 px-2 py-2 text-center text-muted-foreground font-medium border-b border-r border-border sticky left-0 bg-muted/60 z-20">
                  Hora
                </th>
                {diasCols.map((d) => (
                  <th
                    key={d.fechaStr}
                    className={cn(
                      "px-2 py-1.5 text-center font-medium border-b border-r border-border last:border-r-0 min-w-[90px]",
                      d.esHoy && "bg-primary/5",
                    )}
                  >
                    <div
                      className={cn(
                        "capitalize text-[11px]",
                        d.esHoy
                          ? "text-primary font-semibold"
                          : "text-foreground",
                      )}
                    >
                      {d.diaNombre} {d.diaNum}
                    </div>
                    <div className="text-[10px] font-normal text-muted-foreground capitalize">
                      {d.mes}
                    </div>
                    {d.esHoy && (
                      <div className="text-[9px] font-bold text-primary uppercase tracking-wide">
                        hoy
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turnos.map((turno) => (
                <tr key={turno.id} className="hover:bg-accent/30">
                  <td className="px-2 py-1.5 text-foreground font-mono font-semibold text-center border-r border-b border-border whitespace-nowrap sticky left-0 bg-card">
                    {fmt(turno.hora_inicio)}
                  </td>
                  {diasCols.map((d) => {
                    const eventoSlot = getEventoSlot(
                      Number(canchaSeleccionada),
                      turno.id,
                      d.fechaStr,
                    );
                    if (eventoSlot)
                      return (
                        <td
                          key={d.fechaStr}
                          className="h-10 align-middle px-2 py-1.5 border-r border-b border-border last:border-r-0 bg-purple-50 dark:bg-purple-950/30 ring-2 ring-inset ring-purple-400 cursor-default"
                          title={`Evento: ${eventoSlot.nombre}`}
                        >
                          <div className="flex items-center gap-1 min-w-0">
                            <Trophy
                              size={11}
                              className="text-purple-500 shrink-0"
                            />
                            <span className="text-purple-700 dark:text-purple-300 font-medium truncate text-[11px]">
                              {eventoSlot.nombre}
                            </span>
                          </div>
                        </td>
                      );

                    const slot = getSlotLista(
                      Number(canchaSeleccionada),
                      turno.id,
                      d.fechaStr,
                      d.diaSemana,
                    );
                    if (!slot)
                      return (
                        <td
                          key={d.fechaStr}
                          className={cn(
                            "h-10 align-middle px-2 py-1.5 border-r border-b border-border last:border-r-0 text-center cursor-pointer hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-colors",
                            d.esHoy && "bg-primary/5",
                          )}
                          onClick={() =>
                            setModalCreate({
                              canchaId: Number(canchaSeleccionada),
                              turnoId: turno.id,
                              fecha: d.fechaStr,
                            })
                          }
                        >
                          <span className="text-muted-foreground/30">—</span>
                        </td>
                      );
                    const cliente =
                      "reserva" in slot
                        ? slot.reserva?.clientes
                        : slot.fijo?.clientes;
                    return (
                      <td
                        key={d.fechaStr}
                        className={cn(
                          "h-10 align-middle px-2 py-1.5 border-r border-b border-border last:border-r-0 cursor-pointer relative",
                          slot.esFijo
                            ? "bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-950/50 ring-2 ring-inset ring-orange-400"
                            : "reserva" in slot &&
                                slot.reserva?.estado === "completada"
                              ? "bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 ring-2 ring-inset ring-emerald-500"
                              : "reserva" in slot &&
                                  slot.reserva?.estado === "confirmada"
                                ? "bg-green-50 dark:bg-green-950/30 hover:bg-green-100 dark:hover:bg-green-950/50 ring-2 ring-inset ring-green-500"
                                : "bg-yellow-50 dark:bg-yellow-950/30 hover:bg-yellow-100 dark:hover:bg-yellow-950/50 ring-2 ring-inset ring-yellow-500",
                        )}
                        onClick={() => {
                          if ("reserva" in slot && slot.reserva) {
                            setModalEdit(slot.reserva as ReservaFull);
                          } else if ("fijo" in slot && slot.fijo) {
                            setModalCreate({
                              canchaId: Number(canchaSeleccionada),
                              turnoId: turno.id,
                              fecha: d.fechaStr,
                              recurrenteId: slot.fijo.id,
                              clienteId: slot.fijo.clientes?.id,
                              clienteNombre: slot.fijo.clientes?.nombre,
                              clienteTelefono: slot.fijo.clientes?.telefono,
                            });
                          }
                        }}
                      >
                        <div className="relative h-full flex items-center">
                          <span className="font-medium truncate max-w-[80px]">
                            {cliente?.nombre ?? "—"}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modals ── */}
      {modalCreate !== null && (
        <ReservaModal
          open={true}
          onClose={() => setModalCreate(null)}
          onSuccess={() => {
            setModalCreate(null);
            router.refresh();
          }}
          canchas={canchas}
          turnos={turnos}
          precios={precios}
          prefill={modalCreate}
          reservasExistentes={allReservas}
        />
      )}
      {modalEdit && (
        <ReservaModal
          open={true}
          onClose={() => setModalEdit(null)}
          onSuccess={() => {
            setModalEdit(null);
            router.refresh();
          }}
          canchas={canchas}
          turnos={turnos}
          precios={precios}
          reserva={modalEdit}
        />
      )}
    </div>
  );
}
