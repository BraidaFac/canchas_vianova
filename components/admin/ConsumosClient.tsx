"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, ShoppingBag, Eye, Pencil, Trash2, Plus, X, Zap } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TabLoader } from "@/components/ui/tab-loader";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type ConsumoItem = {
  id: string;
  consumo_id: string;
  producto_id: string;
  cantidad: number;
  precio_unitario: number;
  productos: { id: string; nombre: string } | null;
};

type ConsumoPago = {
  id: string;
  medio_pago: "efectivo" | "transferencia" | "otro";
  monto: number;
  cuenta_bancaria_id: string | null;
  cuenta_bancaria: { id: string; nombre_display: string } | null;
};

type ConsumoFull = {
  id: string;
  reserva_id: string | null;
  empleado_id: string | null;
  total: number;
  notas: string | null;
  created_at: string;
  consumo_items: ConsumoItem[];
  pagos: ConsumoPago[];
  reserva: { id: string; id_legible: string } | null;
};

type Producto = {
  id: string;
  nombre: string;
  precio: number;
  categoria_nombre?: string;
};

type CuentaBancaria = {
  id: string;
  nombre_display: string;
};

type EditItem = {
  producto_id: string;
  nombre: string;
  cantidad: number;
  precio_unitario: number;
};

type EditPago = {
  medio_pago: string;
  monto: string;
  cuenta_bancaria_id: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MEDIO_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  otro: "Otro",
};

const MEDIOS: { value: string; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "otro", label: "Otro" },
];

const MEDIO_COLORS: Record<string, string> = {
  efectivo: "bg-green-100 text-green-700 border-green-200",
  transferencia: "bg-blue-100 text-blue-700 border-blue-200",
  otro: "bg-slate-100 text-slate-600 border-slate-200",
};

function itemsSummary(items: ConsumoItem[]): string {
  if (items.length === 0) return "Sin productos";
  const names = items.slice(0, 2).map((i) => {
    const nombre = i.productos?.nombre ?? "Producto";
    return i.cantidad > 1 ? `${nombre} x${i.cantidad}` : nombre;
  });
  const extra = items.length > 2 ? ` +${items.length - 2} más` : "";
  return names.join(", ") + extra;
}

