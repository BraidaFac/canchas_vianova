"use client";

import { useEffect, useState, useRef } from "react";
import { format, addDays, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Loader2, Ban } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TurnosCanchas, Cancha, Turno } from "@/lib/turnos";

const FUTBOL5_IDS = [3, 4, 5];
const FUTBOL8_IDS = [1, 2];
const WA_NUMBER = "543482678377";

function generateDates(count = 15): Date[] {
  const today = startOfToday();
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function TurnosSection() {
  const [allTurnos, setAllTurnos] = useState<TurnosCanchas>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dates] = useState<Date[]>(generateDates(15));
  const [selectedDate, setSelectedDate] = useState<Date>(generateDates(1)[0]);
  const [sportType, setSportType] = useState<"f5" | "f8">("f8");
  const [mobileIndex, setMobileIndex] = useState(0);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [selected, setSelected] = useState<{
    cancha: Cancha;
    turno: Turno;
  } | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  const datesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/turnos")
      .then((r) => {
        if (!r.ok) throw new Error("Error al cargar turnos");
        return r.json();
      })
      .then((data: TurnosCanchas) => {
        setAllTurnos(data);
        setLoading(false);
      })
      .catch(() => {
        setError("No se pudieron cargar los turnos. Intentá más tarde.");
        setLoading(false);
      });
  }, []);

  const canchaIds = sportType === "f5" ? FUTBOL5_IDS : FUTBOL8_IDS;
  const canchas = allTurnos.filter((c) => canchaIds.includes(c.id));
  const dateKey = format(selectedDate, "dd/MM");

  const handleSlotClick = (cancha: Cancha, turno: Turno) => {
    setSelected({ cancha, turno });
    setNombre("");
    setTelefono("");
    setBookingOpen(true);
  };

  const handleWhatsApp = () => {
    if (!selected) return;
    const fechaStr = capitalizeFirst(
      format(selectedDate, "EEEE d 'de' MMMM", { locale: es })
    );
    const msg = `Hola! Quiero reservar la ${selected.cancha.nombre} el ${fechaStr} de ${selected.turno.horaInicio} a ${selected.turno.horaFin}. Mi nombre es ${nombre}${telefono ? ` y mi teléfono es ${telefono}` : ""}.`;
    window.open(
      `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`,
      "_blank"
    );
  };

  return (
    <section id="turnos" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="text-center mb-10">
          <h2
            className="text-4xl font-bold text-[#133D34] mb-3"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Reservá tu cancha
          </h2>
          <p className="text-[#1A1A1A]/60 text-base max-w-lg mx-auto">
            Consultá la disponibilidad y contactanos por WhatsApp para confirmar tu turno.
          </p>
        </div>

        {/* Sport type tabs */}
        <div className="flex justify-center mb-6">
          <Tabs
            value={sportType}
            onValueChange={(v) => {
              setSportType(v as "f5" | "f8");
              setMobileIndex(0);
            }}
          >
            <TabsList className="bg-[#F8F6F1] border border-[#133D34]/20">
              <TabsTrigger
                value="f8"
                className="data-[state=active]:bg-[#133D34] data-[state=active]:text-white px-6"
              >
                Fútbol 8
              </TabsTrigger>
              <TabsTrigger
                value="f5"
                className="data-[state=active]:bg-[#133D34] data-[state=active]:text-white px-6"
              >
                Fútbol 5
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Date pills */}
        <div className="flex justify-center mb-8">
          <div
            ref={datesRef}
            className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide max-w-full px-1"
          >
          {dates.map((date) => {
            const isActive =
              format(date, "dd/MM") === format(selectedDate, "dd/MM");
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={`flex-shrink-0 flex flex-col items-center px-4 py-2.5 rounded-full text-sm font-medium transition-colors cursor-pointer border ${
                  isActive
                    ? "bg-[#133D34] text-white border-[#133D34]"
                    : "bg-[#F8F6F1] text-[#1A1A1A] border-transparent hover:border-[#133D34]/30"
                }`}
              >
                <span className="capitalize text-xs opacity-75">
                  {format(date, "EEE", { locale: es })}
                </span>
                <span className="font-semibold">{format(date, "d")}</span>
                <span className="text-xs opacity-75 capitalize">
                  {format(date, "MMM", { locale: es })}
                </span>
              </button>
            );
          })}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#133D34]" />
            <span className="ml-3 text-[#133D34]/70">Cargando disponibilidad...</span>
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-500">{error}</div>
        ) : canchas.length === 0 && sportType === "f5" ? (
          /* F5 no está en el sistema aún — mostrar cards placeholder */
          <div className="grid sm:grid-cols-3 gap-6">
            {["Cancha A", "Cancha B", "Cancha C"].map((nombre) => (
              <div
                key={nombre}
                className="relative rounded-2xl overflow-hidden"
                style={{ background: "linear-gradient(145deg, #f0ede6 0%, #e8e4db 100%)" }}
              >
                <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #133D34, #1a5248, #133D34)" }} />
                <div className="p-5">
                  <h3 className="font-semibold text-[#133D34] text-lg mb-0.5">{nombre}</h3>
                  <p className="text-[#1A1A1A]/50 text-xs mb-4">Fútbol 5 · 10 jugadores</p>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35 }}
                    className="flex flex-col items-center justify-center gap-3 py-8"
                  >
                    <motion.div
                      animate={{ rotate: [0, -8, 8, -8, 0] }}
                      transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.5 }}
                      className="w-12 h-12 rounded-full bg-[#133D34]/10 flex items-center justify-center"
                    >
                      <Ban className="h-6 w-6 text-[#133D34]/40" />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-[#133D34]/70">
                        Cancha no disponible hoy
                      </p>
                      <p className="text-xs text-[#1A1A1A]/40 mt-1 max-w-[160px] mx-auto leading-relaxed">
                        El espacio está siendo usado por las canchas de Fútbol 8
                      </p>
                    </div>
                    <motion.div
                      className="h-1 w-16 rounded-full bg-[#C6B997]/40"
                      animate={{ scaleX: [0.4, 1, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        ) : canchas.length === 0 ? null : (
          <>
            {/* Desktop grid: all canchas side by side */}
            <div className={`hidden sm:grid gap-6 ${canchas.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
              {canchas.map((cancha) => {
                const slots = cancha.turnos[dateKey] ?? [];
                const isEmpty = slots.length === 0;
                return (
                  <div
                    key={cancha.id}
                    className="relative rounded-2xl overflow-hidden"
                    style={{
                      background: "linear-gradient(145deg, #f0ede6 0%, #e8e4db 100%)",
                    }}
                  >
                    {/* Subtle grass-pattern header stripe */}
                    <div
                      className="h-1.5 w-full"
                      style={{ background: "linear-gradient(90deg, #133D34, #1a5248, #133D34)" }}
                    />
                    <div className="p-5">
                      <h3 className="font-semibold text-[#133D34] text-lg mb-0.5">
                        {cancha.nombre}
                      </h3>
                      <p className="text-[#1A1A1A]/50 text-xs mb-4">
                        {sportType === "f8" ? "Fútbol 8" : "Fútbol 5"} · {cancha.jugadores} jugadores
                      </p>

                      <AnimatePresence mode="wait">
                        {isEmpty ? (
                          <motion.div
                            key="empty"
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.92 }}
                            transition={{ duration: 0.35 }}
                            className="flex flex-col items-center justify-center gap-3 py-8"
                          >
                            <motion.div
                              animate={{ rotate: [0, -8, 8, -8, 0] }}
                              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.5 }}
                              className="w-12 h-12 rounded-full bg-[#133D34]/10 flex items-center justify-center"
                            >
                              <Ban className="h-6 w-6 text-[#133D34]/40" />
                            </motion.div>
                            <div className="text-center">
                              <p className="text-sm font-medium text-[#133D34]/60">
                                Sin turnos para este día
                              </p>
                              <p className="text-xs text-[#1A1A1A]/35 mt-0.5">
                                Probá otro día
                              </p>
                            </div>
                            {/* Shimmer bar */}
                            <motion.div
                              className="h-1 w-16 rounded-full bg-[#C6B997]/40"
                              animate={{ scaleX: [0.4, 1, 0.4] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="slots"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col gap-2"
                          >
                            {slots.map((turno, i) => (
                              <motion.button
                                key={turno.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                whileHover={{ scale: 1.02, x: 3 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSlotClick(cancha, turno)}
                                className="w-full text-white rounded-xl px-3 py-3 text-sm font-semibold cursor-pointer relative overflow-hidden group"
                                style={{
                                  fontFamily: "var(--font-mono), monospace",
                                  background: "linear-gradient(135deg, #133D34 0%, #1a5248 50%, #0f2e27 100%)",
                                }}
                              >
                                {/* Shine sweep on hover */}
                                <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                  style={{ background: "linear-gradient(105deg, transparent 30%, rgba(198,185,151,0.25) 50%, transparent 70%)" }}
                                />
                                <span className="relative flex items-center justify-between">
                                  <span>{turno.horaInicio} – {turno.horaFin}</span>
                                  <span className="text-[#C6B997] text-xs opacity-80">Reservar →</span>
                                </span>
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile: one cancha at a time with prev/next */}
            <div className="sm:hidden">
              {canchas[mobileIndex] && (
                <div className="bg-[#F8F6F1] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={() =>
                        setMobileIndex((i) => Math.max(0, i - 1))
                      }
                      disabled={mobileIndex === 0}
                      className="p-2 rounded-full bg-white border border-[#133D34]/20 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4 text-[#133D34]" />
                    </button>
                    <div className="text-center">
                      <h3 className="font-semibold text-[#133D34] text-lg">
                        {canchas[mobileIndex].nombre}
                      </h3>
                      <p className="text-[#1A1A1A]/50 text-xs">
                        {sportType === "f8" ? "Fútbol 8" : "Fútbol 5"} · {canchas[mobileIndex].jugadores} jugadores · {mobileIndex + 1}/{canchas.length}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setMobileIndex((i) =>
                          Math.min(canchas.length - 1, i + 1)
                        )
                      }
                      disabled={mobileIndex === canchas.length - 1}
                      className="p-2 rounded-full bg-white border border-[#133D34]/20 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4 text-[#133D34]" />
                    </button>
                  </div>
                  {(() => {
                    const slots = canchas[mobileIndex].turnos[dateKey] ?? [];
                    const isEmpty = slots.length === 0;
                    return (
                      <AnimatePresence mode="wait">
                        {isEmpty ? (
                          <motion.div
                            key="empty-mobile"
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center gap-3 py-8"
                          >
                            <motion.div
                              animate={{ rotate: [0, -8, 8, -8, 0] }}
                              transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.5 }}
                              className="w-12 h-12 rounded-full bg-[#133D34]/10 flex items-center justify-center"
                            >
                              <Ban className="h-6 w-6 text-[#133D34]/40" />
                            </motion.div>
                            <p className="text-sm font-medium text-[#133D34]/60 text-center">
                              Sin turnos para este día
                            </p>
                            <motion.div
                              className="h-1 w-16 rounded-full bg-[#C6B997]/40"
                              animate={{ scaleX: [0.4, 1, 0.4] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                          </motion.div>
                        ) : (
                          <motion.div key="slots-mobile" className="flex flex-col gap-2">
                            {slots.map((turno, i) => (
                              <motion.button
                                key={turno.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04 }}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSlotClick(canchas[mobileIndex], turno)}
                                className="w-full text-white rounded-xl px-3 py-3 text-sm font-semibold cursor-pointer relative overflow-hidden group"
                                style={{
                                  fontFamily: "var(--font-mono), monospace",
                                  background: "linear-gradient(135deg, #133D34 0%, #1a5248 50%, #0f2e27 100%)",
                                }}
                              >
                                <span className="relative flex items-center justify-between">
                                  <span>{turno.horaInicio} – {turno.horaFin}</span>
                                  <span className="text-[#C6B997] text-xs opacity-80">Reservar →</span>
                                </span>
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    );
                  })()}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Booking dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#133D34]">Confirmar reserva</DialogTitle>
            <DialogDescription>
              {selected && (
                <span>
                  {selected.cancha.nombre} ·{" "}
                  {capitalizeFirst(
                    format(selectedDate, "EEEE d 'de' MMMM", { locale: es })
                  )}{" "}
                  · {selected.turno.horaInicio} – {selected.turno.horaFin}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {selected && (
              <div className="bg-[#F8F6F1] rounded-lg p-4 space-y-1">
                <p className="font-semibold text-[#133D34]">
                  {selected.cancha.nombre}
                </p>
                <p className="text-sm text-[#1A1A1A]/70 capitalize">
                  {capitalizeFirst(
                    format(selectedDate, "EEEE d 'de' MMMM", { locale: es })
                  )}
                </p>
                <p
                  className="text-lg font-bold text-[#133D34]"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  {selected.turno.horaInicio} – {selected.turno.horaFin}
                </p>
                <p className="text-sm text-[#C6B997] font-medium">
                  Consultá precio
                </p>
              </div>
            )}
            <div className="space-y-3">
              <Input
                placeholder="Tu nombre *"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="border-[#133D34]/20 focus-visible:ring-[#133D34]"
              />
              <Input
                placeholder="Tu teléfono (opcional)"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className="border-[#133D34]/20 focus-visible:ring-[#133D34]"
              />
            </div>
            <Button
              onClick={handleWhatsApp}
              disabled={!nombre.trim()}
              className="w-full bg-[#133D34] hover:bg-[#0f2e27] text-white font-semibold h-11"
            >
              Confirmar por WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
