"use client";

import { MapPin, Clock, Phone, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";

const WA_NUMBER = "543482678377";
const WA_LINK = `https://wa.me/${WA_NUMBER}`;
const IG_LINK = "https://www.instagram.com/vianova.complejo/";

export default function ContactoSection() {
  return (
    <section id="contacto" className="py-20 bg-[#F8F6F1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h2
            className="text-4xl font-bold text-[#133D34] mb-3"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            ¿Dónde encontrarnos?
          </h2>
          <p className="text-[#1A1A1A]/60 max-w-lg mx-auto">
            Estamos en Reconquista, Santa Fe. Visitanos o escribinos cuando
            quieras.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left: info */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#133D34]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="h-5 w-5 text-[#133D34]" />
                </div>
                <div>
                  <p className="font-semibold text-[#133D34] text-sm mb-0.5">
                    Dirección
                  </p>
                  <p className="text-[#1A1A1A]/70 text-sm">
                    Reconquista, Santa Fe, Argentina
                    <br />
                    <span className="text-[#1A1A1A]/40 text-xs">
                      (dirección exacta próximamente)
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#133D34]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="h-5 w-5 text-[#133D34]" />
                </div>
                <div>
                  <p className="font-semibold text-[#133D34] text-sm mb-0.5">
                    Horarios
                  </p>
                  <p className="text-[#1A1A1A]/70 text-sm">
                    Todos los días: 08:00 a 00:00
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#133D34]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Phone className="h-5 w-5 text-[#133D34]" />
                </div>
                <div>
                  <p className="font-semibold text-[#133D34] text-sm mb-0.5">
                    WhatsApp
                  </p>
                  <a
                    href={WA_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1A1A1A]/70 text-sm hover:text-[#133D34] transition-colors"
                  >
                    +54-3482-678377
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#133D34]/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Instagram className="h-5 w-5 text-[#133D34]" />
                </div>
                <div>
                  <p className="font-semibold text-[#133D34] text-sm mb-0.5">
                    Instagram
                  </p>
                  <a
                    href={IG_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1A1A1A]/70 text-sm hover:text-[#133D34] transition-colors"
                  >
                    @vianova.complejo
                  </a>
                </div>
              </div>
            </div>

            <Button
              asChild
              className="w-full bg-[#133D34] hover:bg-[#0f2e27] text-white font-semibold h-12 text-base"
            >
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer">
                Escribinos por WhatsApp
              </a>
            </Button>
          </div>

          {/* Right: map */}
          <div className="rounded-2xl overflow-hidden h-80 lg:h-full min-h-[320px] shadow-sm">
            <iframe
              title="Vía Nova Complejo Deportivo - Ubicación"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3441.89!2d-59.637172!3d-29.163159!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjnCsDA5JzQ3LjQiUyA1OcKwMzgnMTMuOCJX!5e0!3m2!1ses!2sar!4v1620000000000"
              width="100%"
              height="100%"
              style={{ border: 0, minHeight: "320px" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
