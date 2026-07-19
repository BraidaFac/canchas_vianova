"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Canchas", href: "#canchas" },
  { label: "Servicios", href: "#servicios" },
  { label: "Instalaciones", href: "#instalaciones" },
  { label: "Contacto", href: "#contacto" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#133D34] shadow-lg"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 shrink-0">
            <Image
              src="/blanco.png"
              alt="Vía Nova Complejo Deportivo"
              width={120}
              height={40}
              className="h-10 w-auto object-contain"
              priority
            />
          </a>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNavClick(link.href)}
                className="text-white/90 hover:text-white text-sm font-medium transition-colors cursor-pointer"
              >
                {link.label}
              </button>
            ))}
            <Button
              onClick={() => handleNavClick("#turnos")}
              className="bg-[#C6B997] text-[#133D34] hover:bg-[#d4c9aa] font-semibold text-sm px-5"
            >
              Reservar turno
            </Button>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10"
                >
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Abrir menú</span>
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                showCloseButton={false}
                className="w-72 bg-[#133D34] border-l border-white/10 p-0"
              >
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <Image
                      src="/blanco.png"
                      alt="Vía Nova"
                      width={100}
                      height={34}
                      className="h-9 w-auto object-contain"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMobileOpen(false)}
                      className="text-white hover:bg-white/10"
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                  <nav className="flex flex-col gap-1 px-4 py-6 flex-1">
                    {navLinks.map((link) => (
                      <button
                        key={link.href}
                        onClick={() => handleNavClick(link.href)}
                        className="text-white/90 hover:text-white hover:bg-white/10 rounded-md px-4 py-3 text-left text-base font-medium transition-colors cursor-pointer"
                      >
                        {link.label}
                      </button>
                    ))}
                  </nav>
                  <div className="px-4 pb-8">
                    <Button
                      onClick={() => handleNavClick("#turnos")}
                      className="w-full bg-[#C6B997] text-[#133D34] hover:bg-[#d4c9aa] font-semibold"
                    >
                      Reservar turno
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
