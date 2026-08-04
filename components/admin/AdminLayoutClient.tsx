"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import AdminSidebar from "./AdminSidebar";
import AbrirCajaDialog from "./AbrirCajaDialog";
import { AdminSession } from "@/lib/auth";
import type { EstadoCajaResponse } from "@/lib/caja/types";

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
  const [estadoCaja, setEstadoCaja] = useState<EstadoCajaResponse | null>(null);
  const [modalAbrir, setModalAbrir] = useState(false);

  const fetchEstado = () => {
    if (!posActivo) { setEstadoCaja(null); return; }
    fetch("/api/admin/caja/estado")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setEstadoCaja(data); })
      .catch(() => null);
  };

  useEffect(() => {
    fetchEstado();
    window.addEventListener("caja-estado-changed", fetchEstado);
    return () => window.removeEventListener("caja-estado-changed", fetchEstado);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posActivo]);

  function onCajaSuccess() {
    setModalAbrir(false);
    // fetchEstado ya se dispara vía evento "caja-estado-changed" desde AbrirCajaDialog
  }

  const mostrarBanner = posActivo && estadoCaja && estadoCaja.code !== "ok";

  // Determina el mensaje del banner
  let bannerMsg = "No hay caja abierta.";
  let bannerAction: React.ReactNode = (
    <button
      className="ml-2 px-2 py-0.5 rounded bg-amber-700 text-amber-50 font-medium text-[11px] hover:bg-amber-800 transition-colors"
      onClick={() => setModalAbrir(true)}
    >
      Abrir caja
    </button>
  );

  if (estadoCaja?.code === "jornada_vencida") {
    const fecha = estadoCaja.jornada?.fecha_jornada ?? "";
    bannerMsg = `Tenés una caja sin cerrar del ${fecha}.`;
    bannerAction = (
      <Link
        href="/admin/caja"
        className="ml-2 px-2 py-0.5 rounded bg-amber-700 text-amber-50 font-medium text-[11px] hover:bg-amber-800 transition-colors"
      >
        Ir a Caja →
      </Link>
    );
  }

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

        {/* Banner de estado de caja */}
        {mostrarBanner && (
          <div className="mx-4 mb-2 px-3 py-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-1 shrink-0">
            <span>⚠</span>
            <span>{bannerMsg}</span>
            {bannerAction}
          </div>
        )}

        {children}
      </main>

      {modalAbrir && (
        <AbrirCajaDialog
          open={true}
          onClose={() => setModalAbrir(false)}
          onSuccess={onCajaSuccess}
        />
      )}
    </div>
  );
}
