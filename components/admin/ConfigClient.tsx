"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2, AlertTriangle, Pencil, Plus, Power } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PrecioRegla, TipoCancha } from "@/lib/types";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type Cancha = {
  id: number;
  espacio_id: number;
  nombre: string;
  tipo_cancha_id: number;
  tipo_cancha?: { id: number; nombre: string; clave: string | null };
  espacios_fisicos?: { id: number; nombre: string };
  jugadores: number;
  activa: boolean;
};
type Espacio = { id: number; nombre: string; activo: boolean };
type DatosBancarios = {
  id: number;
  nombre_cuenta: string;
  alias: string;
  cbu: string;
  vigente_desde: string;
  activo: boolean;
};
type Disponibilidad = { cancha_id: number; dia_semana: number; habilitada: boolean };
type Turno = { id: number; hora_inicio: string; hora_fin: string };
export default function ConfigClient({
  canchas,
  precioReglas,
  datosBancarios,
  disponibilidad: initialDisponibilidad,
  turnos: initialTurnos,
  tiposCancha,
  espacios,
}: {
  canchas: Cancha[];
  precioReglas: PrecioRegla[];
  datosBancarios: DatosBancarios[];
  disponibilidad: Disponibilidad[];
  turnos: Turno[];
  tiposCancha: TipoCancha[];
  espacios: Espacio[];
}) {
  const router = useRouter();
  const [disponibilidad, setDisponibilidad] = useState(initialDisponibilidad);

  function getDisp(canchaId: number, dia: number) {
    return (
      disponibilidad.find((d) => d.cancha_id === canchaId && d.dia_semana === dia)?.habilitada ?? false
    );
  }

  // True if F8 cancha has a conflicting F5 enabled in same espacio for this day
  function hasConflict(cancha: Cancha, dia: number) {
    if (cancha.tipo_cancha?.clave !== "f8") return false;
    if (!getDisp(cancha.id, dia)) return false;
    const f5enEspacio = canchas.filter(
      (c) => c.espacio_id === cancha.espacio_id && c.tipo_cancha?.clave === "f5"
    );
    return f5enEspacio.some((c) => getDisp(c.id, dia));
  }

  async function toggleDisponibilidad(cancha: Cancha, dia: number, actual: boolean) {
    const res = await fetch("/api/admin/config/disponibilidad", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancha_id: cancha.id, dia_semana: dia, habilitada: !actual }),
    });
    if (res.ok) {
      // Optimistically update local state
      const next = [...disponibilidad];
      const idx = next.findIndex((d) => d.cancha_id === cancha.id && d.dia_semana === dia);
      if (idx >= 0) {
        next[idx] = { ...next[idx], habilitada: !actual };
      } else {
        next.push({ cancha_id: cancha.id, dia_semana: dia, habilitada: !actual });
      }

      // If enabling F5, also disable F8 in same espacio locally
      if (!actual && cancha.tipo_cancha?.clave === "f5") {
        const f8enEspacio = canchas.filter(
          (c) => c.espacio_id === cancha.espacio_id && c.tipo_cancha?.clave === "f8"
        );
        for (const f8 of f8enEspacio) {
          const i = next.findIndex((d) => d.cancha_id === f8.id && d.dia_semana === dia);
          if (i >= 0) {
            next[i] = { ...next[i], habilitada: false };
          } else {
            next.push({ cancha_id: f8.id, dia_semana: dia, habilitada: false });
          }
        }
      }

      setDisponibilidad(next);
      toast.success("Disponibilidad actualizada");
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Error al actualizar");
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card">
        <h1 className="text-base font-semibold">Configuración</h1>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="estructura" className="max-w-3xl">
          <div className="overflow-x-auto mb-4 scrollbar-hide">
            <TabsList className="w-max">
              <TabsTrigger value="estructura">Canchas y tipos</TabsTrigger>
              <TabsTrigger value="disponibilidad">Disponibilidad</TabsTrigger>
              <TabsTrigger value="turnos">Turnos</TabsTrigger>
              <TabsTrigger value="precios">Precios</TabsTrigger>
              <TabsTrigger value="bancarios">Datos bancarios</TabsTrigger>
            </TabsList>
          </div>

          {/* ESTRUCTURA */}
          <TabsContent value="estructura">
            <EstructuraTab
              tiposCancha={tiposCancha}
              espacios={espacios}
              canchas={canchas}
              onSaved={() => router.refresh()}
            />
          </TabsContent>

          {/* DISPONIBILIDAD */}
          <TabsContent value="disponibilidad">
            <p className="text-sm text-muted-foreground mb-4">
              Habilitá o deshabilitá canchas por día de la semana. Al habilitar una F5, la F8 del
              mismo espacio se deshabilita automáticamente.
            </p>
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground w-32">
                      Cancha
                    </th>
                    {DIAS.map((d) => (
                      <th
                        key={d}
                        className="px-2 py-2 font-medium text-muted-foreground text-center w-12"
                      >
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {canchas.map((cancha) => (
                    <tr key={cancha.id}>
                      <td className="px-3 py-2.5">
                        <div className="font-medium">{cancha.nombre}</div>
                        <div className="text-xs text-muted-foreground">
                          {cancha.tipo_cancha?.nombre ?? "—"}
                        </div>
                      </td>
                      {[0, 1, 2, 3, 4, 5, 6].map((dia) => {
                        const habilitada = getDisp(cancha.id, dia);
                        const conflict = hasConflict(cancha, dia);
                        return (
                          <td key={dia} className="px-2 py-2.5 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => toggleDisponibilidad(cancha, dia, habilitada)}
                                  className={`relative w-8 h-8 rounded-md text-xs font-medium transition-colors ${
                                    conflict
                                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300"
                                      : habilitada
                                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  {conflict ? (
                                    <AlertTriangle size={11} className="mx-auto" />
                                  ) : habilitada ? (
                                    "✓"
                                  ) : (
                                    "—"
                                  )}
                                </button>
                              </TooltipTrigger>
                              {conflict && (
                                <TooltipContent>
                                  Conflicto: hay una F5 habilitada en el mismo espacio
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* TURNOS */}
          <TabsContent value="turnos">
            <TurnosTab initialTurnos={initialTurnos} onSaved={() => router.refresh()} />
          </TabsContent>

          {/* PRECIOS */}
          <TabsContent value="precios">
            <PrecioReglasTab
              precioReglas={precioReglas}
              canchas={canchas}
              tiposCancha={tiposCancha}
              onSaved={() => router.refresh()}
            />
          </TabsContent>

          {/* DATOS BANCARIOS */}
          <TabsContent value="bancarios">
            <div className="space-y-4">
              <DatosBancariosForm onSaved={() => router.refresh()} />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Historial</p>
                {datosBancarios.map((db) => (
                  <div
                    key={db.id}
                    className="px-4 py-3 rounded-lg border border-border bg-card text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{db.nombre_cuenta}</span>
                        <span className="mx-2 text-muted-foreground">·</span>
                        <span className="font-mono">{db.alias}</span>
                      </div>
                      {db.activo && (
                        <Badge variant="default" className="text-[10px]">
                          Activo
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      CBU: {db.cbu} · Desde{" "}
                      {format(parseISO(db.vigente_desde), "dd/MM/yyyy")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Precio Reglas Tab ───────────────────────────────────────────────────────

const DIAS_NOMBRES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function formatDias(dias: number[] | null): string {
  if (!dias || dias.length === 0) return "Todos los días";
  return dias.map(d => DIAS_NOMBRES[d]).join(", ");
}

type ReglaForm = {
  tipo_cancha_id: number;
  hora_desde: string;
  hora_hasta: string;
  dias_semana: number[] | null;
  precio: string;
  vigente_desde: string;
};

function PrecioReglasTab({
  precioReglas,
  canchas,
  tiposCancha,
  onSaved,
}: {
  precioReglas: PrecioRegla[];
  canchas: Cancha[];
  tiposCancha: TipoCancha[];
  onSaved: () => void;
}) {
  const hoy = new Date().toISOString().slice(0, 10);

  const tipos = tiposCancha.filter(tc => tc.activo);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ReglaForm>({
    tipo_cancha_id: tipos[0]?.id ?? 0,
    hora_desde: "08:00",
    hora_hasta: "00:00",
    dias_semana: null,
    precio: "",
    vigente_desde: hoy,
  });
  const [loading, setLoading] = useState(false);
  const [todosLosDias, setTodosLosDias] = useState(true);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  function openCreate(tipoCanchaId: number) {
    setEditingId(null);
    setTodosLosDias(true);
    setForm({
      tipo_cancha_id: tipoCanchaId,
      hora_desde: "08:00",
      hora_hasta: "00:00",
      dias_semana: null,
      precio: "",
      vigente_desde: hoy,
    });
    setDialogOpen(true);
  }

  function openEdit(regla: PrecioRegla) {
    setEditingId(regla.id);
    const todosD = regla.dias_semana === null || regla.dias_semana.length === 0;
    setTodosLosDias(todosD);
    setForm({
      tipo_cancha_id: regla.tipo_cancha_id,
      hora_desde: regla.hora_desde,
      hora_hasta: regla.hora_hasta,
      dias_semana: regla.dias_semana,
      precio: String(regla.precio),
      vigente_desde: regla.vigente_desde,
    });
    setDialogOpen(true);
  }

  function toggleDia(dia: number) {
    const current = form.dias_semana ?? [];
    const next = current.includes(dia)
      ? current.filter(d => d !== dia)
      : [...current, dia].sort((a, b) => a - b);
    setForm(f => ({ ...f, dias_semana: next.length > 0 ? next : null }));
  }

  function handleTodosLosDiasChange(checked: boolean) {
    setTodosLosDias(checked);
    if (checked) {
      setForm(f => ({ ...f, dias_semana: null }));
    } else {
      setForm(f => ({ ...f, dias_semana: [] }));
    }
  }

  async function handleSave() {
    if (!form.precio || Number(form.precio) <= 0) {
      toast.error("El precio debe ser mayor a 0");
      return;
    }
    if (!form.hora_desde || !form.hora_hasta || (form.hora_hasta !== "00:00" && form.hora_desde >= form.hora_hasta)) {
      toast.error("hora_desde debe ser anterior a hora_hasta");
      return;
    }
    setLoading(true);
    try {
      const body = {
        tipo_cancha_id: form.tipo_cancha_id,
        hora_desde: form.hora_desde,
        hora_hasta: form.hora_hasta,
        dias_semana: todosLosDias ? null : (form.dias_semana?.length ? form.dias_semana : null),
        precio: Number(form.precio),
        vigente_desde: form.vigente_desde || hoy,
      };

      let res: Response;
      if (editingId !== null) {
        res = await fetch(`/api/admin/config/precio-reglas/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } else {
        res = await fetch("/api/admin/config/precio-reglas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      }

      if (res.ok) {
        toast.success(editingId !== null ? "Regla actualizada" : "Regla creada");
        setDialogOpen(false);
        onSaved();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Error al guardar");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/admin/config/precio-reglas/${id}`, { method: "DELETE" });
    setPendingDeleteId(null);
    if (res.ok) {
      toast.success("Regla eliminada");
      onSaved();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Error al eliminar");
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Definí precios por franja horaria y tipo de cancha. Las reglas con días específicos tienen
        prioridad sobre las que aplican a todos los días.
      </p>

      {tipos.map(tc => {
        const reglas = precioReglas.filter(r => r.tipo_cancha_id === tc.id);
        return (
          <div key={tc.id} className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold">{tc.nombre}</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-xs"
                onClick={() => openCreate(tc.id)}
              >
                <Plus size={12} />
                Agregar regla
              </Button>
            </div>

            {reglas.length === 0 ? (
              <p className="px-4 py-3 text-xs text-muted-foreground">Sin reglas de precio configuradas.</p>
            ) : (
              <div className="divide-y divide-border">
                {reglas.map(regla => (
                  <div key={regla.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
                      <span className="font-mono text-xs whitespace-nowrap">
                        {regla.hora_desde} – {regla.hora_hasta}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {formatDias(regla.dias_semana)}
                      </span>
                      <span className="font-medium">
                        ${Number(regla.precio).toLocaleString("es-AR")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        desde {format(parseISO(regla.vigente_desde), "dd/MM/yyyy")}
                      </span>
                      {!regla.activa && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">inactiva</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(regla)}
                      >
                        <Pencil size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setPendingDeleteId(regla.id)}
                      >
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <Dialog open={pendingDeleteId !== null} onOpenChange={(v) => { if (!v) setPendingDeleteId(null); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar regla</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta acción no se puede deshacer. ¿Querés eliminar esta regla de precio?</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" size="sm" onClick={() => pendingDeleteId !== null && handleDelete(pendingDeleteId)}>Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Editar regla" : "Nueva regla de precio"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Tipo cancha — solo en crear */}
            {editingId === null && tipos.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tipo de cancha</label>
                <Select
                  value={String(form.tipo_cancha_id)}
                  onValueChange={v => setForm(f => ({ ...f, tipo_cancha_id: Number(v) }))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Seleccioná un tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tipos.map(tc => (
                      <SelectItem key={tc.id} value={String(tc.id)}>{tc.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Horario */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Hora desde</label>
                <TimePicker
                  value={form.hora_desde}
                  onChange={v => setForm(f => ({ ...f, hora_desde: v }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Hora hasta</label>
                <TimePicker
                  value={form.hora_hasta}
                  onChange={v => setForm(f => ({ ...f, hora_hasta: v }))}
                  midnightAtEnd
                />
              </div>
            </div>

            {/* Días */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Días</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={todosLosDias}
                  onChange={e => handleTodosLosDiasChange(e.target.checked)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span className="text-sm">Todos los días</span>
              </label>
              {!todosLosDias && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {DIAS_NOMBRES.map((nombre, idx) => (
                    <label key={idx} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(form.dias_semana ?? []).includes(idx)}
                        onChange={() => toggleDia(idx)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      <span className="text-sm">{nombre}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Precio */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Precio</label>
              <Input
                type="number"
                min={1}
                step="any"
                placeholder="Ej: 15000"
                value={form.precio}
                onChange={e => setForm(f => ({ ...f, precio: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>

            {/* Vigente desde */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Vigente desde</label>
              <DatePicker
                value={form.vigente_desde}
                onChange={v => setForm(f => ({ ...f, vigente_desde: v }))}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={loading}>
              {loading ? "Guardando..." : editingId !== null ? "Guardar cambios" : "Crear regla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Turnos CRUD ─────────────────────────────────────────────────────────────

function TurnosTab({
  initialTurnos,
  onSaved,
}: {
  initialTurnos: Turno[];
  onSaved: () => void;
}) {
  const [turnos, setTurnos] = useState(initialTurnos);
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [loading, setLoading] = useState(false);

  function fmt(t: string) {
    return t.slice(0, 5);
  }

  async function agregar() {
    if (!horaInicio || !horaFin) {
      toast.error("Completá ambas horas");
      return;
    }
    if (horaInicio >= horaFin && horaFin !== "00:00") {
      toast.error("La hora de inicio debe ser anterior a la de fin");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/turnos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hora_inicio: horaInicio, hora_fin: horaFin }),
    });
    if (res.ok) {
      const nuevo = await res.json();
      setTurnos((prev) => [...prev, nuevo].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio)));
      setHoraInicio("");
      setHoraFin("");
      toast.success("Turno agregado");
      onSaved();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Error al agregar");
    }
    setLoading(false);
  }

  async function eliminar(id: number) {
    const res = await fetch(`/api/admin/turnos/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTurnos((prev) => prev.filter((t) => t.id !== id));
      toast.success("Turno eliminado");
      onSaved();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Error al eliminar");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Gestioná los bloques horarios disponibles para reservas.
      </p>

      {/* Agregar turno */}
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm font-medium mb-3">Agregar turno</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 w-32">
            <label className="text-xs text-muted-foreground">Hora inicio</label>
            <TimePicker
              value={horaInicio}
              onChange={setHoraInicio}
              className="h-8"
            />
          </div>
          <div className="space-y-1.5 w-32">
            <label className="text-xs text-muted-foreground">Hora fin</label>
            <TimePicker
              value={horaFin}
              onChange={setHoraFin}
              className="h-8"
              midnightAtEnd
            />
          </div>
          <Button size="sm" onClick={agregar} disabled={loading}>
            Agregar
          </Button>
        </div>
      </div>

      {/* Lista de turnos */}
      <div className="space-y-1.5">
        {turnos.map((turno) => (
          <div
            key={turno.id}
            className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-border bg-card"
          >
            <span className="text-sm font-mono font-medium">
              {fmt(turno.hora_inicio)} – {fmt(turno.hora_fin)}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => eliminar(turno.id)}
                >
                  <Trash2 size={13} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Eliminar turno</TooltipContent>
            </Tooltip>
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Estructura Tab ──────────────────────────────────────────────────────────

function EstructuraTab({
  tiposCancha,
  espacios,
  canchas,
  onSaved,
}: {
  tiposCancha: TipoCancha[];
  espacios: Espacio[];
  canchas: Cancha[];
  onSaved: () => void;
}) {
  return (
    <div className="space-y-8">
      <TiposCanchaSection tiposCancha={tiposCancha} onSaved={onSaved} />
      <EspaciosSection espacios={espacios} onSaved={onSaved} />
      <CanchasSection canchas={canchas} tiposCancha={tiposCancha} espacios={espacios} onSaved={onSaved} />
    </div>
  );
}

// ── Tipos de cancha ──────────────────────────────────────────────────────────

type TipoCanchaForm = { nombre: string; jugadores: string; clave: string };

function TiposCanchaSection({ tiposCancha, onSaved }: { tiposCancha: TipoCancha[]; onSaved: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TipoCancha | null>(null);
  const [form, setForm] = useState<TipoCanchaForm>({ nombre: "", jugadores: "", clave: "" });
  const [loading, setLoading] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm({ nombre: "", jugadores: "", clave: "" });
    setDialogOpen(true);
  }

  function openEdit(tc: TipoCancha) {
    setEditing(tc);
    setForm({ nombre: tc.nombre, jugadores: String(tc.jugadores), clave: tc.clave ?? "" });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
    if (!form.jugadores || Number(form.jugadores) <= 0) { toast.error("Jugadores debe ser mayor a 0"); return; }
    setLoading(true);
    try {
      const body = { nombre: form.nombre.trim(), jugadores: Number(form.jugadores), clave: form.clave.trim() || null };
      const res = editing
        ? await fetch(`/api/admin/config/tipos-cancha/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/admin/config/tipos-cancha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        toast.success(editing ? "Tipo actualizado" : "Tipo creado");
        setDialogOpen(false);
        onSaved();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Error al guardar");
      }
    } finally { setLoading(false); }
  }

  async function toggleActivo(tc: TipoCancha) {
    const res = await fetch(`/api/admin/config/tipos-cancha/${tc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !tc.activo }),
    });
    if (res.ok) { toast.success("Estado actualizado"); onSaved(); }
    else { const json = await res.json().catch(() => ({})); toast.error(json.error ?? "Error"); }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
        <h2 className="text-sm font-semibold">Tipos de cancha</h2>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={openCreate}>
          <Plus size={13} /> Nuevo tipo
        </Button>
      </div>
      {tiposCancha.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Plus size={20} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sin tipos configurados.</p>
          <Button size="sm" variant="ghost" className="text-xs" onClick={openCreate}>Crear el primero</Button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {tiposCancha.map((tc) => (
            <div key={tc.id} className="flex items-center h-11 px-4 gap-3">
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <span className={`text-sm font-medium${!tc.activo ? " text-muted-foreground" : ""}`}>{tc.nombre}</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">{tc.jugadores} jug.</span>
                {tc.clave && <span className="font-mono text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded hidden sm:inline">{tc.clave}</span>}
              </div>
              <Badge
                variant={tc.activo ? "default" : "outline"}
                className="text-[11px] px-2 py-0.5 shrink-0"
              >
                {tc.activo ? "Activo" : "Inactivo"}
              </Badge>
              <div className="flex items-center gap-0.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(tc)}>
                      <Pencil size={13} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editar</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${tc.activo ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-primary"}`}
                      onClick={() => toggleActivo(tc)}
                    >
                      <Power size={13} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{tc.activo ? "Desactivar" : "Activar"}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar tipo de cancha" : "Nuevo tipo de cancha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="h-9 text-sm" placeholder="Ej: Fútbol 5" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Jugadores por equipo</label>
              <Input type="number" min={1} value={form.jugadores} onChange={e => setForm(f => ({ ...f, jugadores: e.target.value }))} className="h-9 text-sm" placeholder="Ej: 10" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Clave interna <span className="font-normal">(opcional)</span></label>
              <Input value={form.clave} onChange={e => setForm(f => ({ ...f, clave: e.target.value }))} className="h-9 text-sm font-mono" placeholder="Ej: f5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={loading}>{loading ? "Guardando..." : editing ? "Guardar cambios" : "Crear tipo"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Espacios ─────────────────────────────────────────────────────────────────

function EspaciosSection({ espacios, onSaved }: { espacios: Espacio[]; onSaved: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Espacio | null>(null);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);

  function openCreate() { setEditing(null); setNombre(""); setDialogOpen(true); }
  function openEdit(e: Espacio) { setEditing(e); setNombre(e.nombre); setDialogOpen(true); }

  async function handleSave() {
    if (!nombre.trim()) { toast.error("El nombre es requerido"); return; }
    setLoading(true);
    try {
      const res = editing
        ? await fetch(`/api/admin/config/espacios/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nombre.trim() }) })
        : await fetch("/api/admin/config/espacios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nombre.trim() }) });
      if (res.ok) {
        toast.success(editing ? "Espacio actualizado" : "Espacio creado");
        setDialogOpen(false);
        onSaved();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Error al guardar");
      }
    } finally { setLoading(false); }
  }

  async function toggleActivo(e: Espacio) {
    const res = await fetch(`/api/admin/config/espacios/${e.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !e.activo }),
    });
    if (res.ok) { toast.success("Estado actualizado"); onSaved(); }
    else { const json = await res.json().catch(() => ({})); toast.error(json.error ?? "Error"); }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
        <h2 className="text-sm font-semibold">Espacios físicos</h2>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={openCreate}>
          <Plus size={13} /> Nuevo espacio
        </Button>
      </div>
      {espacios.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Plus size={20} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sin espacios configurados.</p>
          <Button size="sm" variant="ghost" className="text-xs" onClick={openCreate}>Crear el primero</Button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {espacios.map((esp) => (
            <div key={esp.id} className="flex items-center h-11 px-4 gap-3">
              <span className={`flex-1 text-sm font-medium${!esp.activo ? " text-muted-foreground" : ""}`}>{esp.nombre}</span>
              <Badge
                variant={esp.activo ? "default" : "outline"}
                className="text-[11px] px-2 py-0.5 shrink-0"
              >
                {esp.activo ? "Activo" : "Inactivo"}
              </Badge>
              <div className="flex items-center gap-0.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(esp)}>
                      <Pencil size={13} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editar</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${esp.activo ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-primary"}`}
                      onClick={() => toggleActivo(esp)}
                    >
                      <Power size={13} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{esp.activo ? "Desactivar" : "Activar"}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar espacio" : "Nuevo espacio físico"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <Input value={nombre} onChange={e => setNombre(e.target.value)} className="h-9 text-sm" placeholder="Ej: Espacio A" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={loading}>{loading ? "Guardando..." : editing ? "Guardar cambios" : "Crear espacio"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Canchas ──────────────────────────────────────────────────────────────────

type CanchaForm = { nombre: string; espacio_id: string; tipo_cancha_id: string; jugadores: string };

function CanchasSection({
  canchas,
  tiposCancha,
  espacios,
  onSaved,
}: {
  canchas: Cancha[];
  tiposCancha: TipoCancha[];
  espacios: Espacio[];
  onSaved: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Cancha | null>(null);
  const [form, setForm] = useState<CanchaForm>({ nombre: "", espacio_id: "", tipo_cancha_id: "", jugadores: "" });
  const [loading, setLoading] = useState(false);

  function openCreate() {
    setEditing(null);
    const defaultTc = tiposCancha[0];
    setForm({ nombre: "", espacio_id: String(espacios[0]?.id ?? ""), tipo_cancha_id: String(defaultTc?.id ?? ""), jugadores: String(defaultTc?.jugadores ?? "") });
    setDialogOpen(true);
  }

  function openEdit(c: Cancha) {
    setEditing(c);
    setForm({ nombre: c.nombre, espacio_id: String(c.espacio_id), tipo_cancha_id: String(c.tipo_cancha_id), jugadores: String(c.jugadores) });
    setDialogOpen(true);
  }

  function handleTipoChange(tipoId: string) {
    const tc = tiposCancha.find(t => String(t.id) === tipoId);
    setForm(f => ({ ...f, tipo_cancha_id: tipoId, jugadores: tc ? String(tc.jugadores) : f.jugadores }));
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast.error("El nombre es requerido"); return; }
    if (!form.espacio_id) { toast.error("El espacio es requerido"); return; }
    if (!form.tipo_cancha_id) { toast.error("El tipo de cancha es requerido"); return; }
    setLoading(true);
    try {
      const body = { nombre: form.nombre.trim(), espacio_id: Number(form.espacio_id), tipo_cancha_id: Number(form.tipo_cancha_id), jugadores: Number(form.jugadores) || undefined };
      const res = editing
        ? await fetch(`/api/admin/config/canchas/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/admin/config/canchas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        toast.success(editing ? "Cancha actualizada" : "Cancha creada");
        setDialogOpen(false);
        onSaved();
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Error al guardar");
      }
    } finally { setLoading(false); }
  }

  async function toggleActiva(c: Cancha) {
    const res = await fetch(`/api/admin/config/canchas/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !c.activa }),
    });
    if (res.ok) { toast.success("Estado actualizado"); onSaved(); }
    else { const json = await res.json().catch(() => ({})); toast.error(json.error ?? "Error"); }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
        <h2 className="text-sm font-semibold">Canchas</h2>
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={openCreate}>
          <Plus size={13} /> Nueva cancha
        </Button>
      </div>
      {canchas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Plus size={20} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Sin canchas configuradas.</p>
          <Button size="sm" variant="ghost" className="text-xs" onClick={openCreate}>Crear la primera</Button>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {canchas.map((c) => (
            <div key={c.id} className="flex items-center h-11 px-4 gap-3">
              <div className="flex-1 min-w-0 flex items-center gap-3">
                <span className={`text-sm font-medium truncate${!c.activa ? " text-muted-foreground" : ""}`}>{c.nombre}</span>
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                  {c.espacios_fisicos?.nombre ?? `Espacio ${c.espacio_id}`}
                </span>
                <span className="text-xs text-muted-foreground truncate hidden md:inline">
                  {c.tipo_cancha?.nombre ?? `Tipo ${c.tipo_cancha_id}`}
                </span>
              </div>
              <Badge
                variant={c.activa ? "default" : "outline"}
                className="text-[11px] px-2 py-0.5 shrink-0"
              >
                {c.activa ? "Activa" : "Inactiva"}
              </Badge>
              <div className="flex items-center gap-0.5 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                      <Pencil size={13} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editar</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 ${c.activa ? "text-muted-foreground hover:text-destructive" : "text-muted-foreground hover:text-primary"}`}
                      onClick={() => toggleActiva(c)}
                    >
                      <Power size={13} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{c.activa ? "Desactivar" : "Activar"}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cancha" : "Nueva cancha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nombre</label>
              <Input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} className="h-9 text-sm" placeholder="Ej: Cancha 1" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Espacio físico</label>
              <Select value={form.espacio_id} onValueChange={v => setForm(f => ({ ...f, espacio_id: v }))}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccioná un espacio" />
                </SelectTrigger>
                <SelectContent>
                  {espacios.map(esp => (
                    <SelectItem key={esp.id} value={String(esp.id)}>{esp.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tipo de cancha</label>
              <Select value={form.tipo_cancha_id} onValueChange={handleTipoChange}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Seleccioná un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {tiposCancha.map(tc => (
                    <SelectItem key={tc.id} value={String(tc.id)}>{tc.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Jugadores <span className="font-normal">(pre-rellena del tipo)</span></label>
              <Input type="number" min={1} value={form.jugadores} onChange={e => setForm(f => ({ ...f, jugadores: e.target.value }))} className="h-9 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={loading}>{loading ? "Guardando..." : editing ? "Guardar cambios" : "Crear cancha"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Datos bancarios form ────────────────────────────────────────────────────

function DatosBancariosForm({ onSaved }: { onSaved: () => void }) {
  const { register, handleSubmit, reset } = useForm<{
    nombre_cuenta: string;
    alias: string;
    cbu: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function onSubmit(data: { nombre_cuenta: string; alias: string; cbu: string }) {
    setLoading(true);
    const res = await fetch("/api/admin/config/bancarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Datos bancarios actualizados");
      reset();
      setOpen(false);
      onSaved();
    } else {
      toast.error("Error al guardar");
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Agregar nuevos datos bancarios
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="p-4 rounded-lg border border-border bg-card space-y-3"
    >
      <p className="text-sm font-medium">Nuevos datos bancarios</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-muted-foreground">Nombre cuenta</label>
          <Input {...register("nombre_cuenta", { required: true })} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Alias</label>
          <Input {...register("alias", { required: true })} className="mt-1 h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">CBU</label>
          <Input
            {...register("cbu", { required: true })}
            className="mt-1 h-8 text-sm font-mono"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          Guardar
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