function MedioBadge({ medio }: { medio: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
        MEDIO_COLORS[medio] ?? MEDIO_COLORS.otro
      )}
    >
      {MEDIO_LABELS[medio] ?? medio}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConsumosClient() {
  const [consumos, setConsumos] = useState<ConsumoFull[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail / edit modal
  const [selected, setSelected] = useState<ConsumoFull | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editNotas, setEditNotas] = useState("");
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [editPagos, setEditPagos] = useState<EditPago[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Add-item form
  const [newItemId, setNewItemId] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [productoSearch, setProductoSearch] = useState("");
  const [showProductoDropdown, setShowProductoDropdown] = useState(false);

  // Catalog (loaded lazily on first edit)
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cuentasBancarias, setCuentasBancarias] = useState<CuentaBancaria[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Fetch list ──────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pos/consumos");
      const json = await res.json();
      setConsumos(Array.isArray(json) ? json : []);
    } catch {
      toast.error("Error al cargar consumos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Catalog fetch (lazy) ────────────────────────────────────────────────────
  async function fetchCatalog() {
    if (productos.length > 0) return;
    setLoadingCatalog(true);
    try {
      const [prodRes, cbRes] = await Promise.all([
        fetch("/api/admin/pos/productos"),
        fetch("/api/admin/pos/cuentas-bancarias"),
      ]);
      const prods = await prodRes.json();
      const cbs = cbRes.ok ? await cbRes.json() : [];
      setProductos(Array.isArray(prods) ? prods : []);
      setCuentasBancarias(Array.isArray(cbs) ? cbs : []);
    } catch {
      toast.error("Error al cargar catálogo");
    } finally {
      setLoadingCatalog(false);
    }
  }

  // ── Modal handlers ──────────────────────────────────────────────────────────
  function openDetail(c: ConsumoFull) {
    setSelected(c);
    setEditMode(false);
  }

  function enterEditMode(c: ConsumoFull) {
    setEditNotas(c.notas ?? "");
    setEditItems(
      c.consumo_items.map((i) => ({
        producto_id: i.producto_id,
        nombre: i.productos?.nombre ?? "Producto",
        cantidad: i.cantidad,
        precio_unitario: Number(i.precio_unitario),
      }))
    );
    setEditPagos(
      c.pagos.map((p) => ({
        medio_pago: p.medio_pago,
        monto: String(Number(p.monto)),
        cuenta_bancaria_id: p.cuenta_bancaria_id ?? "",
      }))
    );
    setNewItemId("");
    setNewItemQty("1");
    setProductoSearch("");
    setShowProductoDropdown(false);
    setEditMode(true);
    fetchCatalog();
  }

  function closeModal() {
    setSelected(null);
    setEditMode(false);
  }

  // ── Edit: items ─────────────────────────────────────────────────────────────
  function updateItemQty(idx: number, qty: number) {
    setEditItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, cantidad: Math.max(1, qty) } : it))
    );
  }

  function updateItemPrice(idx: number, price: number) {
    setEditItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, precio_unitario: Math.max(0, price) } : it))
    );
  }

  function removeItem(idx: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addItem() {
    if (!newItemId) return;
    const prod = productos.find((p) => p.id === newItemId);
    if (!prod) return;
    const qty = Math.max(1, parseInt(newItemQty) || 1);
    const existing = editItems.findIndex((i) => i.producto_id === newItemId);
    if (existing >= 0) {
      setEditItems((prev) =>
        prev.map((it, i) =>
          i === existing ? { ...it, cantidad: it.cantidad + qty } : it
        )
      );
    } else {
      setEditItems((prev) => [
        ...prev,
        {
          producto_id: prod.id,
          nombre: prod.nombre,
          cantidad: qty,
          precio_unitario: prod.precio,
        },
      ]);
    }
    setNewItemId("");
    setNewItemQty("1");
    setProductoSearch("");
    setShowProductoDropdown(false);
  }

  // ── Edit: pagos ─────────────────────────────────────────────────────────────
  function updatePago(idx: number, partial: Partial<EditPago>) {
    setEditPagos((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...partial } : p))
    );
  }

  function removePago(idx: number) {
    setEditPagos((prev) => prev.filter((_, i) => i !== idx));
  }

  function addPago() {
    setEditPagos((prev) => {
      const usados = prev.map((p) => p.medio_pago);
      const disponible = MEDIOS.find((m) => !usados.includes(m.value));
      return [
        ...prev,
        {
          medio_pago: disponible?.value ?? "transferencia",
          monto: "",
          cuenta_bancaria_id: "",
        },
      ];
    });
  }

  const editTotal = editItems.reduce(
    (s, i) => s + i.cantidad * i.precio_unitario,
    0
  );

  // ── Save edit ───────────────────────────────────────────────────────────────
  async function saveEdit() {
    if (!selected) return;
    if (editItems.length === 0) {
      toast.error("Debe haber al menos un producto");
      return;
    }
    if (editPagos.length === 0) {
      toast.error("Debe haber al menos un medio de pago");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/pos/consumos/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notas: editNotas.trim() || null,
          items: editItems.map((i) => ({
            producto_id: i.producto_id,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
          })),
          pagos: editPagos.map((p) => ({
            medio_pago: p.medio_pago,
            monto: parseFloat(p.monto) || 0,
            cuenta_bancaria_id: p.cuenta_bancaria_id || null,
          })),
          total: editTotal,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Error al guardar");
        return;
      }

      toast.success("Consumo actualizado");
      closeModal();
      await fetchData();
    } catch {
      toast.error("Error de red");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/pos/consumos/${deletingId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "No se pudo eliminar");
        return;
      }
      toast.success("Consumo eliminado");
      setDeletingId(null);
      setSelected(null);
      await fetchData();
    } catch {
      toast.error("Error de red");
    } finally {
      setIsDeleting(false);
    }
  }

  const consumoAEliminar = consumos.find((c) => c.id === deletingId) ?? null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} className="text-[#133D34]" />
            <h1 className="text-sm font-semibold">Consumos</h1>
            {!loading && (
              <span className="text-xs text-muted-foreground">
                ({consumos.length})
              </span>
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
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  Fecha
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden md:table-cell">
                  Productos
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">
                  Medios de pago
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden lg:table-cell">
                  Reserva
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                  Total
                </th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <TabLoader />
                  </td>
                </tr>
              ) : consumos.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-sm text-muted-foreground px-4 py-8 text-center"
                  >
                    Sin consumos registrados.
                  </td>
                </tr>
              ) : (
                consumos.map((c) => (
                  <tr
                    key={c.id}
                    className="odd:bg-background even:bg-muted/30 hover:bg-accent/40 transition-colors"
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium">
                        {format(parseISO(c.created_at), "dd/MM/yy", {
                          locale: es,
                        })}
                      </div>
                      <div className="text-muted-foreground text-[10px]">
                        {format(parseISO(c.created_at), "HH:mm", {
                          locale: es,
                        })}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 hidden md:table-cell text-muted-foreground max-w-[200px] truncate">
                      {itemsSummary(c.consumo_items)}
                    </td>

                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {c.pagos.length === 0 ? (
                          <span className="text-muted-foreground text-[10px]">
                            Sin pagos
                          </span>
                        ) : (
                          [
                            ...new Set(c.pagos.map((p) => p.medio_pago)),
                          ].map((medio) => (
                            <MedioBadge key={medio} medio={medio} />
                          ))
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 hidden lg:table-cell">
                      {c.reserva ? (
                        <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full font-medium">
                          #{c.reserva.id_legible}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[10px]">
                          —
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                      ${Number(c.total).toLocaleString("es-AR")}
                    </td>

                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openDetail(c)}
                          title="Ver detalle"
                        >
                          <Eye size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeletingId(c.id)}
                          title="Eliminar consumo"
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail / Edit modal ─────────────────────────────────────────────── */}
      <Dialog
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) closeModal();
        }}
      >
        <DialogContent
          className={cn(
            "transition-all",
            editMode ? "max-w-lg" : "max-w-md"
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <ShoppingBag size={15} className="text-violet-600" />
              {editMode ? "Editar consumo" : "Detalle del consumo"}
            </DialogTitle>
          </DialogHeader>

          {/* ── View mode ── */}
          {selected && !editMode && (
            <div className="space-y-4 text-sm">
              {/* Meta */}
              <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-3">
                <span>
                  {format(
                    parseISO(selected.created_at),
                    "dd 'de' MMMM yyyy, HH:mm",
                    { locale: es }
                  )}
                </span>
                {selected.reserva && (
                  <span className="bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[10px] font-medium">
                    → Reserva #{selected.reserva.id_legible}
                  </span>
                )}
              </div>

              {/* Items */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Productos
                </p>
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Producto
                        </th>
                        <th className="px-3 py-2 text-center font-medium text-muted-foreground w-12">
                          Cant.
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">
                          Precio
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground w-20">
                          Subtotal
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selected.consumo_items.map((item) => (
                        <tr
                          key={item.id}
                          className="odd:bg-background even:bg-muted/20"
                        >
                          <td className="px-3 py-2 font-medium">
                            {item.productos?.nombre ?? "Producto eliminado"}
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground">
                            {item.cantidad}
                          </td>
                          <td className="px-3 py-2 text-right text-muted-foreground">
                            ${Number(item.precio_unitario).toLocaleString("es-AR")}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            $
                            {(
                              item.cantidad * Number(item.precio_unitario)
                            ).toLocaleString("es-AR")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-border bg-muted/30">
                        <td
                          colSpan={3}
                          className="px-3 py-2 text-right text-xs font-medium text-muted-foreground"
                        >
                          Total productos
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          $
                          {selected.consumo_items
                            .reduce(
                              (s, i) =>
                                s + i.cantidad * Number(i.precio_unitario),
                              0
                            )
                            .toLocaleString("es-AR")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Pagos */}
              {selected.pagos.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                    Medios de pago
                  </p>
                  <div className="space-y-1.5">
                    {selected.pagos.map((pago) => (
                      <div
                        key={pago.id}
                        className="flex items-center justify-between px-3 py-2 rounded-md border border-border bg-muted/20"
                      >
                        <div className="flex items-center gap-2">
                          <MedioBadge medio={pago.medio_pago} />
                          {pago.cuenta_bancaria && (
                            <span className="text-xs text-muted-foreground">
                              {pago.cuenta_bancaria.nombre_display}
                            </span>
                          )}
                        </div>
                        <span className="text-sm font-semibold">
                          ${Number(pago.monto).toLocaleString("es-AR")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas */}
              {selected.notas && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wide">
                    Notas
                  </p>
                  <p className="text-sm text-foreground bg-muted/30 rounded-md px-3 py-2 border border-border">
                    {selected.notas}
                  </p>
                </div>
              )}

              {/* Total footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-sm font-medium text-muted-foreground">
                  Total cobrado
                </span>
                <span className="text-lg font-bold text-foreground">
                  ${Number(selected.total).toLocaleString("es-AR")}
                </span>
              </div>
            </div>
          )}

          {/* ── Edit mode ── */}
          {selected && editMode && (
            <div className="space-y-4 text-sm max-h-[60vh] overflow-y-auto pr-1">
              {/* Items */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Productos
                </p>
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                          Producto
                        </th>
                        <th className="px-2 py-1.5 text-center font-medium text-muted-foreground w-16">
                          Cant.
                        </th>
                        <th className="px-2 py-1.5 text-right font-medium text-muted-foreground w-24">
                          Precio
                        </th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {editItems.map((item, idx) => (
                        <tr
                          key={idx}
                          className="odd:bg-background even:bg-muted/20"
                        >
                          <td className="px-2 py-1.5 font-medium">
                            {item.nombre}
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={1}
                              value={item.cantidad}
                              onChange={(e) =>
                                updateItemQty(idx, parseInt(e.target.value) || 1)
                              }
                              className="h-6 text-xs text-center w-14 mx-auto"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              value={item.precio_unitario}
                              onChange={(e) =>
                                updateItemPrice(
                                  idx,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="h-6 text-xs text-right w-20 ml-auto"
                            />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => removeItem(idx)}
                            >
                              <X size={11} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add product */}
                <div className="flex items-center gap-1.5 mt-2">
                  {loadingCatalog ? (
                    <span className="text-xs text-muted-foreground">
                      Cargando productos...
                    </span>
                  ) : (
                    <>
                      {/* Product fuzzy search */}
                      <div className="relative flex-1">
                        <Input
                          value={productoSearch}
                          onChange={(e) => {
                            setProductoSearch(e.target.value);
                            setNewItemId("");
                            setShowProductoDropdown(true);
                          }}
                          onFocus={() => setShowProductoDropdown(true)}
                          onBlur={() =>
                            setTimeout(() => setShowProductoDropdown(false), 150)
                          }
                          placeholder="Buscar producto o categoría..."
                          className="h-7 text-xs"
                        />
                        {showProductoDropdown && productoSearch.trim() && (
                          <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-md border border-border bg-popover shadow-md max-h-40 overflow-y-auto">
                            {(() => {
                              const q = productoSearch.toLowerCase().trim();
                              const words = q.split(/\s+/);
                              const filtered = productos.filter((p) => {
                                const hay =
                                  (p.nombre + " " + (p.categoria_nombre ?? "")).toLowerCase();
                                return words.every((w) => hay.includes(w));
                              });
                              if (filtered.length === 0) {
                                return (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">
                                    Sin resultados
                                  </div>
                                );
                              }
                              return filtered.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onMouseDown={() => {
                                    setNewItemId(p.id);
                                    setProductoSearch(p.nombre);
                                    setShowProductoDropdown(false);
                                  }}
                                  className={cn(
                                    "w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors flex items-center justify-between gap-2",
                                    newItemId === p.id && "bg-accent"
                                  )}
                                >
                                  <span className="font-medium">{p.nombre}</span>
                                  <span className="text-muted-foreground shrink-0">
                                    {p.categoria_nombre && (
                                      <span className="mr-2 opacity-60">{p.categoria_nombre}</span>
                                    )}
                                    ${p.precio.toLocaleString("es-AR")}
                                  </span>
                                </button>
                              ));
                            })()}
                          </div>
                        )}
                      </div>
                      <Input
                        type="number"
                        min={1}
                        value={newItemQty}
                        onChange={(e) => setNewItemQty(e.target.value)}
                        className="h-7 text-xs w-14 text-center shrink-0"
                        placeholder="1"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={addItem}
                        disabled={!newItemId}
                      >
                        <Plus size={12} />
                      </Button>
                    </>
                  )}
                </div>

                <div className="flex justify-end mt-1.5 text-xs font-semibold text-foreground">
                  Total: ${editTotal.toLocaleString("es-AR")}
                </div>
              </div>

              {/* Pagos */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
                  Medios de pago
                </p>
                <div className="space-y-1.5">
                  {editPagos.map((pago, idx) => {
                    const mediosUsadosEnOtrasFilas = editPagos
                      .filter((_, i) => i !== idx)
                      .map((p) => p.medio_pago);
                    const mediosDisponibles = MEDIOS.filter(
                      (m) => !mediosUsadosEnOtrasFilas.includes(m.value)
                    );
                    const otherRowsTotal = editPagos.reduce(
                      (sum, p, i) =>
                        i !== idx ? sum + (parseFloat(p.monto) || 0) : sum,
                      0
                    );
                    const faltante =
                      Math.round((editTotal - otherRowsTotal) * 100) / 100;
                    const showFill = editPagos.length > 1 && faltante > 0;

                    return (
                      <div key={idx} className="flex items-center gap-1.5">
                        <Select
                          value={pago.medio_pago}
                          onValueChange={(v) =>
                            updatePago(idx, {
                              medio_pago: v,
                              cuenta_bancaria_id:
                                v !== "transferencia"
                                  ? ""
                                  : pago.cuenta_bancaria_id,
                            })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-36 shrink-0">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {mediosDisponibles.map((m) => (
                              <SelectItem
                                key={m.value}
                                value={m.value}
                                className="text-xs"
                              >
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {pago.medio_pago === "transferencia" &&
                          cuentasBancarias.length > 0 && (
                            <Select
                              value={pago.cuenta_bancaria_id || "__none__"}
                              onValueChange={(v) =>
                                updatePago(idx, {
                                  cuenta_bancaria_id:
                                    v === "__none__" ? "" : v,
                                })
                              }
                            >
                              <SelectTrigger className="h-7 text-xs flex-1">
                                <SelectValue placeholder="Cuenta..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  value="__none__"
                                  className="text-xs text-muted-foreground"
                                >
                                  Sin cuenta
                                </SelectItem>
                                {cuentasBancarias.map((cb) => (
                                  <SelectItem
                                    key={cb.id}
                                    value={cb.id}
                                    className="text-xs"
                                  >
                                    {cb.nombre_display}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}

                        <Input
                          type="number"
                          min={0}
                          value={pago.monto}
                          onChange={(e) =>
                            updatePago(idx, { monto: e.target.value })
                          }
                          className="h-7 text-xs w-24 text-right shrink-0"
                          placeholder="Monto"
                        />
                        {showFill && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title={`Completar con $${faltante.toLocaleString("es-AR")}`}
                            onClick={() =>
                              updatePago(idx, { monto: String(faltante) })
                            }
                          >
                            <Zap size={11} />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removePago(idx)}
                        >
                          <X size={11} />
                        </Button>
                      </div>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5 w-full"
                    onClick={addPago}
                    disabled={editPagos.length >= MEDIOS.length}
                  >
                    <Plus size={11} />
                    Agregar medio de pago
                  </Button>
                </div>
              </div>

              {/* Notas */}
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1 uppercase tracking-wide">
                  Notas
                </label>
                <textarea
                  value={editNotas}
                  onChange={(e) => setEditNotas(e.target.value)}
                  placeholder="Notas opcionales..."
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>
          )}

          {/* Footer */}
          {selected && (
            <DialogFooter className="gap-2 pt-2">
              {editMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMode(false)}
                    disabled={isSaving}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveEdit}
                    disabled={isSaving || editItems.length === 0}
                  >
                    {isSaving ? "Guardando..." : "Guardar cambios"}
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => enterEditMode(selected)}
                >
                  <Pencil size={12} />
                  Editar
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ──────────────────────────────────────── */}
      <Dialog
        open={!!deletingId}
        onOpenChange={(v) => {
          if (!v && !isDeleting) setDeletingId(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm text-destructive">
              <Trash2 size={15} />
              Eliminar consumo
            </DialogTitle>
          </DialogHeader>

          {consumoAEliminar && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground text-sm">
                ¿Seguro que querés eliminar este consumo? Esta acción no se
                puede deshacer.
              </p>
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fecha</span>
                  <span className="font-medium">
                    {format(
                      parseISO(consumoAEliminar.created_at),
                      "dd/MM/yyyy HH:mm",
                      { locale: es }
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">
                    ${Number(consumoAEliminar.total).toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Productos</span>
                  <span className="text-right max-w-[180px] truncate">
                    {itemsSummary(consumoAEliminar.consumo_items)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeletingId(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
