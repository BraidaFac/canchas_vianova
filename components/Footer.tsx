import Image from "next/image";
import { Instagram } from "lucide-react";

const navLinks = [
  { label: "Canchas", href: "#canchas" },
  { label: "Servicios", href: "#servicios" },
  { label: "Instalaciones", href: "#instalaciones" },
  { label: "Contacto", href: "#contacto" },
];

const IG_LINK = "https://www.instagram.com/vianova.complejo/";

export default function Footer() {
  return (
    <footer className="bg-[#0C2820] text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Logo + tagline */}
          <div className="flex flex-col gap-4">
            <Image
              src="/blanco.png"
              alt="Vía Nova Complejo Deportivo"
              width={120}
              height={40}
              className="h-10 w-auto object-contain"
            />
            <p className="text-white/50 text-sm leading-relaxed max-w-xs">
              Complejo deportivo de césped sintético en Reconquista, Santa Fe. Tu cancha, tu momento.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 className="text-[#C6B997] font-semibold text-sm uppercase tracking-wider mb-4">
              Navegación
            </h3>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-white/60 hover:text-white text-sm transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-[#C6B997] font-semibold text-sm uppercase tracking-wider mb-4">
              Contacto
            </h3>
            <div className="space-y-2.5">
              <p className="text-white/60 text-sm">Reconquista, Santa Fe</p>
              <p className="text-white/60 text-sm">Todos los días: 08:00 — 00:00</p>
              <a
                href="https://wa.me/5434826783770"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/60 hover:text-white text-sm transition-colors block"
              >
                +54-3482-678377
              </a>
              <a
                href={IG_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm transition-colors"
              >
                <Instagram className="h-4 w-4" />
                @vianova.complejo
              </a>
            </div>
          </div>
        </div>

        {/* Divider + copyright */}
        <div className="border-t border-white/10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/40 text-xs">
            © 2025 Vía Nova Complejo Deportivo. Todos los derechos reservados.
          </p>
          <a
            href={IG_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/40 hover:text-white transition-colors"
            aria-label="Instagram"
          >
            <Instagram className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
