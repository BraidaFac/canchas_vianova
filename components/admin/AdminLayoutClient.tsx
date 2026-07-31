"use client";

import { useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { AdminSession } from "@/lib/auth";

export default function AdminLayoutClient({
  children,
  session,
  facturacionActiva = false,
  posActivo = false,
  stockActivo = false,
}: {
  children: React.ReactNode;
  session: AdminSession;
  facturacionActiva?: boolean;
  posActivo?: boolean;
  stockActivo?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <AdminSidebar
        session={session}
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
        facturacionActiva={facturacionActiva}
        posActivo={posActivo}
        stockActivo={stockActivo}
      />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile spacer for fixed top bar */}
        <div className="md:hidden h-[53px] shrink-0" />
        <div className="hidden md:block h-3 shrink-0" />
        {children}
      </main>
    </div>
  );
}
