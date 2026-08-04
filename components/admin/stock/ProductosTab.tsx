"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Pencil, History, ArrowLeft, Check, X } from "lucide-react";
import type { Producto, Categoria, IvaAlicuota } from "@/lib/types";
import { TabLoader } from "@/components/ui/tab-loader";

type PrecioHistorial = { id: string; precio: number; vigente_desde: string; created_at: string };
type CompraHistorial = {
  id: string; cantidad: number; costo_con_iva: number; costo_neto: number;
  compra: { id: string; fecha: string; proveedor: string | null; created_at: string } | null;
};
type Historial = { precios: PrecioHistorial[]; compras: CompraHistorial[] };

type PendingPriceEdit = { productoId: string; newPrecio: number };

type ProductoForm = {
  nombre: string;
  categoria_id: string;
  precio: string;
  costo_con_iva: string;
  iva_alicuota_id: string;
  stock_actual: string;
  tiene_stock: boolean;
  unidad: "unidad" | "kg" | "litro";
  activo: boolean;
};

const EMPTY_FORM: ProductoForm = {
  nombre: "", categoria_id: "", precio: "", costo_con_iva: "",
  iva_alicuota_id: "", stock_actual: "0", tiene_stock: true, unidad: "unidad", activo: true,
};

function productoToForm(p: Producto): ProductoForm {
  return {
    nombre: p.nombre,
    categoria_id: p.categoria_id ?? "",
    precio: String(p.precio),
    costo_con_iva: p.costo_con_iva != null ? String(p.costo_con_iva) : "",
    iva_alicuota_id: p.iva_alicuota_id ?? "",
    stock_actual: String(p.stock_actual),
    tiene_stock: p.tiene_stock,
    unidad: p.unidad ?? "unidad",
    activo: p.activo,
  };
}

