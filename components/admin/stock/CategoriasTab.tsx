"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, Check, X, Pencil } from "lucide-react";
import type { Categoria } from "@/lib/types";
import { TabLoader } from "@/components/ui/tab-loader";

type EditRow = {
  nombre: string;
  color: string;
  orden: string;
  activo: boolean;
};

type RowState = "view" | "edit";

export function CategoriasTab() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});
  const [editValues, setEditValues] = useState<Record<string, EditRow>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});

  // New row state
  const [addingNew, setAddingNew] = useState(false);
  const [newRow, setNewRow] = useState<EditRow>({ nombre: "", color: "#6b7280", orden: "0", activo: true });
  const [creatingNew, setCreatingNew] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const res = await fetch("/api/admin/stock/categorias");
      if (res.ok) setCategorias(await res.json());
      setLoading(false);
    };
    load();
  }, []);

  function startEdit(cat: Categoria) {
    setRowStates((s) => ({ ...s, [cat.id]: "edit" }));
    setEditValues((v) => ({
      ...v,
      [cat.id]: {
        nombre: cat.nombre,
        color: cat.color,
        orden: String(cat.orden),
        activo: cat.activo,
      },
    }));
  }

  function cancelEdit(catId: string) {
    setRowStates((s) => ({ ...s, [catId]: "view" }));
  }

  async function saveEdit(cat: Categoria) {
    const vals = editValues[cat.id];
    if (!vals) return;
    if (!vals.nombre.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setSaving((s) => ({ ...s, [cat.id]: true }));
    const res = await fetch(`/api/admin/stock/categorias/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: vals.nombre.trim(),
        color: vals.color,
        orden: parseInt(vals.orden) || 0,
        activo: vals.activo,
      }),
    });
    setSaving((s) => ({ ...s, [cat.id]: false }));
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Error al guardar");
      return;
    }
    const updated: Categoria = await res.json();
    setCategorias((prev) =>
      prev.map((c) => (c.id === cat.id ? updated : c)).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
    );
    setRowStates((s) => ({ ...s, [cat.id]: "view" }));
    toast.success("Categoría actualizada");
  }

  async function handleDelete(cat: Categoria) {
    if (!window.confirm(`¿Eliminar "${cat.nombre}"?`)) return;
    setDeleting((s) => ({ ...s, [cat.id]: true }));
    const res = await fetch(`/api/admin/stock/categorias/${cat.id}`, { method: "DELETE" });
    setDeleting((s) => ({ ...s, [cat.id]: false }));
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "No se pudo eliminar");
      return;
    }
    setCategorias((prev) => prev.filter((c) => c.id !== cat.id));
    toast.success("Categoría eliminada");
  }

  async function handleCreate() {
    if (!newRow.nombre.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setCreatingNew(true);
    const res = await fetch("/api/admin/stock/categorias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: newRow.nombre.trim(),
        color: newRow.color,
        orden: parseInt(newRow.orden) || 0,
      }),
    });
    setCreatingNew(false);
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Error al crear");
      return;
    }
    const nueva: Categoria = await res.json();
    setCategorias((prev) =>
      [...prev, nueva].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre))
    );
    setAddingNew(false);
    setNewRow({ nombre: "", color: "#6b7280", orden: "0", activo: true });
    toast.success("Categoría creada");
  }

  if (loading) return <TabLoader />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddingNew(true)} disabled={addingNew}>
          <Plus className="h-4 w-4 mr-1" />
          Categoría
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Nombre</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Color</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Orden</th>
              <th className="text-center px-4 py-2.5 text-xs font-medium text-muted-foreground">Activo</th>
              <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categorias.length === 0 && !addingNew && (
              <tr>
                <td colSpan={5} className="text-center p-6 text-muted-foreground">
                  No hay categorías
                </td>
              </tr>
            )}
            {categorias.map((cat) => {
              const state = rowStates[cat.id] ?? "view";
              const vals = editValues[cat.id];
              const isSaving = saving[cat.id] ?? false;
              const isDeleting = deleting[cat.id] ?? false;

              return (
                <tr key={cat.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    {state === "edit" ? (
                      <Input
                        value={vals?.nombre ?? cat.nombre}
                        onChange={(e) =>
                          setEditValues((v) => ({ ...v, [cat.id]: { ...v[cat.id], nombre: e.target.value } }))
                        }
                        className="h-7 text-sm w-40"
                      />
                    ) : (
                      <span className="font-medium">{cat.nombre}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {state === "edit" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={vals?.color ?? cat.color}
                          onChange={(e) =>
                            setEditValues((v) => ({ ...v, [cat.id]: { ...v[cat.id], color: e.target.value } }))
                          }
                          className="h-7 w-10 cursor-pointer rounded border"
                        />
                        <span className="text-xs text-muted-foreground">{vals?.color ?? cat.color}</span>
                      </div>
                    ) : (
                      <Badge style={{ backgroundColor: cat.color, color: "#fff" }} className="text-xs">
                        {cat.color}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {state === "edit" ? (
                      <Input
                        type="number"
                        value={vals?.orden ?? String(cat.orden)}
                        onChange={(e) =>
                          setEditValues((v) => ({ ...v, [cat.id]: { ...v[cat.id], orden: e.target.value } }))
                        }
                        className="h-7 text-sm w-16"
                      />
                    ) : (
                      cat.orden
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {state === "edit" ? (
                      <input
                        type="checkbox"
                        checked={vals?.activo ?? cat.activo}
                        onChange={(e) =>
                          setEditValues((v) => ({ ...v, [cat.id]: { ...v[cat.id], activo: e.target.checked } }))
                        }
                        className="h-4 w-4"
                      />
                    ) : (
                      <Badge variant={cat.activo ? "default" : "secondary"}>
                        {cat.activo ? "Sí" : "No"}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      {state === "edit" ? (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => saveEdit(cat)}
                            disabled={isSaving}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => cancelEdit(cat.id)}>
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(cat)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(cat)}
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* New row */}
            {addingNew && (
              <tr className="border-b border-border bg-muted/10">
                <td className="px-4 py-2.5">
                  <Input
                    value={newRow.nombre}
                    onChange={(e) => setNewRow((r) => ({ ...r, nombre: e.target.value }))}
                    placeholder="Nombre"
                    className="h-7 text-sm w-40"
                    autoFocus
                  />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newRow.color}
                      onChange={(e) => setNewRow((r) => ({ ...r, color: e.target.value }))}
                      className="h-7 w-10 cursor-pointer rounded border"
                    />
                    <span className="text-xs text-muted-foreground">{newRow.color}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Input
                    type="number"
                    value={newRow.orden}
                    onChange={(e) => setNewRow((r) => ({ ...r, orden: e.target.value }))}
                    className="h-7 text-sm w-16"
                  />
                </td>
                <td className="px-4 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={newRow.activo}
                    onChange={(e) => setNewRow((r) => ({ ...r, activo: e.target.checked }))}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={handleCreate} disabled={creatingNew}>
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setAddingNew(false); setNewRow({ nombre: "", color: "#6b7280", orden: "0", activo: true }); }}>
                      <X className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
