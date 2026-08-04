"use client";

import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import type { ProductoPOS } from "@/lib/types";

interface CatalogoListaProps {
  productos: ProductoPOS[];
  onAgregar: (producto: ProductoPOS) => void;
}

export function CatalogoLista({ productos, onAgregar }: CatalogoListaProps) {
  const [busqueda, setBusqueda] = useState("");
  const [debouncedBusqueda, setDebouncedBusqueda] = useState("");
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleBusqueda = useCallback(
    (value: string) => {
      setBusqueda(value);
      if (timer) clearTimeout(timer);
      const t = setTimeout(() => setDebouncedBusqueda(value), 200);
      setTimer(t);
    },
    [timer]
  );

  const productosFiltrados = debouncedBusqueda
    ? productos.filter((p) =>
        p.nombre.toLowerCase().includes(debouncedBusqueda.toLowerCase())
      )
    : productos;

  const formatPrecio = (precio: number) =>
    "$" + precio.toLocaleString("es-AR", { minimumFractionDigits: 0 });

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => handleBusqueda(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="overflow-y-auto flex-1 rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Producto</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground hidden sm:table-cell">Categoría</th>
              <th className="text-right px-3 py-2 font-medium text-muted-foreground">Precio</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {productosFiltrados.map((producto, idx) => (
              <tr
                key={producto.id}
                className={`transition-colors cursor-pointer hover:bg-primary/10 ${idx % 2 === 0 ? "bg-background" : "bg-muted/30"}`}
              >
                <td className="px-3 py-2.5">
                  <div className="font-medium">{producto.nombre}</div>
                  {producto.tiene_stock && (
                    <div className="text-xs text-muted-foreground">Stock: {producto.stock_actual}</div>
                  )}
                </td>
                <td className="px-3 py-2.5 hidden sm:table-cell">
                  <Badge
                    style={{
                      backgroundColor: producto.categoria_color + "33",
                      color: producto.categoria_color,
                    }}
                    className="text-xs border-0"
                  >
                    {producto.categoria_nombre}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-right font-bold">{formatPrecio(producto.precio)}</td>
                <td className="px-3 py-2.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => onAgregar(producto)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
            {productosFiltrados.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-muted-foreground py-8">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