// Shared form fields JSX extracted to avoid duplication
function ProductoFormFields({
  form,
  setForm,
  categorias,
  ivaAlicuotas,
  isEdit,
}: {
  form: ProductoForm;
  setForm: (fn: (f: ProductoForm) => ProductoForm) => void;
  categorias: Categoria[];
  ivaAlicuotas: IvaAlicuota[];
  isEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Nombre *</label>
        <Input
          value={form.nombre}
          onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
          placeholder="Nombre del producto"
          className="h-8 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Categoría</label>
        <Select
          value={form.categoria_id || "none"}
          onValueChange={(v) => setForm((f) => ({ ...f, categoria_id: v === "none" ? "" : v }))}
        >
          <SelectTrigger className="w-full h-8 text-sm">
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            Precio de venta {!isEdit && "*"}
          </label>
          <Input
            type="number"
            value={form.precio}
            onChange={(e) => setForm((f) => ({ ...f, precio: e.target.value }))}
            placeholder="0"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Costo con IVA</label>
          <Input
            type="number"
            value={form.costo_con_iva}
            onChange={(e) => setForm((f) => ({ ...f, costo_con_iva: e.target.value }))}
            placeholder="0"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground block mb-1">Alícuota IVA</label>
        <Select
          value={form.iva_alicuota_id || "none"}
          onValueChange={(v) => setForm((f) => ({ ...f, iva_alicuota_id: v === "none" ? "" : v }))}
        >
          <SelectTrigger className="w-full h-8 text-sm">
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">
            {isEdit ? "Stock actual" : "Stock inicial"}
          </label>
          <Input
            type="number"
            value={form.stock_actual}
            onChange={(e) => setForm((f) => ({ ...f, stock_actual: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Unidad</label>
          <Select
            value={form.unidad}
            onValueChange={(v) => setForm((f) => ({ ...f, unidad: v as "unidad" | "kg" | "litro" }))}
          >
            <SelectTrigger className="w-full h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unidad">Unidad</SelectItem>
              <SelectItem value="kg">Kilogramo</SelectItem>
              <SelectItem value="litro">Litro</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center gap-4 pt-1">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.tiene_stock}
            onChange={(e) => setForm((f) => ({ ...f, tiene_stock: e.target.checked }))}
            className="h-3.5 w-3.5 accent-green-700"
          />
          Controla stock
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))}
            className="h-3.5 w-3.5 accent-green-700"
          />
          Activo
        </label>
      </div>
    </div>
  );
}

export function ProductosTab() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ivaAlicuotas, setIvaAlicuotas] = useState<IvaAlicuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [filterCategoria, setFilterCategoria] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [pendingPrice, setPendingPrice] = useState<PendingPriceEdit | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline quick-edit state
  const [editValues, setEditValues] = useState<Record<string, { precio: string; stock: string }>>({});

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<ProductoForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  // Edit modal + historial navigation
  const [editingProducto, setEditingProducto] = useState<Producto | null>(null);
  const [editForm, setEditForm] = useState<ProductoForm>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editView, setEditView] = useState<"form" | "historial">("form");

  // Historial data (shared for edit modal)
  const [historial, setHistorial] = useState<Historial | null>(null);
  const [historialLoading, setHistorialLoading] = useState(false);

  // Inline edit within historial rows
  const [editPrecioId, setEditPrecioId] = useState<string | null>(null);
  const [editPrecioVal, setEditPrecioVal] = useState({ precio: "", vigente_desde: "" });
  const [editCompraId, setEditCompraId] = useState<string | null>(null);
  const [editCompraVal, setEditCompraVal] = useState({ costo_con_iva: "", cantidad: "" });
  const [savingHistorial, setSavingHistorial] = useState(false);

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
      if (iRes.ok) {
        const alicuotas: IvaAlicuota[] = await iRes.json();
        setIvaAlicuotas(alicuotas);
        const iva21 = alicuotas.find((a) => a.porcentaje === 21);
        if (iva21) setCreateForm((f) => ({ ...f, iva_alicuota_id: iva21.id }));
      }
      setLoading(false);
    };
    load();
  }, []);

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

  // --- Quick inline edit ---
  async function saveInlineField(productoId: string, field: "precio" | "stock_actual", rawValue: string) {
    const numVal = parseFloat(rawValue);
    if (isNaN(numVal)) return;
    const current = productos.find((p) => p.id === productoId);
    if (!current) return;
    if (field === "precio" && numVal !== current.precio) {
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
    if (!res.ok) { const err = await res.json(); toast.error(err.error ?? "Error al guardar"); return; }
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
    if (!res.ok) { const err = await res.json(); toast.error(err.error ?? "Error al guardar precio"); return; }
    const updated: Producto = await res.json();
    setProductos((prev) => prev.map((p) => (p.id === snap!.productoId ? updated : p)));
    toast.success("Precio actualizado y registrado en historial");
  }

  // --- Create ---
  async function handleCreate() {
    if (!createForm.nombre.trim()) { toast.error("Nombre requerido"); return; }
    setCreating(true);
    const res = await fetch("/api/admin/stock/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: createForm.nombre.trim(),
        categoria_id: createForm.categoria_id || null,
        precio: parseFloat(createForm.precio) || 0,
        costo_con_iva: createForm.costo_con_iva ? parseFloat(createForm.costo_con_iva) : null,
        iva_alicuota_id: createForm.iva_alicuota_id || null,
        stock_actual: parseInt(createForm.stock_actual) || 0,
        tiene_stock: createForm.tiene_stock,
        unidad: createForm.unidad,
        activo: createForm.activo,
      }),
    });
    setCreating(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error ?? "Error al crear producto"); return; }
    const nuevo: Producto = await res.json();
    setProductos((prev) => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setCreateOpen(false);
    const iva21 = ivaAlicuotas.find((a) => a.porcentaje === 21);
    setCreateForm({ ...EMPTY_FORM, iva_alicuota_id: iva21?.id ?? "" });
    toast.success("Producto creado");
  }

  // --- Open edit modal ---
  function openEdit(p: Producto) {
    setEditingProducto(p);
    setEditForm(productoToForm(p));
    setEditView("form");
    setHistorial(null);
  }

  // --- Save edit ---
  async function handleEdit() {
    if (!editingProducto || !editForm.nombre.trim()) { toast.error("Nombre requerido"); return; }
    setEditSaving(true);
    const res = await fetch(`/api/admin/stock/productos/${editingProducto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: editForm.nombre.trim(),
        categoria_id: editForm.categoria_id || null,
        precio: parseFloat(editForm.precio) || 0,
        costo_con_iva: editForm.costo_con_iva ? parseFloat(editForm.costo_con_iva) : null,
        iva_alicuota_id: editForm.iva_alicuota_id || null,
        stock_actual: parseInt(editForm.stock_actual) || 0,
        tiene_stock: editForm.tiene_stock,
        unidad: editForm.unidad,
        activo: editForm.activo,
      }),
    });
    setEditSaving(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error ?? "Error al guardar"); return; }
    const updated: Producto = await res.json();
    setProductos((prev) => prev.map((p) => (p.id === updated.id ? updated : p)).sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setEditingProducto(null);
    toast.success("Producto actualizado");
  }

  // --- Load historial ---
  async function loadHistorial(productoId: string) {
    setHistorialLoading(true);
    setHistorial(null);
    const res = await fetch(`/api/admin/stock/productos/${productoId}/historial`);
    if (res.ok) setHistorial(await res.json());
    setHistorialLoading(false);
  }

  function goToHistorial() {
    setEditView("historial");
    setEditPrecioId(null);
    setEditCompraId(null);
    if (editingProducto) loadHistorial(editingProducto.id);
  }

  // --- Historial inline edit: precio de venta ---
  function startEditPrecio(h: PrecioHistorial) {
    setEditPrecioId(h.id);
    setEditPrecioVal({ precio: String(h.precio), vigente_desde: h.vigente_desde });
  }

  async function savePrecio(id: string) {
    const precio = parseFloat(editPrecioVal.precio);
    if (isNaN(precio)) { toast.error("Precio inválido"); return; }
    setSavingHistorial(true);
    const res = await fetch(`/api/admin/stock/producto-precios/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precio, vigente_desde: editPrecioVal.vigente_desde }),
    });
    setSavingHistorial(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error ?? "Error al guardar"); return; }
    const updated: PrecioHistorial = await res.json();
    setHistorial((prev) => prev ? {
      ...prev,
      precios: prev.precios.map((h) => h.id === id ? updated : h),
    } : prev);
    setEditPrecioId(null);
    toast.success("Precio actualizado");
  }

  // --- Historial inline edit: precio de compra ---
  function startEditCompra(c: CompraHistorial) {
    setEditCompraId(c.id);
    setEditCompraVal({ costo_con_iva: String(c.costo_con_iva), cantidad: String(c.cantidad) });
  }

  async function saveCompra(id: string) {
    const costo_con_iva = parseFloat(editCompraVal.costo_con_iva);
    const cantidad = parseInt(editCompraVal.cantidad);
    if (isNaN(costo_con_iva) || isNaN(cantidad)) { toast.error("Valores inválidos"); return; }
    setSavingHistorial(true);
    const res = await fetch(`/api/admin/stock/compra-items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ costo_con_iva, cantidad }),
    });
    setSavingHistorial(false);
    if (!res.ok) { const err = await res.json(); toast.error(err.error ?? "Error al guardar"); return; }
    const updated: CompraHistorial = await res.json();
    setHistorial((prev) => prev ? {
      ...prev,
      compras: prev.compras.map((c) => c.id === id ? updated : c),
    } : prev);
    setEditCompraId(null);
    toast.success("Compra actualizada");
  }

  if (loading) return <TabLoader />;

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
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Producto
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nombre</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Categoría</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Precio</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Costo c/IVA</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Margen</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Stock</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Activo</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center p-6 text-muted-foreground">No hay productos</td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5 font-medium">{p.nombre}</td>
                <td className="px-4 py-2.5">
                  {p.categoria ? (
                    <Badge style={{ backgroundColor: p.categoria.color, color: "#fff" }} className="text-xs">
                      {p.categoria.nombre}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {editMode ? (
                    <Input
                      type="number"
                      className="w-24 text-right ml-auto h-7 text-sm"
                      value={editValues[p.id]?.precio ?? String(p.precio)}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [p.id]: { ...prev[p.id], precio: e.target.value } }))}
                      onBlur={(e) => saveInlineField(p.id, "precio", e.target.value)}
                    />
                  ) : (
                    `$${p.precio.toLocaleString("es-AR")}`
                  )}
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">
                  {p.costo_con_iva != null ? `$${p.costo_con_iva.toLocaleString("es-AR")}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {p.margen != null ? (
                    <span className={p.margen < 20 ? "text-red-500" : "text-green-600"}>{p.margen}%</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {p.tiene_stock ? (
                    editMode ? (
                      <Input
                        type="number"
                        className="w-20 text-right ml-auto h-7 text-sm"
                        value={editValues[p.id]?.stock ?? String(p.stock_actual)}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [p.id]: { ...prev[p.id], stock: e.target.value } }))}
                        onBlur={(e) => saveInlineField(p.id, "stock_actual", e.target.value)}
                      />
                    ) : (
                      <span className={p.stock_actual < 0 ? "text-red-500 font-medium" : undefined}>
                        {p.stock_actual}
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground text-xs">∞</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Badge variant={p.activo ? "default" : "secondary"}>
                    {p.activo ? "Sí" : "No"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => openEdit(p)}
                    title="Editar producto"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {saving && <p className="text-xs text-muted-foreground">Guardando...</p>}

      {/* Price change confirmation dialog (inline quick-edit) */}
      <Dialog open={!!pendingPrice} onOpenChange={(open) => { if (!open) setPendingPrice(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Actualizar precio</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esto actualizará el precio del producto y registrará el cambio en el historial de precios con fecha de hoy. ¿Confirmar?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingPrice(null)}>Cancelar</Button>
            <Button onClick={confirmPriceChange} disabled={saving}>
              {saving ? "Guardando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create product dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) setCreateOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuevo producto</DialogTitle></DialogHeader>
          <ProductoFormFields
            form={createForm}
            setForm={setCreateForm}
            categorias={categorias}
            ivaAlicuotas={ivaAlicuotas}
            isEdit={false}
          />
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? "Creando..." : "Crear producto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit product dialog — has two views: form | historial */}
      <Dialog open={!!editingProducto} onOpenChange={(v) => { if (!v) setEditingProducto(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editView === "historial" && (
                <button
                  onClick={() => setEditView("form")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Volver al formulario"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              {editView === "form" ? `Editar — ${editingProducto?.nombre}` : `Historial — ${editingProducto?.nombre}`}
            </DialogTitle>
          </DialogHeader>

          {editView === "form" ? (
            <>
              <ProductoFormFields
                form={editForm}
                setForm={setEditForm}
                categorias={categorias}
                ivaAlicuotas={ivaAlicuotas}
                isEdit
              />
              <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="sm:mr-auto"
                  onClick={goToHistorial}
                >
                  <History className="h-3.5 w-3.5 mr-1.5" />
                  Ver historial de precios
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingProducto(null)} disabled={editSaving}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={handleEdit} disabled={editSaving}>
                  {editSaving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            /* Historial view */
            historialLoading ? (
              <TabLoader />
            ) : historial ? (
              <>
                <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
                  {/* Precio de venta */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Precio de venta</p>
                    {historial.precios.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin registros</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left pb-1.5 text-xs text-muted-foreground font-medium">Fecha vigencia</th>
                            <th className="text-right pb-1.5 text-xs text-muted-foreground font-medium">Precio</th>
                            <th className="w-14"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {historial.precios.map((h) => (
                            <tr key={h.id} className="border-b last:border-0">
                              {editPrecioId === h.id ? (
                                <>
                                  <td className="py-1.5">
                                    <Input
                                      type="date"
                                      value={editPrecioVal.vigente_desde}
                                      onChange={(e) => setEditPrecioVal((v) => ({ ...v, vigente_desde: e.target.value }))}
                                      className="h-7 text-xs w-36"
                                    />
                                  </td>
                                  <td className="py-1.5 text-right">
                                    <Input
                                      type="number"
                                      value={editPrecioVal.precio}
                                      onChange={(e) => setEditPrecioVal((v) => ({ ...v, precio: e.target.value }))}
                                      className="h-7 text-xs w-24 text-right ml-auto"
                                    />
                                  </td>
                                  <td className="py-1.5 text-right">
                                    <div className="flex gap-1 justify-end">
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600" onClick={() => savePrecio(h.id)} disabled={savingHistorial}>
                                        <Check className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditPrecioId(null)}>
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-1.5 text-muted-foreground">
                                    {new Date(h.vigente_desde + "T00:00:00").toLocaleDateString("es-AR")}
                                  </td>
                                  <td className="py-1.5 text-right font-medium">${h.precio.toLocaleString("es-AR")}</td>
                                  <td className="py-1.5 text-right">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEditPrecio(h)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* Precio de compra */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Precio de compra</p>
                    {historial.compras.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin registros</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left pb-1.5 text-xs text-muted-foreground font-medium">Fecha</th>
                            <th className="text-left pb-1.5 text-xs text-muted-foreground font-medium">Proveedor</th>
                            <th className="text-right pb-1.5 text-xs text-muted-foreground font-medium">Cant.</th>
                            <th className="text-right pb-1.5 text-xs text-muted-foreground font-medium">Costo c/IVA</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {historial.compras.map((c) => (
                            <tr key={c.id} className="border-b last:border-0">
                              {editCompraId === c.id ? (
                                <>
                                  <td className="py-1.5 text-muted-foreground text-xs" colSpan={2}>
                                    {c.compra ? new Date(c.compra.fecha + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                                    {c.compra?.proveedor ? ` · ${c.compra.proveedor}` : ""}
                                  </td>
                                  <td className="py-1.5">
                                    <Input
                                      type="number"
                                      value={editCompraVal.cantidad}
                                      onChange={(e) => setEditCompraVal((v) => ({ ...v, cantidad: e.target.value }))}
                                      className="h-7 text-xs w-16 text-right ml-auto"
                                    />
                                  </td>
                                  <td className="py-1.5">
                                    <Input
                                      type="number"
                                      value={editCompraVal.costo_con_iva}
                                      onChange={(e) => setEditCompraVal((v) => ({ ...v, costo_con_iva: e.target.value }))}
                                      className="h-7 text-xs w-24 text-right ml-auto"
                                    />
                                  </td>
                                  <td className="py-1.5 text-right">
                                    <div className="flex gap-1 justify-end">
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-green-600" onClick={() => saveCompra(c.id)} disabled={savingHistorial}>
                                        <Check className="h-3 w-3" />
                                      </Button>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditCompraId(null)}>
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-1.5 text-muted-foreground">
                                    {c.compra ? new Date(c.compra.fecha + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                                  </td>
                                  <td className="py-1.5 text-muted-foreground">{c.compra?.proveedor ?? "—"}</td>
                                  <td className="py-1.5 text-right">{c.cantidad}</td>
                                  <td className="py-1.5 text-right font-medium">${c.costo_con_iva.toLocaleString("es-AR")}</td>
                                  <td className="py-1.5 text-right">
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => startEditCompra(c)}>
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setEditView("form")}>
                    Volver al producto
                  </Button>
                </DialogFooter>
              </>
            ) : null
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
