"use client";

import { Suspense } from "react";
import { Receipt } from "lucide-react";
import { ComprobantesTab } from "./ComprobantesTab";

export function FacturacionClient() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-2">
          <Receipt size={16} className="text-[#133D34]" />
          <h1 className="text-sm font-semibold">Facturación electrónica</h1>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <Suspense>
          <ComprobantesTab />
        </Suspense>
      </div>
    </div>
  );
}
