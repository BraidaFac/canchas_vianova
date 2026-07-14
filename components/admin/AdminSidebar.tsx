"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  List,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Contact,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AdminSession } from "@/lib/auth";
import { toast } from "sonner";

const navItems = [
  { href: "/admin/grilla", label: "Grilla", icon: CalendarDays },
  { href: "/admin/reservas", label: "Reservas", icon: List },
  { href: "/admin/clientes", label: "Clientes", icon: Contact },
  { href: "/admin/eventos", label: "Eventos", icon: Trophy },
  { href: "/admin/empleados", label: "Empleados", icon: Users, superadminOnly: true },
  { href: "/admin/config", label: "Configuración", icon: Settings },
];

type Props = {
  session: AdminSession;
  collapsed: boolean;
  onCollapsedChange: (v: boolean) => void;
};

export default function AdminSidebar({ session, collapsed, onCollapsedChange }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = navItems.filter(
    (item) => !item.superadminOnly || session.rol === "superadmin"
  );

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    toast.success("Sesión cerrada");
  }

  return (
    <>
      {/* ── DESKTOP SIDEBAR (icon-rail when collapsed, full when expanded) ── */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-white/10 bg-[#0C2820] shrink-0 transition-all duration-150",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "py-4 border-b border-white/10 flex shrink-0",
            collapsed ? "flex-col items-center gap-3 px-2" : "flex-row items-start justify-between gap-2 px-4"
          )}
        >
          {!collapsed && (
            <div className="min-w-0">
              <Link href="/admin/grilla">
                <Image
                  src="/blanco.png"
                  alt="Vía Nova"
                  width={96}
                  height={32}
                  className="h-8 w-auto object-contain mb-2"
                />
              </Link>
              <p className="text-xs text-[#C6B997] mt-0.5 truncate">{session.nombre}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => onCollapsedChange(!collapsed)}
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </Button>
        </div>

        {/* Nav */}
        <nav className={cn("flex-1 py-4 space-y-1", collapsed ? "px-2" : "px-3")}>
          {visibleItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                pathname.startsWith(href)
                  ? "bg-[#133D34] text-white"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon size={16} />
              {!collapsed && label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className={cn("py-4 border-t border-white/10", collapsed ? "px-2" : "px-3")}>
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            title={collapsed ? "Cerrar sesión" : undefined}
            className={cn(
              "text-white/60 hover:text-red-400 hover:bg-white/5",
              collapsed ? "h-9 w-full justify-center" : "w-full justify-start gap-3"
            )}
            onClick={handleLogout}
          >
            <LogOut size={16} />
            {!collapsed && "Cerrar sesión"}
          </Button>
        </div>
      </aside>

      {/* ── MOBILE: fixed top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-[#0C2820] border-b border-white/10">
        <Link href="/admin/grilla">
          <Image
            src="/blanco.png"
            alt="Vía Nova"
            width={80}
            height={28}
            className="h-7 w-auto object-contain"
          />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/10"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      {/* ── MOBILE: drawer overlay ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/80 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="absolute left-0 top-0 bottom-0 w-64 bg-[#0C2820] border-r border-white/10 pt-14 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-4 border-b border-white/10">
              <p className="text-xs text-[#C6B997] truncate">{session.nombre}</p>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {visibleItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    pathname.startsWith(href)
                      ? "bg-[#133D34] text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="px-3 py-4 border-t border-white/10">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-3 text-white/60 hover:text-red-400 hover:bg-white/5"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Cerrar sesión
              </Button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
