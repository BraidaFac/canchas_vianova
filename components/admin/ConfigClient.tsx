"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Trash2, AlertTriangle, Pencil, Plus, Power, Settings } from "lucide-react";
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
import { ConfigFacturacionTab } from "@/components/admin/facturacion/ConfigFacturacionTab";

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
type Disponibilidad = { cancha_id: number; dia_semana: number; habilitada: boolean };
type Turno = { id: number; hora_inicio: string; hora_fin: string };
type BotConfig = { clave: string; valor: string; descripcion: string | null; updated_at: string };

export default function ConfigClient({
  canchas,
  precioReglas,
  disponibilidad: initialDisponibilidad,
  turnos: initialTurnos,
  botConfig,
  esSuperAdmin = false,
  esRoot = false,
  tiposCancha,
  espacios,
  cutoffHour,
}: {
  canchas: Cancha[];
  precioReglas: PrecioRegla[];
  disponibilidad: Disponibilidad[];
  turnos: Turno[];
  botConfig: BotConfig[];
  esSuperAdmin?: boolean;
  esRoot?: boolean;
  tiposCancha: TipoCancha[];
  espacios: Espacio[];
  cutoffHour: number;
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
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-[#133D34]" />
          <h1 className="text-sm font-semibold">Configuración</h1>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Tabs defaultValue="estructura" className="w-full">
          <div className="overflow-x-auto mb-4 scrollbar-hide">
            <TabsList className="w-max">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="estructura">Canchas y tipos</TabsTrigger>
              <TabsTrigger value="disponibilidad">Disponibilidad</TabsTrigger>
              <TabsTrigger value="turnos">Turnos</TabsTrigger>
              <TabsTrigger value="precios">Precios</TabsTrigger>
              {esRoot && <TabsTrigger value="bot">Bot n8n</TabsTrigger>}
              {esSuperAdmin && <TabsTrigger value="facturacion">Facturación</TabsTrigger>}
            </TabsList>
          </div>

          {/* GENERAL */}
          <TabsContent value="general">
            <GeneralTab cutoffHour={cutoffHour} />
          </TabsContent>

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

          {/* BOT N8N — solo root */}
          {esRoot && (
            <TabsContent value="bot">
              <BotConfigTab botConfig={botConfig} onSaved={() => router.refresh()} />
            </TabsContent>
          )}

          {/* FACTURACIÓN — solo superadmin */}
          {esSuperAdmin && (
            <TabsContent value="facturacion">
              <ConfigFacturacionTab />
            </TabsContent>
          )}

        </Tabs>
      </div>
    </div>
  );
}

// ─── General Tab ─────────────────────────────────────────────────────────────

function GeneralTab({ cutoffHour: initialCutoff }: { cutoffHour: number }) {
  const [cutoff, setCutoff] = useState(String(initialCutoff));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const val = parseInt(cutoff);
    if (isNaN(val) || val < 0 || val > 23) {
      toast.error("El horario debe ser entre 0 y 23");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/config/general", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caja_cutoff_hour: val }),
      });
      if (!res.ok) {
        const j = await res.json();
        toast.error(j.error ?? "Error al guardar");
        return;
      }
      toast.success("Configuración guardada");
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-md">
      <div>
        <h3 className="text-sm font-semibold mb-4">Configuración de caja</h3>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cutoff_hour" className="text-sm">Hora de corte de jornada</Label>
            <Input
              id="cutoff_hour"
              type="number"
              min="0"
              max="23"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              className="w-24"
            />
            <p className="text-xs text-muted-foreground">
              Pagos registrados antes de esta hora pertenecen a la jornada del día anterior.
              Default: 7 (07:00hs). Ideal para negocios nocturnos.
            </p>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
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
    hora_hasta: "23:59",
    dias_semana: null,
    precio: "",
    vigente_desde: hoy,
  });
  const [loading, setLoading] = useState(false);
  const [todosLosDias, setTodosLosDias] = useState(true);

  function openCreate(tipoCanchaId: number) {
    setEditingId(null);
    setTodosLosDias(true);
    setForm({
      tipo_cancha_id: tipoCanchaId,
      hora_desde: "08:00",
      hora_hasta: "23:59",
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
    if (!form.hora_desde || !form.hora_hasta || form.hora_desde >= form.hora_hasta) {
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
                        onClick={() => handleDelete(regla.id)}
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
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Hora inicio</label>
            <Input
              type="time"
              value={horaInicio}
              onChange={(e) => setHoraInicio(e.target.value)}
              className="h-8 w-28 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Hora fin</label>
            <Input
              type="time"
              value={horaFin}
              onChange={(e) => setHoraFin(e.target.value)}
              className="h-8 w-28 text-sm"
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

// ─── Bot n8n config ──────────────────────────────────────────────────────────

function BotConfigTab({
  botConfig: initialConfig,
  onSaved,
}: {
  botConfig: BotConfig[];
  onSaved: () => void;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [saving, setSaving] = useState<string | null>(null);

  async function updateConfig(clave: string, valor: string) {
    setSaving(clave);
    const res = await fetch("/api/admin/config/bot", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clave, valor }),
    });
    if (res.ok) {
      setConfig((prev) => prev.map((c) => (c.clave === clave ? { ...c, valor } : c)));
      toast.success("Configuración actualizada");
      onSaved();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Error al guardar");
    }
    setSaving(null);
  }

  if (config.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No hay configuraciones registradas en bot_config.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Configuraciones del bot de WhatsApp (n8n). Cambios se aplican en tiempo real.
      </p>
      {config.map((item) => {
        const isBoolean = item.valor === "true" || item.valor === "false";
        const isOn = item.valor === "true";
        return (
          <div
            key={item.clave}
            className="flex flex-col gap-2 px-4 py-3 rounded-lg border border-border bg-card sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{item.descripcion ?? item.clave}</p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.clave}</p>
            </div>
            {isBoolean ? (
              <button
                disabled={saving === item.clave}
                onClick={() => updateConfig(item.clave, isOn ? "false" : "true")}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isOn ? "bg-primary" : "bg-input"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${
                    isOn ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            ) : (
              <StringConfigInput
                value={item.valor}
                disabled={saving === item.clave}
                onSave={(val) => updateConfig(item.clave, val)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StringConfigInput({
  value: initialValue,
  disabled,
  onSave,
}: {
  value: string;
  disabled: boolean;
  onSave: (val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono text-muted-foreground">{initialValue}</span>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Editar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-full sm:w-36 text-sm font-mono"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={disabled}
          onClick={() => { onSave(value); setEditing(false); }}
        >
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setValue(initialValue); setEditing(false); }}>
          Cancelar
        </Button>
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

