"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { format, addDays, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, Ban } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TurnosCanchas, Cancha, Turno } from "@/lib/turnos";

const WA_NUMBER = "543482678377";

function generateDates(count = 15): Date[] {
  const today = startOfToday();
  return Array.from({ length: count }, (_, i) => addDays(today, i));
}

function capitalizeFirst(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

type UniqueSlot = { turno: Turno; canchas: Cancha[] };

type Selected = {
  turno: Turno;
  cancha: Cancha;
  availableCanchas: Cancha[];
};

export default function TurnosSection() {
  const [allTurnos, setAllTurnos] = useState<TurnosCanchas>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dates] = useState<Date[]>(generateDates(15));
  const [selectedDate, setSelectedDate] = useState<Date>(generateDates(1)[0]);
  const [selectedTipoCanchaId, setSelectedTipoCanchaId] = useState<
    number | null
  >(null);

  const [bookingOpen, setBookingOpen] = useState(false);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");

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

  // Derive unique tipos from loaded canchas
  const tiposDisponibles = useMemo(() => {
    const map = new Map<number, string>();
    allTurnos.forEach((c) => {
      if (!map.has(c.tipoCanchaId)) map.set(c.tipoCanchaId, c.tipoCanchaNombre);
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [allTurnos]);

  // Set the initial selected tipo once tipos are loaded
  useEffect(() => {
    if (tiposDisponibles.length > 0 && selectedTipoCanchaId === null) {
      setSelectedTipoCanchaId(tiposDisponibles[0].id);
    }
  }, [tiposDisponibles, selectedTipoCanchaId]);

  // Filter canchas by selected tipo
  const canchas = allTurnos.filter(
    (c) => c.tipoCanchaId === selectedTipoCanchaId,
  );
  const dateKey = format(selectedDate, "dd/MM");

  // Derive unique time slots across all canchas for the selected date
  const uniqueSlots = useMemo((): UniqueSlot[] => {
    const map = new Map<number, UniqueSlot>();
    for (const cancha of canchas) {
      const slots = cancha.turnos[dateKey] ?? [];
      for (const turno of slots) {
        if (!map.has(turno.id)) {
          map.set(turno.id, { turno, canchas: [] });
        }
        map.get(turno.id)!.canchas.push(cancha);
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.turno.horaInicio.localeCompare(b.turno.horaInicio),
    );
  }, [canchas, dateKey]);

  const handleSlotClick = ({
    turno,
    canchas: availableCanchas,
  }: UniqueSlot) => {
    setSelected({ turno, cancha: availableCanchas[0], availableCanchas });
    setNombre("");
    setApellido("");
    setBookingOpen(true);
  };

  const handleCanchaChange = (canchaId: string) => {
    if (!selected) return;
    const cancha = selected.availableCanchas.find(
      (c) => String(c.id) === canchaId,
    );
    if (cancha) setSelected({ ...selected, cancha });
  };

  const handleWhatsApp = () => {
    if (!selected) return;
    const fechaStr = capitalizeFirst(
      format(selectedDate, "EEEE d 'de' MMMM", { locale: es }),
    );
    const lineas = [
      `Hola! Quiero reservar la ${selected.cancha.nombre} el ${fechaStr} de ${selected.turno.horaInicio} a ${selected.turno.horaFin}.`,
      ``,
      `📋 Datos del cliente:`,
      `• Nombre: ${nombre}`,
      `• Apellido: ${apellido}`,
    ];
    const msg = lineas.join("\n");
    window.open(
      `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  };

  const slotButton = (slot: UniqueSlot, i: number) => (
    <motion.button
      key={slot.turno.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.04 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => handleSlotClick(slot)}
      className="w-full text-white rounded-xl px-4 py-3.5 text-sm font-semibold cursor-pointer relative overflow-hidden group"
      style={{
        fontFamily: "var(--font-mono), monospace",
        background:
          "linear-gradient(135deg, #133D34 0%, #1a5248 50%, #0f2e27 100%)",
      }}
    >
      {/* Shine sweep on hover */}
      <span
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "linear-gradient(105deg, transparent 30%, rgba(198,185,151,0.25) 50%, transparent 70%)",
        }}
      />
      <span className="relative flex items-center justify-between">
        <span>
          {slot.turno.horaInicio} – {slot.turno.horaFin}
        </span>
        <span className="text-[#C6B997] text-xs opacity-80">Reservar →</span>
      </span>
    </motion.button>
  );

  const emptyState = (
    <motion.div
      key="empty"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center justify-center gap-3 py-16"
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
        <p className="text-xs text-[#1A1A1A]/35 mt-0.5">Probá otro día</p>
      </div>
      <motion.div
        className="h-1 w-16 rounded-full bg-[#C6B997]/40"
        animate={{ scaleX: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  );

  return (
    <section id="turnos" className="py-16 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title */}
        <div className="text-center mb-10">
          <h2
            className="text-4xl font-bold text-[#133D34] mb-3"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Reservá tu cancha
          </h2>
          <p className="text-[#1A1A1A]/60 text-base max-w-lg mx-auto">
            Consultá la disponibilidad y contactanos por WhatsApp para confirmar
            tu turno.
          </p>
        </div>

        {/* Sport type tabs — dynamic */}
        {tiposDisponibles.length > 0 && (
          <div className="flex justify-center mb-6">
            <Tabs
              value={String(selectedTipoCanchaId ?? "")}
              onValueChange={(v) => setSelectedTipoCanchaId(Number(v))}
            >
              <TabsList className="bg-[#F8F6F1] border border-[#133D34]/20">
                {tiposDisponibles.map((t) => (
                  <TabsTrigger
                    key={t.id}
                    value={String(t.id)}
                    className="data-[state=active]:bg-[#133D34] data-[state=active]:text-white px-6"
                  >
                    {t.nombre}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        )}

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
            <span className="ml-3 text-[#133D34]/70">
              Cargando disponibilidad...
            </span>
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-500">{error}</div>
        ) : (
          <AnimatePresence mode="wait">
            {uniqueSlots.length === 0 ? (
              emptyState
            ) : (
              <motion.div
                key="slots"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-3"
              >
                {uniqueSlots.map((slot, i) => slotButton(slot, i))}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Booking dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#133D34]">
              Confirmar reserva
            </DialogTitle>
            <DialogDescription>
              {selected && (
                <span>
                  {selected.cancha.nombre} ·{" "}
                  {capitalizeFirst(
                    format(selectedDate, "EEEE d 'de' MMMM", { locale: es }),
                  )}{" "}
                  · {selected.turno.horaInicio} – {selected.turno.horaFin}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {selected && (
              <div className="bg-[#F8F6F1] rounded-lg p-4 space-y-2">
                {/* Cancha selector or fixed name */}
                {selected.availableCanchas.length > 1 ? (
                  <div className="space-y-1">
                    <p className="text-xs text-[#1A1A1A]/50 font-medium">
                      Cancha
                    </p>
                    <Select
                      value={String(selected.cancha.id)}
                      onValueChange={handleCanchaChange}
                    >
                      <SelectTrigger className="w-full border-[#133D34]/20 focus:ring-[#133D34] text-[#133D34] font-semibold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selected.availableCanchas.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="font-semibold text-[#133D34]">
                    {selected.cancha.nombre}
                  </p>
                )}

                <p className="text-sm text-[#1A1A1A]/70 capitalize">
                  {capitalizeFirst(
                    format(selectedDate, "EEEE d 'de' MMMM", { locale: es }),
                  )}
                </p>
                <p
                  className="text-lg font-bold text-[#133D34]"
                  style={{ fontFamily: "var(--font-mono), monospace" }}
                >
                  {selected.turno.horaInicio} – {selected.turno.horaFin}
                </p>
              </div>
            )}
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre *"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="border-[#133D34]/20 focus-visible:ring-[#133D34]"
                />
                <Input
                  placeholder="Apellido *"
                  value={apellido}
                  onChange={(e) => setApellido(e.target.value)}
                  className="border-[#133D34]/20 focus-visible:ring-[#133D34]"
                />
              </div>
            </div>
            <Button
              onClick={handleWhatsApp}
              disabled={!nombre.trim() || !apellido.trim()}
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
