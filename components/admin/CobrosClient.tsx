"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChevronRight, ChevronDown, RefreshCw, Wallet } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";
import type { CobroOrigen, EstadoFiscal, PagoConComprobante, MedioPago } from "@/lib/facturacion/types";
import { TabLoader } from "@/components/ui/tab-loader";

const ESTADO_FISCAL_CONFIG: Record<EstadoFiscal, { label: string; className: string }> = {
  facturado:       { label: "Facturado",        className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  mixto:           { label: "Mixto",            className: "bg-amber-100 text-amber-700 border-amber-200" },
  sin_comprobante: { label: "Sin comprobante",  className: "bg-slate-100 text-slate-500 border-slate-200" },
  pendiente:       { label: "Pendiente",        className: "bg-amber-100 text-amber-700 border-amber-200" },
  fallida:         { label: "Fallida",          className: "bg-red-100 text-red-700 border-red-200" },
};

const TIPO_CONFIG = {
  reserva: { label: "Reserva", className: "bg-blue-100 text-blue-700 border border-blue-200" },
  consumo: { label: "Consumo", className: "bg-violet-100 text-violet-700 border border-violet-200" },
};

const MEDIO_LABELS: Record<MedioPago, string> = {
  efectivo:      "Efectivo",
  transferencia: "Transferencia",
  otro:          "Otro",
};

function EstadoFiscalBadge({ estado }: { estado: EstadoFiscal }) {
  const cfg = ESTADO_FISCAL_CONFIG[estado];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.className}`}>
      {estado === "facturado" && <span className="mr-1">✓</span>}
      {cfg.label}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: "reserva" | "consumo" }) {
  const cfg = TIPO_CONFIG[tipo];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

const CBTE_ESTADO_CONFIG: Record<string, { label: string; className: string }> = {
  emitida:   { label: "✓ Facturado", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  pendiente: { label: "Pendiente",   className: "bg-amber-100 text-amber-700 border-amber-200" },
  fallida:   { label: "Fallida",     className: "bg-red-100 text-red-700 border-red-200" },
  anulada:   { label: "Anulada",     className: "bg-slate-100 text-slate-500 border-slate-200" },
};

function ComprobanteEstadoBadge({ estado }: { estado: string }) {
  const cfg = CBTE_ESTADO_CONFIG[estado] ?? { label: estado, className: "bg-slate-100 text-slate-500 border-slate-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function PagoSubRow({ pago, isLast }: { pago: PagoConComprobante; isLast: boolean }) {
  return (
    <div className="flex items-center h-10 pr-4 bg-muted/20 border-t border-border/40">
      {/* Tree connector */}
      <div className="w-10 shrink-0 flex items-center justify-center self-stretch">
        <div className="flex flex-col items-center w-full h-full">
          <div className="w-px bg-border/60 flex-1" />
          <div className="flex items-center w-full">
            <div className="w-px bg-border/60" style={{ height: "50%" }} />
            <div className="w-3 border-b border-border/60" />
          </div>
          {!isLast && <div className="w-px bg-border/60 flex-1" />}
          {isLast && <div className="flex-1" />}
        </div>
      </div>

      <span className="text-xs text-muted-foreground w-28 shrink-0">
        {MEDIO_LABELS[pago.medio_pago]}
      </span>
      <span className="text-sm font-semibold shrink-0 text-foreground">
        ${Number(pago.monto).toLocaleString("es-AR")}
      </span>
      <div className="flex-1" />
      {pago.medio_pago === "transferencia" && pago.comprobante ? (
        <div className="flex items-center gap-2 shrink-0">
          <ComprobanteEstadoBadge estado={pago.comprobante.estado} />
          {pago.comprobante.cae && (
            <span className="text-xs font-mono text-muted-foreground hidden md:inline">
              CAE: {pago.comprobante.cae}
            </span>
          )}
          <Link
            href={`/admin/facturacion?comprobante=${pago.comprobante.id}`}
            className="text-xs text-primary hover:underline shrink-0"
          >
            ver →
          </Link>
        </div>
      ) : pago.medio_pago === "transferencia" ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-slate-100 text-slate-500 border-slate-200">
          Sin comprobante
        </span>
      ) : null}
    </div>
  );
}

export default function CobrosClient() {
  const [cobros, setCobros] = useState<CobroOrigen[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const perPage = 20;
  const totalPages = Math.ceil(total / perPage);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
      const res = await fetch(`/api/admin/cobros?${params}`);
      const json = await res.json();
      setCobros(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Error al cargar cobros");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet size={16} className="text-[#133D34]" />
            <h1 className="text-sm font-semibold">Cobros</h1>
            {!loading && (
              <span className="text-xs text-muted-foreground">({total})</span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center h-9 px-4 gap-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
            <div className="w-10 shrink-0" />
            <div className="flex-1">Origen</div>
            <div className="w-24 shrink-0 hidden sm:block">Fecha</div>
            <div className="w-24 shrink-0 text-right">Total</div>
            <div className="w-32 shrink-0">Estado fiscal</div>
          </div>

          {loading && cobros.length === 0 ? (
            <TabLoader />
          ) : cobros.length === 0 ? (
            <p className="text-sm text-muted-foreground px-4 py-8 text-center">Sin cobros registrados.</p>
          ) : (
            <div className="divide-y divide-border">
              {cobros.map((cobro) => {
                const isExpanded = expanded.has(cobro.id);
                const rowKey = `${cobro.tipo}:${cobro.id}`;
                return (
                  <div key={rowKey}>
                    {/* Main row */}
                    <div
                      className="flex items-center h-12 px-4 gap-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleExpanded(cobro.id)}
                    >
                      {/* Expand icon */}
                      <div className="w-10 shrink-0 flex items-center justify-center text-muted-foreground">
                        {isExpanded
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />
                        }
                      </div>

                      {/* Descripcion + subtitulo + tipo badge */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium truncate">{cobro.descripcion}</span>
                          <TipoBadge tipo={cobro.tipo} />
                        </div>
                        {cobro.subtitulo && (
                          <span className="text-[11px] text-muted-foreground leading-none">
                            {cobro.subtitulo}
                          </span>
                        )}
                      </div>

                      {/* Fecha */}
                      <div className="w-24 shrink-0 hidden sm:block">
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(cobro.fecha), "dd/MM/yy", { locale: es })}
                        </span>
                      </div>

                      {/* Total */}
                      <div className="w-24 shrink-0 text-right">
                        <span className="text-sm font-semibold text-foreground">
                          ${Number(cobro.total).toLocaleString("es-AR")}
                        </span>
                      </div>

                      {/* Estado fiscal */}
                      <div className="w-32 shrink-0">
                        <EstadoFiscalBadge estado={cobro.estado_fiscal} />
                      </div>
                    </div>

                    {/* Expanded: pago sub-rows */}
                    {isExpanded && cobro.pagos.map((pago, idx) => (
                      <PagoSubRow
                        key={pago.id}
                        pago={pago}
                        isLast={idx === cobro.pagos.length - 1}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
