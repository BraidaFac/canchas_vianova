"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import type { Producto, Categoria, IvaAlicuota } from "@/lib/types";

type PendingPriceEdit = {
  productoId: string;
  newPrecio: number;
};

export function ProductosTab() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ivaAlicuotas, setIvaAlicuotas] = useState<IvaAlicuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [pendingPrice, setPendingPrice] = useState<PendingPriceEdit | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline edit state: keyed by producto id
  const [editValues, setEditValues] = useState<Record<string, { precio: string; stock: string }>>({});

  // New product form state
  const [form, setForm] = useState({
    nombre: "",
    categoria_id: "",
    precio: "",
    costo_con_iva: "",
    iva_alicuota_id: "",
    stock_actual: "0",
    tiene_stock: true,
    unidad: "unidad" as "unidad" | "kg" | "litro",
    activo: true,
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [pRes, cRes, iRes] = await Promise.all([
        fetch("/api/admin/stock/productos"),
        fetch("/api/admin/stock/categorias"),
        fetch("/api/admin/iva-alicuotas"),
      ]);
      if (pRes.ok) setProductos(await pRes.json());
      if (cRes.ok) setCategorias(await cRes.json());
      if (iRes.ok) setIvaAlicuotas(await iRes.json());
      setLoading(false);
    };
    load();
  }, []);

  // Seed editValues when entering edit mode
  useEffect(() => {
    if (editMode) {
      const vals: Record<string, { precio: string; stock: string }> = {};
      for (const p of productos) {
        vals[p.id] = { precio: String(p.precio), stock: String(p.stock_actual) };
      }
      setEditValues(vals);
    }
  }, [editMode, productos]);

  const filtered = productos.filter((p) => {
    const matchesCat = filterCategoria === "all" || p.categoria_id === filterCategoria;
    const matchesSearch = p.nombre.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  async function saveInlineField(productoId: string, field: "precio" | "stock_actual", rawValue: string) {
    const numVal = parseFloat(rawValue);
    if (isNaN(numVal)) return;

    const current = productos.find((p) => p.id === productoId);
    if (!current) return;

    if (field === "precio" && numVal !== current.precio) {
      // Require confirmation for price changes
      setPendingPrice({ productoId, newPrecio: numVal });
      return;
    }

    if (field === "stock_actual" && numVal === current.stock_actual) return;

    setSaving(true);
    const res = await fetch(`/api/admin/stock/productos/${productoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: numVal }),
    });
    setSaving(false);

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Error al guardar");
      return;
    }
    const updated: Producto = await res.json();
    setProductos((prev) => prev.map((p) => (p.id === productoId ? updated : p)));
    toast.success("Guardado");
  }

  async function confirmPriceChange() {
    if (!pendingPrice) return;
    const snap = pendingPrice;
    setSaving(true);
    const res = await fetch(`/api/admin/stock/productos/${snap.productoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precio: snap.newPrecio }),
    });
    setSaving(false);
    setPendingPrice(null);
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Error al guardar precio");
      return;
    }
    const updated: Producto = await res.json();
    setProductos((prev) => prev.map((p) => (p.id === snap!.productoId ? updated : p)));
    toast.success("Precio actualizado y registrado en historial");
  }

  async function handleCreate() {
    if (!form.nombre.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/admin/stock/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.nombre.trim(),
        categoria_id: form.categoria_id || null,
        precio: parseFloat(form.precio) || 0,
        costo_con_iva: form.costo_con_iva ? parseFloat(form.costo_con_iva) : null,
        iva_alicuota_id: form.iva_alicuota_id || null,
        stock_actual: parseInt(form.stock_actual) || 0,
        tiene_stock: form.tiene_stock,
        unidad: form.unidad,
        activo: form.activo,
      }),
    });
    setCreating(false);
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Error al crear producto");
      return;
    }
    const nuevo: Producto = await res.json();
    setProductos((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setSheetOpen(false);
    setForm({
      nombre: "", categoria_id: "", precio: "", costo_con_iva: "",
      iva_alicuota_id: "", stock_actual: "0", tiene_stock: true, unidad: "unidad", activo: true,
    });
    toast.success("Producto creado");
  }

  if (loading) return <p className="text-muted-foreground text-sm">Cargando...</p>;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categorias.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode((v) => !v)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            {editMode ? "Salir edición" : "Modo edición rápida"}
          </Button>
          <Button size="sm" onClick={() => setSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Producto
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Nombre</th>
              <th className="text-left p-3 font-medium">Categoría</th>
              <th className="text-right p-3 font-medium">Precio</th>
              <th className="text-right p-3 font-medium">Costo c/IVA</th>
              <th className="text-right p-3 font-medium">Margen</th>
              <th className="text-right p-3 font-medium">Stock</th>
              <th className="text-center p-3 font-medium">Activo</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center p-6 text-muted-foreground">
                  No hay productos
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="p-3 font-medium">{p.nombre}</td>
                <td className="p-3">
                  {p.categoria ? (
                    <Badge
                      style={{ backgroundColor: p.categoria.color, color: "#fff" }}
                      className="text-xs"
                    >
                      {p.categoria.nombre}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  {editMode ? (
                    <Input
                      type="number"
                      className="w-24 text-right ml-auto h-7 text-sm"
                      value={editValues[p.id]?.precio ?? String(p.precio)}
                      onChange={(e) =>
                        setEditValues((prev) => ({
                          ...prev,
                          [p.id]: { ...prev[p.id], precio: e.target.value },
                        }))
                      }
                      onBlur={(e) => saveInlineField(p.id, "precio", e.target.value)}
                    />
                  ) : (
                    `$${p.precio.toLocaleString("es-AR")}`
                  )}
                </td>
                <td className="p-3 text-right text-muted-foreground">
                  {p.costo_con_iva != null ? `$${p.costo_con_iva.toLocaleString("es-AR")}` : "—"}
                </td>
                <td className="p-3 text-right">
                  {p.margen != null ? (
                    <span className={p.margen < 20 ? "text-red-500" : "text-green-600"}>
                      {p.margen}%
                    </span>
                  ) : "—"}
                </td>
                <td className="p-3 text-right">
                  {p.tiene_stock ? (
                    editMode ? (
                      <Input
                        type="number"
                        className="w-20 text-right ml-auto h-7 text-sm"
                        value={editValues[p.id]?.stock ?? String(p.stock_actual)}
                        onChange={(e) =>
                          setEditValues((prev) => ({
                            ...prev,
                            [p.id]: { ...prev[p.id], stock: e.target.value },
                          }))
                        }
                        onBlur={(e) => saveInlineField(p.id, "stock_actual", e.target.value)}
                      />
                    ) : (
                      p.stock_actual
                    )
                  ) : (
                    <span className="text-muted-foreground text-xs">∞</span>
                  )}
                </td>
                <td className="p-3 text-center">
                  <Badge variant={p.activo ? "default" : "secondary"}>
                    {p.activo ? "Sí" : "No"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {saving && <p className="text-xs text-muted-foreground">Guardando...</p>}

      {/* Price change confirmation dialog */}
      <Dialog open={!!pendingPrice} onOpenChange={(open) => { if (!open) setPendingPrice(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Actualizar precio</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esto actualizará el precio del producto y registrará el cambio en el historial de precios
            con fecha de hoy. ¿Confirmar?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPrice(null)}>Cancelar</Button>
            <Button onClick={confirmPriceChange} disabled={saving}>
              {saving ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New product Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Nuevo producto</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Nombre *</label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre del producto"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Categoría</label>
              <Select
                value={form.categoria_id || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, categoria_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Precio de venta *</label>
              <Input
                type="number"
                value={form.precio}
                onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Costo con IVA</label>
              <Input
                type="number"
                value={form.costo_con_iva}
                onChange={(e) => setForm((f) => ({ ...f, costo_con_iva: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Alícuota IVA</label>
              <Select
                value={form.iva_alicuota_id || "none"}
                onValueChange={(v) => setForm((f) => ({ ...f, iva_alicuota_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin IVA" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin IVA</SelectItem>
                  {ivaAlicuotas.map((iva) => (
                    <SelectItem key={iva.id} value={iva.id}>{iva.nombre} ({iva.porcentaje}%)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Stock inicial</label>
              <Input
                type="number"
                value={form.stock_actual}
                onChange={(e) => setForm((f) => ({ ...f, stock_actual: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Unidad</label>
              <Select
                value={form.unidad}
                onValueChange={(v) => setForm((f) => ({ ...f, unidad: v as "unidad" | "kg" | "litro" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unidad">Unidad</SelectItem>
                  <SelectItem value="kg">Kilogramo</SelectItem>
                  <SelectItem value="litro">Litro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="tiene_stock"
                checked={form.tiene_stock}
                onChange={(e) => setForm((f) => ({ ...f, tiene_stock: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="tiene_stock" className="text-sm">Controla stock</label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activo_prod"
                checked={form.activo}
                onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
                className="h-4 w-4"
              />
              <label htmlFor="activo_prod" className="text-sm">Activo</label>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full">
              {creating ? "Creando..." : "Crear producto"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
