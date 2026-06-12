"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Search, Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

type Cliente = {
  id: string;
  nombre: string | null;
  telefono: string;
  created_at: string;
  reservas_count?: number;
};

type ModalState =
  | { mode: "create" }
  | { mode: "edit"; cliente: Cliente }
  | null;

export default function ClientesClient({ clientes: initialClientes }: { clientes: Cliente[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [modal, setModal] = useState<ModalState>(null);
  const [formNombre, setFormNombre] = useState("");
  const [formTelefono, setFormTelefono] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return initialClientes;
    const q = busqueda.toLowerCase();
    return initialClientes.filter(
      (c) =>
        c.nombre?.toLowerCase().includes(q) ||
        c.telefono.includes(q)
    );
  }, [initialClientes, busqueda]);

  function openCreate() {
    setFormNombre("");
    setFormTelefono("");
    setModal({ mode: "create" });
  }

  function openEdit(c: Cliente) {
    setFormNombre(c.nombre ?? "");
    setFormTelefono(c.telefono);
    setModal({ mode: "edit", cliente: c });
  }

  function closeModal() {
    setModal(null);
    setFormNombre("");
    setFormTelefono("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formTelefono.trim()) {
      toast.error("Teléfono requerido");
      return;
    }
    setLoading(true);
    try {
      if (modal?.mode === "create") {
        const res = await fetch("/api/admin/clientes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telefono: formTelefono.trim(), nombre: formNombre.trim() || null }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? "Error al crear cliente");
          return;
        }
        toast.success("Cliente creado");
      } else if (modal?.mode === "edit") {
        const res = await fetch(`/api/admin/clientes/${modal.cliente.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telefono: formTelefono.trim(), nombre: formNombre.trim() || null }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? "Error al actualizar");
          return;
        }
        toast.success("Cliente actualizado");
      }
      closeModal();
      router.refresh();
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (deletingId === id) {
      // Second click = confirm
      try {
        const res = await fetch(`/api/admin/clientes/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error ?? "No se pudo eliminar");
          return;
        }
        toast.success("Cliente eliminado");
        router.refresh();
      } catch {
        toast.error("Error de red");
      } finally {
        setDeletingId(null);
      }
    } else {
      setDeletingId(id);
      // Reset confirmation after 3s
      setTimeout(() => setDeletingId((prev) => (prev === id ? null : prev)), 3000);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base font-semibold">Clientes</h1>
          <Button size="sm" className="gap-1.5 h-8" onClick={openCreate}>
            <Plus size={14} />
            Nuevo cliente
          </Button>
        </div>
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o teléfono..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filtrados.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Sin clientes
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nombre</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Teléfono</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">Alta</th>
                <th className="px-3 py-2 text-center font-medium text-muted-foreground hidden md:table-cell">Reservas</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtrados.map((c) => (
                <tr key={c.id} className="odd:bg-background even:bg-muted/30 hover:bg-accent/40 transition-colors">
                  <td className="px-3 py-2.5 font-medium">{c.nombre ?? <span className="text-muted-foreground italic">Sin nombre</span>}</td>
                  <td className="px-3 py-2.5 font-mono">{c.telefono}</td>
                  <td className="px-3 py-2.5 hidden sm:table-cell text-muted-foreground">
                    {format(parseISO(c.created_at), "dd/MM/yyyy")}
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell text-center">
                    {c.reservas_count != null && c.reservas_count > 0 ? (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold">
                        {c.reservas_count}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(c)}
                        title="Editar"
                      >
                        <Pencil size={12} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={
                          deletingId === c.id
                            ? "h-6 w-6 text-destructive bg-destructive/10"
                            : "h-6 w-6 text-muted-foreground hover:text-destructive"
                        }
                        onClick={() => handleDelete(c.id)}
                        title={deletingId === c.id ? "¿Confirmar?" : "Eliminar"}
                      >
                        {deletingId === c.id ? <X size={12} /> : <Trash2 size={12} />}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit modal */}
      <Dialog open={modal !== null} onOpenChange={(v) => { if (!v) closeModal(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{modal?.mode === "create" ? "Nuevo cliente" : "Editar cliente"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Nombre</label>
              <Input
                placeholder="Nombre completo"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Teléfono *</label>
              <Input
                placeholder="+54 9 ..."
                value={formTelefono}
                onChange={(e) => setFormTelefono(e.target.value)}
                className="h-8 text-sm"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={closeModal} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Guardando..." : modal?.mode === "create" ? "Crear" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
