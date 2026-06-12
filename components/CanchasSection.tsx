"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Users, Lightbulb, ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";

// ─── REPLACE estas fotos con las reales del predio ────────────────────────────
const CANCHAS_DATA = [
  {
    tipo: "f8" as const,
    label: "Fútbol 8",
    detalle: "Canchas 1 y 2 · 16 jugadores · Iluminación LED",
    cover: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=85",
    fotos: [
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=85",
      "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1200&q=85",
      "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=1200&q=85",
      "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1200&q=85",
    ],
  },
  {
    tipo: "f5" as const,
    label: "Fútbol 5",
    detalle: "Canchas A, B y C · 10 jugadores · Iluminación LED",
    cover: "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1200&q=85",
    fotos: [
      "https://images.unsplash.com/photo-1459865264687-595d652de67e?w=1200&q=85",
      "https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=1200&q=85",
      "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=1200&q=85",
      "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=85",
    ],
  },
];
// ─────────────────────────────────────────────────────────────────────────────

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({
  fotos,
  startIndex,
  label,
  onClose,
}: {
  fotos: string[];
  startIndex: number;
  label: string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);
  const dragX = useMotionValue(0);
  const opacity = useTransform(dragX, [-200, 0, 200], [0.4, 1, 0.4]);

  const prev = useCallback(() => setCurrent((i) => (i - 1 + fotos.length) % fotos.length), [fotos.length]);
  const next = useCallback(() => setCurrent((i) => (i + 1) % fotos.length), [fotos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number } }) => {
    if (info.offset.x < -60) next();
    else if (info.offset.x > 60) prev();
    dragX.set(0);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(12, 40, 32, 0.97)" }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
      >
        <X className="h-5 w-5 text-white" />
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-3">
        <span className="text-[#C6B997] text-sm font-medium tracking-wide">{label}</span>
        <span className="text-white/40 text-sm">{current + 1} / {fotos.length}</span>
      </div>

      {/* Arrows */}
      <button
        onClick={(e) => { e.stopPropagation(); prev(); }}
        className="absolute left-4 sm:left-8 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
      >
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); next(); }}
        className="absolute right-4 sm:right-8 z-10 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors cursor-pointer"
      >
        <ChevronRight className="h-6 w-6 text-white" />
      </button>

      {/* Image */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 0.94, x: 40 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.94, x: -40 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          style={{ x: dragX, opacity }}
          onDragEnd={handleDragEnd}
          className="relative w-[min(900px,calc(100vw-4rem))] aspect-video rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src={fotos[current]}
            alt={`${label} foto ${current + 1}`}
            fill
            unoptimized
            className="object-cover"
          />
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {fotos.map((_, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
            className="rounded-full transition-all cursor-pointer"
            style={{
              width: i === current ? 20 : 8,
              height: 8,
              background: i === current ? "#C6B997" : "rgba(255,255,255,0.3)",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────
function CanchaCard({ cancha }: { cancha: typeof CANCHAS_DATA[0] }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [hoverProgress, setHoverProgress] = useState(0); // 0–1
  const hoverTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const HOVER_DURATION = 2000; // ms

  const startHover = () => {
    const start = Date.now();
    hoverTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / HOVER_DURATION, 1);
      setHoverProgress(progress);
      if (progress >= 1) {
        clearInterval(hoverTimerRef.current!);
        setLightboxOpen(true);
      }
    }, 16);
  };

  const stopHover = () => {
    if (hoverTimerRef.current) clearInterval(hoverTimerRef.current);
    setHoverProgress(0);
  };

  useEffect(() => () => { if (hoverTimerRef.current) clearInterval(hoverTimerRef.current); }, []);

  // Arc circumference for SVG progress ring
  const R = 22;
  const CIRC = 2 * Math.PI * R;
  const dash = CIRC * hoverProgress;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, ease: "easeOut" }}
        whileHover={{ y: -4 }}
        onMouseEnter={startHover}
        onMouseLeave={stopHover}
        onClick={() => setLightboxOpen(true)}
        className="relative rounded-2xl overflow-hidden aspect-[4/3] sm:aspect-[16/10] group cursor-pointer select-none"
      >
        <Image
          src={cancha.cover}
          alt={cancha.label}
          fill
          unoptimized
          className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to top, rgba(12,40,32,0.92) 0%, rgba(19,61,52,0.45) 50%, rgba(19,61,52,0.15) 100%)"
        }} />

        {/* Top-right: progress ring + zoom icon */}
        <div className="absolute top-4 right-4 flex items-center justify-center">
          {hoverProgress > 0 ? (
            <svg width="52" height="52" className="-rotate-90">
              <circle cx="26" cy="26" r={R} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
              <circle
                cx="26" cy="26" r={R} fill="none"
                stroke="#C6B997" strokeWidth="3"
                strokeDasharray={`${dash} ${CIRC}`}
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
            >
              <ZoomIn className="h-4 w-4 text-white" />
            </motion.div>
          )}
        </div>

        {/* Bottom content */}
        <div className="absolute inset-0 p-6 flex flex-col justify-end">
          {/* Thumbnail strip */}
          <div className="flex gap-2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            {cancha.fotos.slice(0, 4).map((foto, i) => (
              <div key={i} className="relative w-12 h-9 rounded-lg overflow-hidden ring-1 ring-white/30 shrink-0">
                <Image src={foto} alt="" fill unoptimized className="object-cover" />
              </div>
            ))}
            {cancha.fotos.length > 4 && (
              <div className="w-12 h-9 rounded-lg bg-black/40 flex items-center justify-center ring-1 ring-white/20 shrink-0">
                <span className="text-white/80 text-xs font-medium">+{cancha.fotos.length - 4}</span>
              </div>
            )}
          </div>

          <h3
            className="text-white font-bold text-3xl mb-2 leading-none"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            {cancha.label}
          </h3>
          <div className="flex items-center gap-4 text-white/70 text-sm">
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4" />
              {cancha.tipo === "f8" ? "16 jugadores" : "10 jugadores"}
            </span>
            <span className="flex items-center gap-1.5">
              <Lightbulb className="h-4 w-4" />
              Iluminación LED
            </span>
          </div>

          {/* Hover CTA */}
          <motion.div
            initial={false}
            animate={{ opacity: 1 }}
            className="mt-3 text-[#C6B997] text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center gap-1.5"
          >
            <span>Ver fotos</span>
            <span className="text-[#C6B997]/60">· hacé click o mantené hover</span>
          </motion.div>
        </div>
      </motion.div>

      <AnimatePresence>
        {lightboxOpen && (
          <Lightbox
            fotos={cancha.fotos}
            startIndex={0}
            label={cancha.label}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export default function CanchasSection() {
  return (
    <section id="canchas" className="py-20 bg-[#F8F6F1]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2
            className="text-4xl font-bold text-[#133D34] mb-3"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Nuestras canchas
          </h2>
          <p className="text-[#1A1A1A]/60 max-w-lg mx-auto">
            Césped sintético de alta gama con iluminación LED.
            Hacé click en cualquier cancha para ver las fotos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {CANCHAS_DATA.map((cancha) => (
            <CanchaCard key={cancha.tipo} cancha={cancha} />
          ))}
        </div>
      </div>
    </section>
  );
}
