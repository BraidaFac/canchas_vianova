"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function Hero() {
  const scrollTo = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="relative w-full h-screen min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <Image
        src="https://images.unsplash.com/photo-1556056504-5c7696c4c28d?w=1920&q=80"
        alt="Canchas de fútbol sintético"
        fill
        priority
        unoptimized
        className="object-cover object-center"
      />

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(19, 61, 52, 0.70)" }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-3xl mx-auto">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="text-white/90 text-sm font-medium">Canchas disponibles hoy</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.2 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-tight mb-4"
          style={{ fontFamily: "var(--font-display), serif" }}
        >
          Tu cancha,<br />tu momento
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.35 }}
          className="text-lg sm:text-xl text-white/80 mb-8 max-w-xl"
        >
          Césped sintético premium en Reconquista, Santa Fe
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3 w-full justify-center"
        >
          <Button
            size="lg"
            onClick={() => scrollTo("#turnos")}
            className="bg-[#C6B997] text-[#133D34] hover:bg-[#d4c9aa] font-semibold px-8 text-base h-12"
          >
            Reservar ahora
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => scrollTo("#turnos")}
            className="border-white text-white bg-transparent hover:bg-white/10 hover:text-white font-semibold px-8 text-base h-12"
          >
            Ver disponibilidad
          </Button>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 text-white/50">
        <div className="w-0.5 h-8 bg-white/30 rounded-full animate-pulse" />
      </div>
    </section>
  );
}
