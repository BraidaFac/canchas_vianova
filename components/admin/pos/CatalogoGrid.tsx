"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ProductoPOS, CarritoItem } from "@/lib/types";

interface CatalogoGridProps {
  productos: ProductoPOS[];
  carrito: CarritoItem[];
  onAgregar: (producto: ProductoPOS) => void;
}

export function CatalogoGrid({ productos, carrito, onAgregar }: CatalogoGridProps) {
  const [tabActiva, setTabActiva] = useState<string>("Todos");

  const categorias = ["Todos", ...Array.from(new Set(productos.map((p) => p.categoria_nombre))).sort()];

  const productosFiltrados =
    tabActiva === "Todos" ? productos : productos.filter((p) => p.categoria_nombre === tabActiva);

  const cantidadEnCarrito = (productoId: string): number => {
    const item = carrito.find((c) => c.producto.id === productoId);
    return item?.cantidad ?? 0;
  };

  const formatPrecio = (precio: number) =>
    "$" + precio.toLocaleString("es-AR", { minimumFractionDigits: 0 });

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {categorias.map((cat) => (
          <button
            key={cat}
            onClick={() => setTabActiva(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tabActiva === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto flex-1 pr-1">
        {productosFiltrados.map((producto) => {
          const enCarrito = cantidadEnCarrito(producto.id);
          return (
            <button
              key={producto.id}
              onClick={() => onAgregar(producto)}
              className="relative flex flex-col items-start gap-1.5 rounded-xl border-2 border-transparent bg-card p-3 text-left shadow-sm hover:border-primary hover:bg-primary/5 hover:shadow-lg transition-all active:opacity-70 cursor-pointer"
            >

              <Badge
                style={{ backgroundColor: producto.categoria_color + "33", color: producto.categoria_color }}
                className="text-xs font-medium border-0"
              >
                {producto.categoria_nombre}
              </Badge>
              <span className="font-medium text-sm leading-tight line-clamp-2">{producto.nombre}</span>
              <span className="text-base font-bold text-primary">{formatPrecio(producto.precio)}</span>
              {producto.tiene_stock && (
                <span className="text-xs text-muted-foreground">Stock: {producto.stock_actual}</span>
              )}
            </button>
          );
        })}
        {productosFiltrados.length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-8">Sin productos en esta categoría</p>
        )}
      </div>
    </div>
  );
}
