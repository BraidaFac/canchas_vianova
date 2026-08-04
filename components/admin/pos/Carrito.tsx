"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus, X, ShoppingCart } from "lucide-react";
import type { CarritoItem } from "@/lib/types";

interface CarritoProps {
  items: CarritoItem[];
  onUpdate: (productoId: string, cantidad: number) => void;
  onCobrar: () => void;
}

export function Carrito({ items, onUpdate, onCobrar }: CarritoProps) {
  const total = items.reduce((sum, c) => sum + c.producto.precio * c.cantidad, 0);

  const formatPrecio = (precio: number) =>
    "$" + precio.toLocaleString("es-AR", { minimumFractionDigits: 0 });

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 min-h-0 gap-3 text-muted-foreground p-6">
        <ShoppingCart className="h-12 w-12 opacity-30" />
        <p className="text-sm text-center">Agregá productos para comenzar</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          Carrito ({items.length})
        </h2>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto divide-y">
        {items.map((item) => {
          const subtotal = item.producto.precio * item.cantidad;
          return (
            <div key={item.producto.id} className="px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{item.producto.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  {formatPrecio(item.producto.precio)} c/u
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => onUpdate(item.producto.id, item.cantidad - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-medium">{item.cantidad}</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-7 w-7"
                  onClick={() => onUpdate(item.producto.id, item.cantidad + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2 ml-1">
                <span className="text-sm font-bold w-20 text-right">{formatPrecio(subtotal)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => onUpdate(item.producto.id, 0)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-medium">Total</span>
          <span className="text-xl font-bold">{formatPrecio(total)}</span>
        </div>
        <Button className="w-full" size="lg" onClick={onCobrar}>
          Cobrar {formatPrecio(total)}
        </Button>
      </div>
    </div>
  );
}
