"use client";

import { useState } from "react";
import AdminSidebar from "./AdminSidebar";
import { AdminSession } from "@/lib/auth";

export default function AdminLayoutClient({
  children,
  session,
}: {
  children: React.ReactNode;
  session: AdminSession;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AdminSidebar session={session} collapsed={collapsed} onCollapsedChange={setCollapsed} />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile spacer for fixed top bar (py-3 * 2 + h-7 + border = 53px) */}
        <div className="md:hidden h-[53px] shrink-0" />
        {/* Desktop breathing room from browser chrome */}
        <div className="hidden md:block h-3 shrink-0" />
        {children}
      </main>
    </div>
  );
}
