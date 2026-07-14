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
import { ChevronDown, ChevronUp, Trash2, AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

type Cancha = {
  id: number;
  espacio_id: number;
  nombre: string;
  tipo: string;
  jugadores: number;
  activa: boolean;
};
type Precio = { id: number; cancha_id: number; precio: number; vigente_desde: string };
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
type BotConfig = { clave: string; valor: string; descripcion: string | null; updated_at: string };

export default function ConfigClient({
  canchas,
  precios,
  datosBancarios,
  disponibilidad: initialDisponibilidad,
  turnos: initialTurnos,
  botConfig,
  esSuperAdmin = false,
}: {
  canchas: Cancha[];
  precios: Precio[];
  datosBancarios: DatosBancarios[];
  disponibilidad: Disponibilidad[];
  turnos: Turno[];
  botConfig: BotConfig[];
  esSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const [disponibilidad, setDisponibilidad] = useState(initialDisponibilidad);

  function getPrecioActual(canchaId: number) {
    return precios.find((p) => p.cancha_id === canchaId);
  }

  function getPrecios(canchaId: number) {
    return precios.filter((p) => p.cancha_id === canchaId);
  }

  function getDisp(canchaId: number, dia: number) {
    return (
      disponibilidad.find((d) => d.cancha_id === canchaId && d.dia_semana === dia)?.habilitada ?? false
    );
  }

  // True if F8 cancha has a conflicting F5 enabled in same espacio for this day
  function hasConflict(cancha: Cancha, dia: number) {
    if (cancha.tipo !== "f8") return false;
    if (!getDisp(cancha.id, dia)) return false;
    const f5enEspacio = canchas.filter(
      (c) => c.espacio_id === cancha.espacio_id && c.tipo === "f5"
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
      if (!actual && cancha.tipo === "f5") {
        const f8enEspacio = canchas.filter(
          (c) => c.espacio_id === cancha.espacio_id && c.tipo === "f8"
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
        <Tabs defaultValue="disponibilidad" className="max-w-3xl">
          <div className="overflow-x-auto mb-4 scrollbar-hide">
            <TabsList className="w-max">
              <TabsTrigger value="disponibilidad">Disponibilidad</TabsTrigger>
              <TabsTrigger value="turnos">Turnos</TabsTrigger>
              <TabsTrigger value="precios">Precios</TabsTrigger>
              <TabsTrigger value="bancarios">Datos bancarios</TabsTrigger>
              {esSuperAdmin && <TabsTrigger value="bot">Bot n8n</TabsTrigger>}
            </TabsList>
          </div>

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
                          F{cancha.tipo === "f8" ? "8" : "5"}
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
            <div className="space-y-6">
              {/* Bulk update by tipo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <BulkPrecioCard tipo="f5" label="Fútbol 5" onSaved={() => router.refresh()} />
                <BulkPrecioCard tipo="f8" label="Fútbol 8" onSaved={() => router.refresh()} />
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-3">Por cancha</p>
                <div className="space-y-3">
                  {canchas.map((cancha) => (
                    <PrecioRow
                      key={cancha.id}
                      cancha={cancha}
                      precioActual={getPrecioActual(cancha.id)}
                      historial={getPrecios(cancha.id)}
                      onSaved={() => router.refresh()}
                    />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* BOT N8N — solo superadmin */}
          {esSuperAdmin && (
            <TabsContent value="bot">
              <BotConfigTab botConfig={botConfig} onSaved={() => router.refresh()} />
            </TabsContent>
          )}

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

// ─── Bulk precio por tipo ────────────────────────────────────────────────────

function BulkPrecioCard({
  tipo,
  label,
  onSaved,
}: {
  tipo: "f5" | "f8";
  label: string;
  onSaved: () => void;
}) {
  const [precio, setPrecio] = useState("");
  const [loading, setLoading] = useState(false);

  async function guardar() {
    const n = Number(precio);
    if (!precio || isNaN(n) || n <= 0) {
      toast.error("Ingresá un precio válido mayor a 0");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/config/precios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, precio: n }),
    });
    if (res.ok) {
      toast.success(`Precio actualizado para todas las canchas ${label}`);
      setPrecio("");
      onSaved();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Error al guardar");
    }
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-sm font-medium mb-2">Actualizar todas las {label}</p>
      <div className="flex flex-wrap gap-2">
        <Input
          type="number"
          placeholder="Nuevo precio"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          className="h-8 text-sm flex-1 min-w-0"
          min={1}
        />
        <Button size="sm" onClick={guardar} disabled={loading || !precio} className="shrink-0">
          Aplicar
        </Button>
      </div>
    </div>
  );
}

// ─── Precio por cancha ───────────────────────────────────────────────────────

function PrecioRow({
  cancha,
  precioActual,
  historial,
  onSaved,
}: {
  cancha: Cancha;
  precioActual?: { precio: number; vigente_desde: string };
  historial: Precio[];
  onSaved: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [precio, setPrecio] = useState(String(precioActual?.precio ?? ""));
  const [loading, setLoading] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);

  async function guardar() {
    const n = Number(precio);
    if (!precio || isNaN(n) || n <= 0) {
      toast.error("Precio debe ser mayor a 0");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/admin/config/precios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cancha_id: cancha.id, precio: n }),
    });
    if (res.ok) {
      toast.success("Precio actualizado");
      setEditando(false);
      onSaved();
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error ?? "Error al guardar");
    }
    setLoading(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <span className="font-medium text-sm">{cancha.nombre}</span>
          <span className="text-xs text-muted-foreground ml-2">
            F{cancha.tipo === "f8" ? "8" : "5"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editando ? (
            <>
              <Input
                type="number"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="h-8 w-24 text-sm"
                min={1}
              />
              <Button size="sm" onClick={guardar} disabled={loading}>
                Guardar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm font-mono">
                ${precioActual ? Number(precioActual.precio).toLocaleString("es-AR") : "—"}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setEditando(true)}>
                Editar
              </Button>
              {historial.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-muted-foreground"
                  onClick={() => setVerHistorial(!verHistorial)}
                >
                  Historial
                  {verHistorial ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {verHistorial && historial.length > 1 && (
        <div className="border-t border-border px-4 py-2 space-y-1 bg-muted/30">
          {historial.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {format(parseISO(p.vigente_desde), "dd/MM/yyyy")}
              </span>
              <span className="font-mono">${Number(p.precio).toLocaleString("es-AR")}</span>
            </div>
          ))}
        </div>
      )}
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
