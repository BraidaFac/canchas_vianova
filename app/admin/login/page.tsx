"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Toaster } from "sonner";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, pin }),
    });

    const data = await res.json();

    if (!res.ok) {
      toast.error(data.error ?? "Error al iniciar sesión");
      setLoading(false);
      return;
    }

    toast.success(`Bienvenido, ${data.nombre}`);
    router.push("/admin/grilla");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#133D34] px-4">
      <Toaster richColors position="top-right" />
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <Image
            src="/blanco.png"
            alt="Vía Nova Complejo Deportivo"
            width={140}
            height={48}
            className="h-12 w-auto object-contain"
            priority
          />
          <p className="text-[#C6B997]/80 text-sm">Panel de gestión</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">
                Usuario o teléfono
              </label>
              <Input
                type="text"
                placeholder="usuario o telefono"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-[#C6B997]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-white/80">PIN</label>
              <Input
                type="password"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                autoComplete="current-password"
                maxLength={8}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-[#C6B997]"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-[#C6B997] text-[#133D34] hover:bg-[#d4c9aa] font-semibold h-11 mt-2"
              disabled={loading}
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
