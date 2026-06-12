"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, UserX, UserCheck, MoreVertical } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Empleado = {
  id: string;
  telefono: string;
  nombre: string;
  rol: string;
  activo: boolean;
  created_at: string;
};

const empleadoSchema = z.object({
  nombre: z.string().min(2, "Mínimo 2 caracteres"),
  telefono: z.string().min(10, "Teléfono inválido"),
  pin: z.string().min(4, "PIN mínimo 4 dígitos").max(8),
  rol: z.enum(["admin", "superadmin"]),
});

type EmpleadoForm = z.infer<typeof empleadoSchema>;

export default function EmpleadosClient({
  empleados,
  sessionId,
}: {
  empleados: Empleado[];
  sessionId: string;
}) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<Empleado | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<EmpleadoForm>({
    resolver: zodResolver(empleadoSchema),
    defaultValues: { rol: "admin" },
  });

  function abrirCrear() {
    setEditando(null);
    form.reset({ nombre: "", telefono: "", pin: "", rol: "admin" });
    setDialogOpen(true);
  }

  function abrirEditar(e: Empleado) {
    setEditando(e);
    form.reset({ nombre: e.nombre, telefono: e.telefono, pin: "", rol: e.rol as "admin" | "superadmin" });
    setDialogOpen(true);
  }

  async function onSubmit(data: EmpleadoForm) {
    setLoading(true);
    const url = editando ? `/api/admin/empleados/${editando.id}` : "/api/admin/empleados";
    const method = editando ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "Error al guardar");
    } else {
      toast.success(editando ? "Empleado actualizado" : "Empleado creado");
      setDialogOpen(false);
      router.refresh();
    }
    setLoading(false);
  }

  async function toggleActivo(e: Empleado) {
    if (e.id === sessionId) {
      toast.error("No podés desactivar tu propia cuenta");
      return;
    }
    const res = await fetch(`/api/admin/empleados/${e.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !e.activo }),
    });
    if (res.ok) {
      toast.success(e.activo ? "Empleado desactivado" : "Empleado activado");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-base font-semibold">Empleados</h1>
          <Button size="sm" className="gap-1.5 h-8" onClick={abrirCrear}>
            <Plus size={14} />
            Nuevo empleado
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {empleados.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            Sin empleados
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nombre</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">Teléfono</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Rol</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden md:table-cell">Estado</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {empleados.map((emp) => (
                <tr
                  key={emp.id}
                  className={cn(
                    "odd:bg-background even:bg-muted/30 hover:bg-accent/40 transition-colors",
                    !emp.activo && "opacity-50"
                  )}
                >
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{emp.nombre}</span>
                    {emp.id === sessionId && (
                      <span className="ml-2 text-[10px] text-muted-foreground">(vos)</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono hidden sm:table-cell text-muted-foreground">
                    {emp.telefono}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge
                      variant={emp.rol === "superadmin" ? "default" : "secondary"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {emp.rol === "superadmin" ? "Super Admin" : "Empleado"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 hidden md:table-cell">
                    <span className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded",
                      emp.activo
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {emp.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {/* Desktop */}
                    <div className="hidden sm:flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => abrirEditar(emp)} title="Editar">
                        <Pencil size={12} />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className={cn("h-6 w-6 text-muted-foreground", emp.activo ? "hover:text-destructive" : "hover:text-green-600")}
                        onClick={() => toggleActivo(emp)}
                        disabled={emp.id === sessionId}
                        title={emp.activo ? "Desactivar" : "Activar"}
                      >
                        {emp.activo ? <UserX size={12} /> : <UserCheck size={12} />}
                      </Button>
                    </div>
                    {/* Mobile */}
                    <div className="flex sm:hidden items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical size={13} /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => abrirEditar(emp)}>
                            <Pencil size={13} className="mr-2" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={emp.id === sessionId}
                            className={emp.activo ? "text-destructive focus:text-destructive" : "text-green-600 focus:text-green-600"}
                            onClick={() => toggleActivo(emp)}
                          >
                            {emp.activo ? <UserX size={13} className="mr-2" /> : <UserCheck size={13} className="mr-2" />}
                            {emp.activo ? "Desactivar" : "Activar"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar empleado" : "Nuevo empleado"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Nombre</label>
              <Input {...form.register("nombre")} placeholder="Juan Pérez" className="h-8 text-sm" />
              {form.formState.errors.nombre && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.nombre.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Teléfono</label>
              <Input {...form.register("telefono")} placeholder="5491100000000" className="h-8 text-sm" />
              {form.formState.errors.telefono && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.telefono.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                PIN{" "}
                {editando && (
                  <span className="text-muted-foreground font-normal">(dejar vacío para no cambiar)</span>
                )}
              </label>
              <Input
                {...form.register("pin")}
                type="password"
                placeholder="••••"
                maxLength={8}
                className="h-8 text-sm"
              />
              {form.formState.errors.pin && (
                <p className="text-xs text-destructive mt-1">{form.formState.errors.pin.message}</p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Rol</label>
              <Select
                value={form.watch("rol")}
                onValueChange={(v) => form.setValue("rol", v as "admin" | "superadmin")}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Empleado</SelectItem>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? "Guardando..." : editando ? "Guardar cambios" : "Crear empleado"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
