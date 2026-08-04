"use client";

import { Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductosTab } from "@/components/admin/stock/ProductosTab";
import { CategoriasTab } from "@/components/admin/stock/CategoriasTab";
import { ComprasTab } from "@/components/admin/stock/ComprasTab";

export function StockClient() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Package size={16} className="text-[#133D34]" />
          <h1 className="text-sm font-semibold">Stock</h1>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4 md:p-6">
        <Tabs defaultValue="productos">
          <TabsList>
            <TabsTrigger value="productos">Productos</TabsTrigger>
            <TabsTrigger value="categorias">Categorías</TabsTrigger>
            <TabsTrigger value="compras">Compras</TabsTrigger>
          </TabsList>
          <TabsContent value="productos" className="mt-4">
            <ProductosTab />
          </TabsContent>
          <TabsContent value="categorias" className="mt-4">
            <CategoriasTab />
          </TabsContent>
          <TabsContent value="compras" className="mt-4">
            <ComprasTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
