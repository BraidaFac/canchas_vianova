"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductosTab } from "@/components/admin/stock/ProductosTab";
import { CategoriasTab } from "@/components/admin/stock/CategoriasTab";
import { ComprasTab } from "@/components/admin/stock/ComprasTab";

export function StockClient() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold">Stock</h1>
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
  );
}
