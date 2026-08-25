"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Search, Unlock, MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type DatosPendientes = {
  cancha?: string;
  hora_inicio?: string;
  hora_fin?: string;
  fecha?: string;
  nombre?: string;
  apellido?: string;
} | null;

type Sesion = {
  telefono: string;
  estado: string;
  ultima_actividad: string;
  datos_pendientes: DatosPendientes;
  cliente_id: string | null;
};

type EstadoFiltro = "todos" | "activo" | "esperando" | "pausado_por_bot";

const ESTADO_LABELS: Record<string, string> = {
  activo: "Activo",
  esperando_opcion: "Esperando opción",
  esperando_seleccion_turno: "Eligiendo turno",
  esperando_confirmacion_turno: "Confirmando turno",
  pausado_por_bot: "Pausado",
};

const ESTADO_BADGE: Record<string, string> = {
  activo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  esperando_opcion: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  esperando_seleccion_turno: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  esperando_confirmacion_turno: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  pausado_por_bot: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default function SesionesBotClient({ sesiones: initialSesiones }: { sesiones: Sesion[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro>("todos");
  const [liberando, setLiberando] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    let resultado = initialSesiones;

    if (filtroEstado === "esperando") {
      resultado = resultado.filter((s) => s.estado.startsWith("esperando_"));
    } else if (filtroEstado !== "todos") {
      resultado = resultado.filter((s) => s.estado === filtroEstado);
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      resultado = resultado.filter((s) => s.telefono.includes(q));
    }

    return resultado;
  }, [initialSesiones, filtroEstado, busqueda]);

  async function liberar(telefono: string) {
    setLiberando(telefono);
    try {
      const res = await fetch(`/api/admin/sesiones-bot/${encodeURIComponent(telefono)}`, {
        method: "PATCH",
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Error al liberar sesión");
        return;
      }
      toast.success("Sesión liberada");
      router.refresh();
    } catch {
      toast.error("Error de red");
    } finally {
      setLiberando(null);
    }
  }

  const filtros: { key: EstadoFiltro; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "activo", label: "Activo" },
    { key: "esperando", label: "Esperando" },
    { key: "pausado_por_bot", label: "Pausado" },
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base font-semibold">Sesiones bot</h1>
          <span className="text-xs text-muted-foreground">
            {filtradas.length} sesión{filtradas.length !== 1 ? "es" : ""}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por teléfono o nombre..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>

          <div className="flex gap-1">
            {filtros.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFiltroEstado(key)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  filtroEstado === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtradas.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Sin sesiones
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Teléfono</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">Cliente</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Estado</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden md:table-cell">Datos pendientes</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden lg:table-cell">Última actividad</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtradas.map((s) => {
                const dp = s.datos_pendientes;
                const esPausada = s.estado === "pausado_por_bot";
                return (
                  <tr
                    key={s.telefono}
                    className="odd:bg-background even:bg-muted/30 hover:bg-accent/40 transition-colors"
                  >
                    <td className="px-3 py-2.5 font-mono">{s.telefono}</td>
                    <td className="px-3 py-2.5 hidden sm:table-cell font-mono text-muted-foreground">
                      {s.cliente_id ? s.cliente_id.slice(0, 8) + "…" : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "inline-block text-[10px] font-medium px-1.5 py-0.5 rounded",
                          ESTADO_BADGE[s.estado] ?? "bg-muted text-muted-foreground"
                        )}
                      >
                        {ESTADO_LABELS[s.estado] ?? s.estado}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground">
                      {dp?.cancha ? (
                        <span>
                          {dp.cancha}
                          {dp.hora_inicio && ` · ${dp.hora_inicio}`}
                          {dp.fecha && ` · ${dp.fecha}`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground">
                      {formatDistanceToNow(parseISO(s.ultima_actividad), {
                        addSuffix: true,
                        locale: es,
                      })}
                    </td>
                    <td className="px-3 py-2.5">
                      {/* Desktop */}
                      <div className="hidden sm:flex items-center justify-end">
                        {esPausada && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-green-600"
                            onClick={() => liberar(s.telefono)}
                            disabled={liberando === s.telefono}
                            title="Liberar sesión"
                          >
                            <Unlock size={12} />
                          </Button>
                        )}
                      </div>
                      {/* Mobile */}
                      <div className="flex sm:hidden items-center justify-end">
                        {esPausada ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreVertical size={13} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => liberar(s.telefono)}
                                disabled={liberando === s.telefono}
                              >
                                <Unlock size={13} className="mr-2 text-green-600" />
                                Liberar sesión
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="text-muted-foreground/40 px-1.5">—</span>
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
    </div>
  );
}
