"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  Trophy,
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
  CalendarRange,
  Layers,
  CheckCircle2,
  XCircle,
  Clock3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type Cancha = { id: number; nombre: string; tipo: string; jugadores: number };
type Turno = { id: number; hora_inicio: string; hora_fin: string };
type Slot = { id?: number; cancha_id: number; turno_id: number; dia_semana: number | null };

type Evento = {
  id: number;
  nombre: string;
  tipo: "liga" | "copa" | "cumpleanos" | "otro";
  fecha_inicio: string;
  fecha_fin: string;
  estado: "activo" | "cancelado" | "finalizado";
  notas: string | null;
  created_at: string;
  evento_slots: Slot[];
};

type SlotDraft = { cancha_id: number | ""; turno_id: number | ""; dia_semana: number | null };

const DIAS = [
  { value: null, label: "Todos los días" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

// ── Badge helpers ──────────────────────────────────────────────────────────

const TIPO_LABELS: Record<Evento["tipo"], string> = {
  liga: "Liga",
  copa: "Copa",
  cumpleanos: "Cumpleaños",
  otro: "Otro",
};

function TipoBadge({ tipo }: { tipo: Evento["tipo"] }) {
  return (
    <Badge
      className={cn(
        "text-xs font-medium",
        tipo === "liga" && "bg-[#133D34]/15 text-[#133D34] border-[#133D34]/20",
        tipo === "copa" && "bg-amber-100 text-amber-800 border-amber-200",
        tipo === "cumpleanos" && "bg-pink-100 text-pink-800 border-pink-200",
        tipo === "otro" && "bg-gray-100 text-gray-600 border-gray-200"
      )}
      variant="outline"
    >
      {TIPO_LABELS[tipo]}
    </Badge>
  );
}

function EstadoBadge({ estado }: { estado: Evento["estado"] }) {
  const map = {
    activo: { label: "Activo", icon: CheckCircle2, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    finalizado: { label: "Finalizado", icon: Clock3, cls: "bg-gray-100 text-gray-600 border-gray-200" },
    cancelado: { label: "Cancelado", icon: XCircle, cls: "bg-red-50 text-red-600 border-red-200" },
  };
  const { label, icon: Icon, cls } = map[estado];
  return (
    <Badge variant="outline" className={cn("text-xs font-medium gap-1", cls)}>
      <Icon size={11} />
      {label}
    </Badge>
  );
}

// ── Slot row in form ───────────────────────────────────────────────────────

function SlotRow({
  slot,
  index,
  canchas,
  turnos,
  onChange,
  onRemove,
}: {
  slot: SlotDraft;
  index: number;
  canchas: Cancha[];
  turnos: Turno[];
  onChange: (i: number, s: SlotDraft) => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Select
        value={slot.cancha_id === "" ? "" : String(slot.cancha_id)}
        onValueChange={(v) => onChange(index, { ...slot, cancha_id: Number(v) })}
      >
        <SelectTrigger className="flex-1 h-8 text-xs">
          <SelectValue placeholder="Cancha" />
        </SelectTrigger>
        <SelectContent>
          {canchas.map((c) => (
            <SelectItem key={c.id} value={String(c.id)} className="text-xs">
              {c.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={slot.turno_id === "" ? "" : String(slot.turno_id)}
        onValueChange={(v) => onChange(index, { ...slot, turno_id: Number(v) })}
      >
        <SelectTrigger className="flex-1 h-8 text-xs">
          <SelectValue placeholder="Turno" />
        </SelectTrigger>
        <SelectContent>
          {turnos.map((t) => (
            <SelectItem key={t.id} value={String(t.id)} className="text-xs">
              {t.hora_inicio.slice(0, 5)} – {t.hora_fin.slice(0, 5)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={slot.dia_semana === null ? "null" : String(slot.dia_semana)}
        onValueChange={(v) =>
          onChange(index, { ...slot, dia_semana: v === "null" ? null : Number(v) })
        }
      >
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="Día" />
        </SelectTrigger>
        <SelectContent>
          {DIAS.map((d) => (
            <SelectItem key={String(d.value)} value={d.value === null ? "null" : String(d.value)} className="text-xs">
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(index)}
      >
        <Trash2 size={13} />
      </Button>
    </div>
  );
}

// ── Confirm dialog ─────────────────────────────────────────────────────────

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  variant = "destructive",
  confirmLabel = "Confirmar",
  loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  variant?: "destructive" | "default";
  confirmLabel?: string;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancelar</Button>
          </DialogClose>
          <Button
            size="sm"
            variant={variant}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Procesando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Form dialog (create / edit) ────────────────────────────────────────────

const EMPTY_FORM = {
  nombre: "",
  tipo: "" as Evento["tipo"] | "",
  fecha_inicio: "",
  fecha_fin: "",
  notas: "",
  slots: [] as SlotDraft[],
};

function EventoFormDialog({
  open,
  onOpenChange,
  evento,
  canchas,
  turnos,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  evento: Evento | null;
  canchas: Cancha[];
  turnos: Turno[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() =>
    evento
      ? {
          nombre: evento.nombre,
          tipo: evento.tipo,
          fecha_inicio: evento.fecha_inicio,
          fecha_fin: evento.fecha_fin,
          notas: evento.notas ?? "",
          slots: evento.evento_slots.map((s) => ({
            cancha_id: s.cancha_id,
            turno_id: s.turno_id,
            dia_semana: s.dia_semana,
          })) as SlotDraft[],
        }
      : { ...EMPTY_FORM, slots: [] as SlotDraft[] }
  );
  const [saving, setSaving] = useState(false);

  function updateSlot(i: number, s: SlotDraft) {
    setForm((f) => ({ ...f, slots: f.slots.map((x, idx) => (idx === i ? s : x)) }));
  }
  function removeSlot(i: number) {
    setForm((f) => ({ ...f, slots: f.slots.filter((_, idx) => idx !== i) }));
  }
  function addSlot() {
    setForm((f) => ({
      ...f,
      slots: [...f.slots, { cancha_id: canchas[0]?.id ?? "", turno_id: turnos[0]?.id ?? "", dia_semana: null }],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nombre.trim() || !form.tipo || !form.fecha_inicio || !form.fecha_fin) {
      toast.error("Completá los campos obligatorios");
      return;
    }
    if (form.fecha_inicio > form.fecha_fin) {
      toast.error("La fecha de inicio debe ser anterior a la de fin");
      return;
    }
    const invalidSlot = form.slots.some((s) => !s.cancha_id || !s.turno_id);
    if (invalidSlot) {
      toast.error("Completá todos los slots o eliminá los vacíos");
      return;
    }

    setSaving(true);
    try {
      const url = evento ? `/api/admin/eventos/${evento.id}` : "/api/admin/eventos";
      const method = evento ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          tipo: form.tipo,
          fecha_inicio: form.fecha_inicio,
          fecha_fin: form.fecha_fin,
          notas: form.notas.trim() || null,
          slots: form.slots,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (res.status === 409 && err.conflictos?.length) {
          const lista = (err.conflictos as string[]).slice(0, 5).join("\n");
          toast.error(`Conflictos con reservas existentes:\n${lista}`, { duration: 8000 });
          return;
        }
        throw new Error(err.error ?? "Error al guardar");
      }
      toast.success(evento ? "Evento actualizado" : "Evento creado");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{evento ? "Editar evento" : "Nuevo evento"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nombre *</label>
            <Input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Copa de Verano 2026"
              className="h-8 text-sm"
              autoFocus
            />
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tipo *</label>
            <Select
              value={form.tipo}
              onValueChange={(v) => setForm((f) => ({ ...f, tipo: v as Evento["tipo"] }))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Seleccioná un tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="copa">Copa</SelectItem>
                <SelectItem value="liga">Liga</SelectItem>
                <SelectItem value="cumpleanos">Cumpleaños</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Inicio *</label>
              <DatePicker
                value={form.fecha_inicio}
                onChange={(v) => setForm((f) => ({ ...f, fecha_inicio: v }))}
                placeholder="dd/MM/yyyy"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Fin *</label>
              <DatePicker
                value={form.fecha_fin}
                onChange={(v) => setForm((f) => ({ ...f, fecha_fin: v }))}
                placeholder="dd/MM/yyyy"
                minDate={form.fecha_inicio || undefined}
              />
            </div>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Notas</label>
            <textarea
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              placeholder="Información adicional…"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Slots */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Canchas / Turnos ocupados
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1 text-[#133D34] hover:text-[#133D34] hover:bg-[#133D34]/10"
                onClick={addSlot}
              >
                <Plus size={11} />
                Agregar slot
              </Button>
            </div>

            {form.slots.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center border border-dashed rounded-md">
                Sin slots asignados — el evento no bloquea ningún turno
              </p>
            ) : (
              <div className="space-y-2">
                {form.slots.map((slot, i) => (
                  <SlotRow
                    key={i}
                    slot={slot}
                    index={i}
                    canchas={canchas}
                    turnos={turnos}
                    onChange={updateSlot}
                    onRemove={removeSlot}
                  />
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              size="sm"
              className="bg-[#133D34] hover:bg-[#0C2820] text-white"
              disabled={saving}
            >
              {saving ? "Guardando…" : evento ? "Guardar cambios" : "Crear evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function EventosClient({
  eventos: eventosProp,
  canchas,
  turnos,
}: {
  eventos: Evento[];
  canchas: Cancha[];
  turnos: Turno[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [eventos, setEventos] = useState<Evento[]>(eventosProp);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Evento | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Evento | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [estadoTarget, setEstadoTarget] = useState<{
    evento: Evento;
    nuevoEstado: Evento["estado"];
  } | null>(null);
  const [estadoLoading, setEstadoLoading] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  function refresh() {
    startTransition(() => router.refresh());
    // optimistic: re-fetch from API
    fetch("/api/admin/eventos")
      .then((r) => r.json())
      .then((data) => setEventos(data));
  }

  const filtered = eventos.filter((e) => {
    const matchBusqueda =
      !busqueda.trim() || e.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchTipo = filtroTipo === "todos" || e.tipo === filtroTipo;
    const matchEstado = filtroEstado === "todos" || e.estado === filtroEstado;
    return matchBusqueda && matchTipo && matchEstado;
  });

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/admin/eventos/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      toast.success("Evento eliminado");
      setDeleteTarget(null);
      refresh();
    } catch {
      toast.error("No se pudo eliminar el evento");
    } finally {
      setDeleteLoading(false);
    }
  }

  async function handleCambioEstado() {
    if (!estadoTarget) return;
    setEstadoLoading(true);
    try {
      const res = await fetch(`/api/admin/eventos/${estadoTarget.evento.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: estadoTarget.nuevoEstado }),
      });
      if (!res.ok) throw new Error("Error al actualizar estado");
      toast.success(`Evento marcado como ${estadoTarget.nuevoEstado}`);
      setEstadoTarget(null);
      refresh();
    } catch {
      toast.error("No se pudo cambiar el estado");
    } finally {
      setEstadoLoading(false);
    }
  }

  function formatFecha(dateStr: string) {
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy");
    } catch {
      return dateStr;
    }
  }

  const estadoConfirmLabels: Record<Evento["estado"], string> = {
    activo: "Marcar como activo",
    finalizado: "Marcar como finalizado",
    cancelado: "Cancelar evento",
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-[#133D34]" />
          <h1 className="text-sm font-semibold">Eventos</h1>
          {filtered.length > 0 && (
            <span className="text-xs text-muted-foreground">({filtered.length})</span>
          )}
        </div>
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5 bg-[#133D34] hover:bg-[#0C2820] text-white"
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          <Plus size={13} />
          Nuevo evento
        </Button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
        <Input
          placeholder="Buscar evento…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="h-7 text-xs w-48"
        />
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="h-7 text-xs w-32">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" className="text-xs">Todos los tipos</SelectItem>
            <SelectItem value="copa" className="text-xs">Copa</SelectItem>
            <SelectItem value="liga" className="text-xs">Liga</SelectItem>
            <SelectItem value="cumpleanos" className="text-xs">Cumpleaños</SelectItem>
            <SelectItem value="otro" className="text-xs">Otro</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroEstado} onValueChange={setFiltroEstado}>
          <SelectTrigger className="h-7 text-xs w-36">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos" className="text-xs">Todos los estados</SelectItem>
            <SelectItem value="activo" className="text-xs">Activo</SelectItem>
            <SelectItem value="finalizado" className="text-xs">Finalizado</SelectItem>
            <SelectItem value="cancelado" className="text-xs">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 h-64 text-muted-foreground">
            <Trophy size={32} className="opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">
                {eventos.length === 0 ? "No hay eventos todavía" : "Sin resultados"}
              </p>
              <p className="text-xs mt-0.5">
                {eventos.length === 0
                  ? "Creá el primer evento con el botón de arriba"
                  : "Probá cambiando los filtros"}
              </p>
            </div>
            {eventos.length === 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 mt-1"
                onClick={() => { setEditTarget(null); setFormOpen(true); }}
              >
                <Plus size={13} />
                Nuevo evento
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm border-b border-border">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Nombre</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 hidden sm:table-cell">Tipo</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 hidden md:table-cell">Período</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5 hidden lg:table-cell">Slots</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((evento) => (
                <tr
                  key={evento.id}
                  className={cn(
                    "group hover:bg-muted/40 transition-colors",
                    isPending && "opacity-60"
                  )}
                >
                  {/* Nombre */}
                  <td className="px-4 py-3">
                    <span className="font-medium text-sm">{evento.nombre}</span>
                    {evento.notas && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{evento.notas}</p>
                    )}
                    {/* Mobile: tipo inline */}
                    <div className="flex items-center gap-2 mt-1 sm:hidden">
                      <TipoBadge tipo={evento.tipo} />
                    </div>
                  </td>

                  {/* Tipo */}
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <TipoBadge tipo={evento.tipo} />
                  </td>

                  {/* Período */}
                  <td className="px-3 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarRange size={12} />
                      <span>
                        {formatFecha(evento.fecha_inicio)} – {formatFecha(evento.fecha_fin)}
                      </span>
                    </div>
                  </td>

                  {/* Slots */}
                  <td className="px-3 py-3 hidden lg:table-cell">
                    {evento.evento_slots.length > 0 ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Layers size={12} />
                        <span>{evento.evento_slots.length} slot{evento.evento_slots.length !== 1 ? "s" : ""}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/50">—</span>
                    )}
                  </td>

                  {/* Estado */}
                  <td className="px-3 py-3">
                    <EstadoBadge estado={evento.estado} />
                  </td>

                  {/* Acciones */}
                  <td className="px-3 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical size={14} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          className="text-xs gap-2"
                          onClick={() => { setEditTarget(evento); setFormOpen(true); }}
                        >
                          <Pencil size={12} />
                          Editar
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        {evento.estado !== "finalizado" && (
                          <DropdownMenuItem
                            className="text-xs gap-2"
                            onClick={() => setEstadoTarget({ evento, nuevoEstado: "finalizado" })}
                          >
                            <Clock3 size={12} />
                            Marcar finalizado
                          </DropdownMenuItem>
                        )}
                        {evento.estado !== "activo" && (
                          <DropdownMenuItem
                            className="text-xs gap-2"
                            onClick={() => setEstadoTarget({ evento, nuevoEstado: "activo" })}
                          >
                            <CheckCircle2 size={12} />
                            Marcar activo
                          </DropdownMenuItem>
                        )}
                        {evento.estado !== "cancelado" && (
                          <DropdownMenuItem
                            className="text-xs gap-2 text-destructive focus:text-destructive"
                            onClick={() => setEstadoTarget({ evento, nuevoEstado: "cancelado" })}
                          >
                            <XCircle size={12} />
                            Cancelar evento
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          className="text-xs gap-2 text-destructive focus:text-destructive"
                          onClick={() => setDeleteTarget(evento)}
                        >
                          <Trash2 size={12} />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Dialogs ── */}

      {/* Create / Edit */}
      <EventoFormDialog
        key={editTarget?.id ?? "new"}
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditTarget(null);
        }}
        evento={editTarget}
        canchas={canchas}
        turnos={turnos}
        onSaved={refresh}
      />

      {/* Change estado */}
      <ConfirmDialog
        open={!!estadoTarget}
        onOpenChange={(v) => { if (!v) setEstadoTarget(null); }}
        title={estadoTarget ? estadoConfirmLabels[estadoTarget.nuevoEstado] : ""}
        description={
          estadoTarget?.nuevoEstado === "cancelado"
            ? `¿Cancelar "${estadoTarget.evento.nombre}"? Esta acción notificará a los afectados.`
            : `¿Cambiar el estado de "${estadoTarget?.evento.nombre}"?`
        }
        onConfirm={handleCambioEstado}
        variant={estadoTarget?.nuevoEstado === "cancelado" ? "destructive" : "default"}
        confirmLabel={estadoTarget ? estadoConfirmLabels[estadoTarget.nuevoEstado] : ""}
        loading={estadoLoading}
      />

      {/* Delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}
        title="Eliminar evento"
        description={`¿Eliminar "${deleteTarget?.nombre}" permanentemente? Se borrarán todos sus slots.`}
        onConfirm={handleDelete}
        variant="destructive"
        confirmLabel="Eliminar"
        loading={deleteLoading}
      />
    </div>
  );
}
