"use client";

import { useState, useEffect, useCallback } from "react";
import { LayoutGrid, List, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CatalogoGrid } from "./CatalogoGrid";
import { CatalogoLista } from "./CatalogoLista";
import { Carrito } from "./Carrito";
import { PanelCobro } from "./PanelCobro";
import type { ProductoPOS, CarritoItem, CuentaBancaria } from "@/lib/types";

interface POSClientProps {
  cuentasBancarias: CuentaBancaria[];
}

type Vista = "grid" | "lista";
const VISTA_KEY = "pos-vista";

export function POSClient({ cuentasBancarias }: POSClientProps) {
  const [vista, setVista] = useState<Vista>("grid");
  const [carrito, setCarrito] = useState<CarritoItem[]>([]);
  const [cobrando, setCobrando] = useState(false);
  const [productos, setProductos] = useState<ProductoPOS[]>([]);
  const [cargando, setCargando] = useState(true);

  // Init vista from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(VISTA_KEY);
    if (saved === "grid" || saved === "lista") setVista(saved);
  }, []);

  const cambiarVista = (v: Vista) => {
    setVista(v);
    localStorage.setItem(VISTA_KEY, v);
  };

  // Fetch products. Pass silent=true to refresh stock without hiding the grid.
  const fetchProductos = useCallback(async (silent = false) => {
    if (!silent) setCargando(true);
    try {
      const res = await fetch("/api/admin/pos/productos");
      if (!res.ok) throw new Error("Error al cargar productos");
      const data = await res.json();
      setProductos(data);
    } catch {
      // silently fail — user will see empty grid
    } finally {
      if (!silent) setCargando(false);
    }
  }, []);

  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  const handleAgregar = (producto: ProductoPOS) => {
    setCarrito((prev) => {
      const existing = prev.find((c) => c.producto.id === producto.id);
      if (existing) {
        return prev.map((c) =>
          c.producto.id === producto.id ? { ...c, cantidad: c.cantidad + 1 } : c
        );
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  };

  const handleUpdate = (productoId: string, cantidad: number) => {
    if (cantidad <= 0) {
      setCarrito((prev) => prev.filter((c) => c.producto.id !== productoId));
    } else {
      setCarrito((prev) =>
        prev.map((c) => (c.producto.id === productoId ? { ...c, cantidad } : c))
      );
    }
  };

  const handleSuccess = () => {
    setCarrito([]);
    setCobrando(false);
    fetchProductos(true); // silent refresh — keeps grid visible while stock updates
  };

  const total = carrito.reduce((sum, c) => sum + c.producto.precio * c.cantidad, 0);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingCart size={16} className="text-[#133D34]" />
          <h1 className="text-sm font-semibold">Punto de Venta</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant={vista === "grid" ? "default" : "ghost"}
            className="h-8 w-8"
            onClick={() => cambiarVista("grid")}
            title="Vista grilla"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant={vista === "lista" ? "default" : "ghost"}
            className="h-8 w-8"
            onClick={() => cambiarVista("lista")}
            title="Vista lista"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Catalog */}
        <div className="flex-1 p-4 overflow-hidden flex flex-col min-w-0">
          {cargando ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Cargando productos...
            </div>
          ) : vista === "grid" ? (
            <CatalogoGrid productos={productos} carrito={carrito} onAgregar={handleAgregar} />
          ) : (
            <CatalogoLista productos={productos} onAgregar={handleAgregar} />
          )}
        </div>

        {/* Right: Cart / Payment panel — always visible */}
        <div className="w-[340px] shrink-0 border-l flex flex-col overflow-hidden">
          {cobrando ? (
            <PanelCobro
              items={carrito}
              total={total}
              cuentasBancarias={cuentasBancarias}
              onSuccess={handleSuccess}
              onCancel={() => setCobrando(false)}
            />
          ) : (
            <Carrito
              items={carrito}
              onUpdate={handleUpdate}
              onCobrar={() => setCobrando(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
