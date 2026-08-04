"use client";

import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Landmark, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { TabLoader } from "@/components/ui/tab-loader";
import type { JornadaOperativa, SesionCaja, EstadoCajaResponse } from "@/lib/caja/types";
import AbrirCajaDialog from "./AbrirCajaDialog";
import CerrarCajaDialog from "./CerrarCajaDialog";
import CajaDetalleModal from "./CajaDetalleModal";

type JornadaConSesion = JornadaOperativa & {
  sesion: SesionCaja | SesionCaja[] | null;
};

function EstadoBadge({ estado }: { estado: string }) {
  if (estado === "abierta") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-100 text-emerald-700 border-emerald-200">
        Abierta
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-slate-100 text-slate-500 border-slate-200">
      Cerrada
    </span>
  );
}

export default function CajaClient() {
  const [estadoCaja, setEstadoCaja] = useState<EstadoCajaResponse | null>(null);
  const [historial, setHistorial] = useState<JornadaConSesion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [modalAbrir, setModalAbrir] = useState(false);
  const [modalCerrar, setModalCerrar] = useState(false);
  const [detalleJornada, setDetalleJornada] = useState<string | null>(null);

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  const fetchEstado = useCallback(async () => {
    const res = await fetch("/api/admin/caja/estado");
    if (res.ok) setEstadoCaja(await res.json());
  }, []);

  const fetchHistorial = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      const res = await fetch(`/api/admin/caja/historial?${params}`);
      const json = await res.json();
      setHistorial(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Error al cargar historial");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchEstado();
    fetchHistorial();
  }, [fetchEstado, fetchHistorial]);

  function onSuccess() {
    setModalAbrir(false);
    setModalCerrar(false);
    fetchEstado();
    fetchHistorial();
  }

  const sesionActual = estadoCaja?.sesion
    ? (Array.isArray(estadoCaja.sesion) ? estadoCaja.sesion[0] : estadoCaja.sesion)
    : null;

  // jornada_vencida = sesión abierta de jornada anterior — también puede cerrarse
  const cajaAbierta = estadoCaja?.code === "ok" || estadoCaja?.code === "jornada_vencida";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Landmark size={16} className="text-[#133D34]" />
            <h1 className="text-sm font-semibold">Caja</h1>
            {cajaAbierta && sesionActual && (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 ring-1 ring-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Abierta
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(sesionActual.abierta_at), "HH:mm", { locale: es })}hs · ${Number(sesionActual.monto_apertura).toLocaleString("es-AR")} inicial
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={() => { fetchEstado(); fetchHistorial(); }}
              disabled={loading}
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              Actualizar
            </Button>
            {cajaAbierta ? (
              <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => setModalCerrar(true)}>
                Cerrar caja
              </Button>
            ) : (
              <Button size="sm" variant="default" className="h-8 text-xs" onClick={() => setModalAbrir(true)}>
                Abrir caja
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla historial */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center h-9 px-4 gap-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
            <div className="w-28 shrink-0">Fecha jornada</div>
            <div className="w-24 shrink-0">Apertura</div>
            <div className="w-24 shrink-0">Cierre</div>
            <div className="w-28 shrink-0 hidden sm:block">Ef. inicial</div>
            <div className="w-28 shrink-0 hidden sm:block">Ef. cierre</div>
            <div className="flex-1" />
            <div className="w-24 shrink-0">Estado</div>
            <div className="w-6 shrink-0" />
          </div>

          {loading && historial.length === 0 ? (
            <TabLoader />
          ) : historial.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">Sin jornadas cerradas.</p>
          ) : (
            <div className="divide-y divide-border">
              {historial.map((j) => {
                const ses = j.sesion
                  ? (Array.isArray(j.sesion) ? j.sesion[0] : j.sesion)
                  : null;
                return (
                  <div
                    key={j.id}
                    className="flex items-center h-12 px-4 gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setDetalleJornada(j.id)}
                  >
                    <div className="w-28 shrink-0 text-xs font-medium">
                      {format(parseISO(j.fecha_jornada + "T12:00:00"), "dd/MM/yyyy")}
                    </div>
                    <div className="w-24 shrink-0 text-xs text-muted-foreground font-mono">
                      {ses ? format(parseISO(ses.abierta_at), "HH:mm") : "—"}
                    </div>
                    <div className="w-24 shrink-0 text-xs text-muted-foreground font-mono">
                      {ses?.cerrada_at ? format(parseISO(ses.cerrada_at), "HH:mm") : "—"}
                    </div>
                    <div className="w-28 shrink-0 text-xs hidden sm:block">
                      {ses ? `$${Number(ses.monto_apertura).toLocaleString("es-AR")}` : "—"}
                    </div>
                    <div className="w-28 shrink-0 text-xs hidden sm:block">
                      {ses?.monto_cierre_declarado != null
                        ? `$${Number(ses.monto_cierre_declarado).toLocaleString("es-AR")}`
                        : "—"}
                    </div>
                    <div className="flex-1" />
                    <div className="w-24 shrink-0">
                      <EstadoBadge estado={j.estado} />
                    </div>
                    <div className="w-6 shrink-0 text-muted-foreground text-xs">→</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
          </div>
        )}
      </div>

      {modalAbrir && (
        <AbrirCajaDialog
          open={true}
          onClose={() => setModalAbrir(false)}
          onSuccess={onSuccess}
        />
      )}
      {modalCerrar && (
        <CerrarCajaDialog
          open={true}
          onClose={() => setModalCerrar(false)}
          onSuccess={onSuccess}
          sesionId={sesionActual?.id ?? ""}
          montoApertura={Number(sesionActual?.monto_apertura ?? 0)}
        />
      )}
      {detalleJornada && (
        <CajaDetalleModal
          open={true}
          jornadaId={detalleJornada}
          onClose={() => setDetalleJornada(null)}
        />
      )}
    </div>
  );
}
