"use client";

import { motion } from "framer-motion";
import { Calendar, MessageCircle, Trophy } from "lucide-react";

const pasos = [
  {
    icon: Calendar,
    numero: "01",
    titulo: "Elegí fecha y horario",
    descripcion:
      "Revisá la disponibilidad en tiempo real y elegí el turno que mejor te quede.",
  },
  {
    icon: MessageCircle,
    numero: "02",
    titulo: "Confirmá por WhatsApp",
    descripcion:
      "Te redirigimos directo al chat. Solo tocás Enviar y tu reserva queda en camino.",
  },
  {
    icon: Trophy,
    numero: "03",
    titulo: "¡A jugar!",
    descripcion:
      "Presentate en la cancha a tu hora y disfrutá del complejo al máximo.",
  },
];

export default function ComoReservarSection() {
  return (
    <section id="instalaciones" className="py-20 bg-[#133D34]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="text-center mb-14"
        >
          <h2
            className="text-4xl font-bold text-white mb-3"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            ¿Cómo reservar?
          </h2>
          <p className="text-[#C6B997]/80 max-w-lg mx-auto">
            Tres pasos simples y tu turno está listo.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line (desktop only) */}
          <div className="hidden md:block absolute top-12 left-[calc(16.66%+2rem)] right-[calc(16.66%+2rem)] h-px bg-[#C6B997]/30" />

          {pasos.map((paso, index) => {
            const Icon = paso.icon;
            return (
              <motion.div
                key={paso.numero}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: index * 0.15 }}
                className="flex flex-col items-center text-center relative z-10"
              >
                {/* Icon circle */}
                <div className="w-24 h-24 rounded-full bg-[#0C2820] border-2 border-[#C6B997]/30 flex items-center justify-center mb-6 relative">
                  <Icon className="h-10 w-10 text-[#C6B997]" />
                  <span
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#C6B997] flex items-center justify-center text-[#133D34] text-xs font-bold"
                    style={{ fontFamily: "var(--font-mono), monospace" }}
                  >
                    {index + 1}
                  </span>
                </div>

                <h3 className="text-white font-semibold text-lg mb-2">
                  {paso.titulo}
                </h3>
                <p className="text-[#C6B997]/70 text-sm leading-relaxed max-w-xs">
                  {paso.descripcion}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
