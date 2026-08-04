"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { RefreshCw, Eye, RotateCcw, XCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import type { Comprobante, ComprobanteEstado } from "@/lib/facturacion/types";
import { TabLoader } from "@/components/ui/tab-loader";

const ESTADO_LABELS: Record<ComprobanteEstado, string> = {
  pendiente: "Pendiente",
  emitida: "Emitida",
  fallida: "Fallida",
  anulada: "Anulada",
};

const ESTADO_VARIANT: Record<
  ComprobanteEstado,
  "default" | "outline" | "destructive" | "secondary"
> = {
  pendiente: "secondary",
  emitida: "default",
  fallida: "destructive",
  anulada: "outline",
};

const TIPO_LABELS: Record<number, string> = {
  6: "Factura B",
  11: "Factura C",
};

export function ComprobantesTab() {
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get("comprobante");

  const [comprobantes, setComprobantes] = useState<Comprobante[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("all");
  const [detalle, setDetalle] = useState<Comprobante | null>(null);
  const [caeManual, setCaeManual] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filtroEstado !== "all") params.set("estado", filtroEstado);
    try {
      const res = await fetch(`/api/admin/facturacion?${params}`);
      const json = await res.json();
      setComprobantes(json.data ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Error al cargar comprobantes");
    } finally {
      setLoading(false);
    }
  }, [page, filtroEstado]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Deep link: ?comprobante=ID abre el detalle directamente
  useEffect(() => {
    if (!deepLinkId) return;
    const target = comprobantes.find((c) => c.id === deepLinkId);
    if (target) {
      setDetalle(target);
      return;
    }
    // No está en la página actual — fetch directo por ID
    fetch(`/api/admin/facturacion/${deepLinkId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setDetalle(data as Comprobante); });
  }, [deepLinkId, comprobantes]);

  async function handleReintentar(id: string) {
    setRetryingId(id);
    try {
      const res = await fetch(`/api/admin/facturacion/${id}`, { method: "POST" });
      if (res.ok) {
        toast.success("Comprobante emitido correctamente");
        fetchData();
        setDetalle(null);
      } else {
        const json = await res.json().catch(() => ({}));
        toast.error((json as { error?: string }).error ?? "Error al reintentar");
      }
    } finally {
      setRetryingId(null);
    }
  }

  async function handleAnular(id: string) {
    const res = await fetch(`/api/admin/facturacion/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "anulada" }),
    });
    if (res.ok) {
      toast.success("Comprobante anulado");
      fetchData();
      setDetalle(null);
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error((json as { error?: string }).error ?? "Error al anular");
    }
  }

  async function handleCaeManual(id: string) {
    if (!caeManual.trim()) {
      toast.error("Ingresá el CAE");
      return;
    }
    const res = await fetch(`/api/admin/facturacion/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cae_manual: caeManual.trim() }),
    });
    if (res.ok) {
      toast.success("CAE registrado manualmente");
      setCaeManual("");
      fetchData();
      setDetalle(null);
    } else {
      const json = await res.json().catch(() => ({}));
      toast.error((json as { error?: string }).error ?? "Error");
    }
  }

  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filtroEstado}
          onValueChange={(v) => {
            setFiltroEstado(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendiente</SelectItem>
            <SelectItem value="emitida">Emitida</SelectItem>
            <SelectItem value="fallida">Fallida</SelectItem>
            <SelectItem value="anulada">Anulada</SelectItem>
          </SelectContent>
        </Select>
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
        <span className="text-xs text-muted-foreground ml-auto">
          {total} comprobante{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tabla */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {/* Column headers - siempre visibles */}
        <div className="flex items-center h-9 px-4 gap-3 bg-muted/50 border-b border-border text-xs font-medium text-muted-foreground">
          <div className="flex-1">Comprobante</div>
          <div className="hidden md:block w-40 shrink-0">CAE</div>
          <div className="w-24 shrink-0 text-right">Importe</div>
          <div className="w-24 shrink-0">Estado</div>
          <div className="w-20 shrink-0" />
        </div>
        {loading && comprobantes.length === 0 ? (
          <TabLoader />
        ) : comprobantes.length === 0 ? (
          <p className="text-sm text-muted-foreground px-4 py-6 text-center">Sin comprobantes.</p>
        ) : (
          <div className="divide-y divide-border">
            {comprobantes.map((c) => (
              <div key={c.id} className="flex items-center h-11 px-4 gap-3">
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {format(parseISO(c.fecha_cbte), "dd/MM/yy")}
                  </span>
                  {c.origen_tipo && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 capitalize">
                      {c.origen_tipo}
                    </Badge>
                  )}
                  <span className="text-sm font-medium truncate">
                    {c.nro_cbte
                      ? `${TIPO_LABELS[c.tipo_cbte] ?? `Cbte ${c.tipo_cbte}`} N° ${c.nro_cbte}`
                      : "Sin número"}
                  </span>
                  {c.cae && (
                    <span className="text-xs font-mono text-muted-foreground hidden md:inline truncate">
                      CAE: {c.cae}
                    </span>
                  )}
                  {c.pago?.cuenta_bancaria?.nombre_display && (
                    <span className="text-xs text-muted-foreground hidden lg:inline truncate">
                      {c.pago.cuenta_bancaria.nombre_display}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium shrink-0">
                  ${Number(c.importe).toLocaleString("es-AR")}
                </span>
                <Badge
                  variant={ESTADO_VARIANT[c.estado]}
                  className="text-[11px] px-2 py-0.5 shrink-0"
                >
                  {ESTADO_LABELS[c.estado]}
                  {c.cae_manual && " (manual)"}
                </Badge>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setDetalle(c)}
                      >
                        <Eye size={13} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Ver detalle</TooltipContent>
                  </Tooltip>
                  {(c.estado === "fallida" || c.estado === "pendiente") && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          disabled={retryingId === c.id}
                          onClick={() => handleReintentar(c.id)}
                        >
                          <RotateCcw
                            size={13}
                            className={retryingId === c.id ? "animate-spin" : ""}
                          />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Reintentar emisión</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
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

      {/* Dialog detalle */}
      <Dialog
        open={!!detalle}
        onOpenChange={(v) => {
          if (!v) {
            setDetalle(null);
            setCaeManual("");
          }
        }}
      >
        {detalle && (
          <DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {TIPO_LABELS[detalle.tipo_cbte] ?? `Tipo ${detalle.tipo_cbte}`}
                {detalle.nro_cbte ? ` N° ${detalle.nro_cbte}` : ""}
                <Badge variant={ESTADO_VARIANT[detalle.estado]} className="text-[11px] ml-1">
                  {ESTADO_LABELS[detalle.estado]}
                  {detalle.cae_manual && " (manual)"}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Fecha</p>
                  <p>{format(parseISO(detalle.fecha_cbte), "dd/MM/yyyy", { locale: es })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Importe</p>
                  <p className="font-medium">
                    ${Number(detalle.importe).toLocaleString("es-AR")}
                  </p>
                </div>
                {detalle.cae && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">CAE</p>
                    <p className="font-mono text-xs">{detalle.cae}</p>
                  </div>
                )}
                {detalle.vencimiento_cae && (
                  <div>
                    <p className="text-xs text-muted-foreground">Venc. CAE</p>
                    <p className="text-xs">
                      {format(parseISO(detalle.vencimiento_cae), "dd/MM/yyyy")}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Intentos</p>
                  <p>{detalle.intentos}</p>
                </div>
              </div>

              {detalle.ultimo_error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-xs text-muted-foreground mb-1">Último error</p>
                  <p className="text-xs font-mono text-destructive">{detalle.ultimo_error}</p>
                </div>
              )}

              {detalle.datos_envio && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Payload enviado a ARCA</p>
                  <pre className="text-[10px] font-mono bg-muted rounded-md p-2 overflow-x-auto max-h-32">
                    {JSON.stringify(detalle.datos_envio, null, 2)}
                  </pre>
                </div>
              )}

              {detalle.datos_respuesta && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Respuesta de ARCA</p>
                  <pre className="text-[10px] font-mono bg-muted rounded-md p-2 overflow-x-auto max-h-32">
                    {JSON.stringify(detalle.datos_respuesta, null, 2)}
                  </pre>
                </div>
              )}

              {/* CAE manual */}
              {(detalle.estado === "fallida" || detalle.estado === "pendiente") && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <div>
                    <p className="text-xs font-medium">¿ARCA sigue sin responder?</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Podés emitir la factura desde el{" "}
                      <a
                        href="https://serviciosweb.afip.gob.ar/genericos/login/login.aspx"
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        portal de ARCA
                      </a>{" "}
                      y registrar el CAE aquí.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={caeManual}
                      onChange={(e) => setCaeManual(e.target.value)}
                      className="h-8 text-xs font-mono"
                      placeholder="71536987654321"
                    />
                    <Button
                      size="sm"
                      className="h-8 text-xs shrink-0"
                      onClick={() => handleCaeManual(detalle.id)}
                    >
                      Registrar CAE
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 flex-wrap">
              {(detalle.estado === "fallida" || detalle.estado === "pendiente") && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={retryingId === detalle.id}
                    onClick={() => handleReintentar(detalle.id)}
                  >
                    <RotateCcw
                      size={12}
                      className={retryingId === detalle.id ? "animate-spin" : ""}
                    />
                    Reintentar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => handleAnular(detalle.id)}
                  >
                    <XCircle size={12} />
                    Anular
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDetalle(null);
                  setCaeManual("");
                }}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
