"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { Compra, Producto, IvaAlicuota } from "@/lib/types";
import { TabLoader } from "@/components/ui/tab-loader";

type ItemForm = {
  producto_id: string;
  cantidad: string;
  costo_con_iva: string;
  iva_alicuota_id: string;
};

const EMPTY_ITEM: ItemForm = {
  producto_id: "",
  cantidad: "1",
  costo_con_iva: "",
  iva_alicuota_id: "",
};

function calcNeto(costoConIva: number, porcentaje: number): number {
  return porcentaje > 0 ? costoConIva / (1 + porcentaje / 100) : costoConIva;
}

export function ComprasTab() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ivaAlicuotas, setIvaAlicuotas] = useState<IvaAlicuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [proveedor, setProveedor] = useState("");
  const [notas, setNotas] = useState("");
  const [items, setItems] = useState<ItemForm[]>([{ ...EMPTY_ITEM }]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [cRes, pRes, iRes] = await Promise.all([
        fetch("/api/admin/stock/compras"),
        fetch("/api/admin/stock/productos"),
        fetch("/api/admin/iva-alicuotas"),
      ]);
      if (cRes.ok) setCompras(await cRes.json());
      if (pRes.ok) setProductos(await pRes.json());
      if (iRes.ok) setIvaAlicuotas(await iRes.json());
      setLoading(false);
    };
    load();
  }, []);

  function openDialog() {
    setFecha(new Date().toISOString().split("T")[0]);
    setProveedor("");
    setNotas("");
    setItems([{ ...EMPTY_ITEM }]);
    setDialogOpen(true);
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof ItemForm, value: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  }

  async function handleCreate() {
    if (items.length === 0) {
      toast.error("Agregá al menos un ítem");
      return;
    }
    for (const item of items) {
      if (!item.producto_id) { toast.error("Seleccioná un producto en cada ítem"); return; }
      if (!item.iva_alicuota_id) { toast.error("Seleccioná el IVA en cada ítem"); return; }
      if (!item.cantidad || Number(item.cantidad) <= 0) { toast.error("Cantidad debe ser mayor a 0"); return; }
    }

    const payload = {
      fecha,
      proveedor: proveedor.trim() || undefined,
      notas: notas.trim() || undefined,
      items: items.map((item) => {
        const alicuota = ivaAlicuotas.find((a) => a.id === item.iva_alicuota_id);
        const costoConIva = parseFloat(item.costo_con_iva) || 0;
        const costo_neto = calcNeto(costoConIva, alicuota?.porcentaje ?? 0);
        return {
          producto_id: item.producto_id,
          cantidad: parseInt(item.cantidad),
          costo_con_iva: costoConIva,
          iva_alicuota_id: item.iva_alicuota_id,
          costo_neto,
        };
      }),
    };

    setCreating(true);
    const res = await fetch("/api/admin/stock/compras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setCreating(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Error al registrar compra");
      return;
    }
    const nueva: Compra = await res.json();
    setCompras((prev) => [nueva, ...prev]);
    setDialogOpen(false);
    toast.success("Compra registrada");
  }

  const totalCompra = (compra: Compra) =>
    (compra.items ?? []).reduce((s, i) => s + i.costo_con_iva * i.cantidad, 0);

  if (loading) return <TabLoader />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {compras.length === 0 ? "Sin compras registradas" : `${compras.length} compra${compras.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={openDialog}>
          <Plus className="h-4 w-4 mr-1" />
          Nueva compra
        </Button>
      </div>

      {/* List */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fecha</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Proveedor</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Ítems</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Total c/IVA</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Notas</th>
            </tr>
          </thead>
          <tbody>
            {compras.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-sm text-muted-foreground px-4 py-8 text-center">Sin compras registradas</td>
              </tr>
            ) : (
              compras.map((c) => (
                <tr key={c.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 tabular-nums">
                    {new Date(c.fecha + "T00:00:00").toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-2.5">
                    {c.proveedor ? (
                      <span className="font-medium">{c.proveedor}</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge variant="secondary" className="text-xs">
                      {(c.items ?? []).length}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                    ${totalCompra(c).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[200px] truncate">
                    {c.notas ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* New purchase Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Nueva compra</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Fecha *</label>
                <Input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Proveedor</label>
                <Input
                  value={proveedor}
                  onChange={(e) => setProveedor(e.target.value)}
                  placeholder="Nombre del proveedor"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Notas</label>
              <Input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Opcional"
                className="h-8 text-sm"
              />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-muted-foreground">Ítems *</label>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Agregar ítem
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Select
                        value={item.producto_id || "none"}
                        onValueChange={(v) => updateItem(idx, "producto_id", v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="flex-1 h-8 text-sm">
                          <SelectValue placeholder="Seleccionar producto..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Seleccionar producto...</SelectItem>
                          {productos.filter((p) => p.activo).map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeItem(idx)}
                        disabled={items.length === 1}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Cantidad</label>
                        <Input
                          type="number"
                          min="1"
                          value={item.cantidad}
                          onChange={(e) => updateItem(idx, "cantidad", e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Costo c/IVA</label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.costo_con_iva}
                          onChange={(e) => updateItem(idx, "costo_con_iva", e.target.value)}
                          placeholder="0.00"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1">Alícuota IVA</label>
                        <Select
                          value={item.iva_alicuota_id || "none"}
                          onValueChange={(v) => updateItem(idx, "iva_alicuota_id", v === "none" ? "" : v)}
                        >
                          <SelectTrigger className="w-full h-8 text-sm">
                            <SelectValue placeholder="IVA" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin IVA</SelectItem>
                            {ivaAlicuotas.map((a) => (
                              <SelectItem key={a.id} value={a.id}>{a.nombre} ({a.porcentaje}%)</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? "Registrando..." : "Registrar compra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
