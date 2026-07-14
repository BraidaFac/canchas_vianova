"use client";

import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ZoomIn, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
  UtensilsCrossed,
  ShowerHead,
  PartyPopper,
  Coffee,
  Lightbulb,
  Accessibility,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const FOTOS_PREDIO = [
  {
    src: "/predio/canchas.jpeg",
    caption: "Canchas",
  },
  {
    src: "/predio/predio1.jpeg",
    caption: "El predio",
  },
  {
    src: "/predio/predio2.jpeg",
    caption: "El predio",
  },
  {
    src: "/predio/predio3.jpeg",
    caption: "El predio",
  },

  {
    src: "/predio/baños.jpg",
    caption: "Baños",
  },
  {
    src: "/predio/baños2.jpg",
    caption: "Baños",
  },
];

const SERVICIOS = [
  {
    icon: UtensilsCrossed,
    titulo: "Parrilla",
    descripcion: "Asado de por medio del partido.",
    color: "#C6B997",
  },
  {
    icon: ShowerHead,
    titulo: "Vestuarios",
    descripcion: "Amplios, con duchas para H y M.",
    color: "#133D34",
  },
  {
    icon: PartyPopper,
    titulo: "Festejos",
    descripcion: "Cumpleaños y eventos sin cargo extra.",
    color: "#C6B997",
  },
  {
    icon: Coffee,
    titulo: "Cantina",
    descripcion: "Bebidas y snacks antes, durante y después.",
    color: "#133D34",
  },
  {
    icon: Lightbulb,
    titulo: "LED",
    descripcion: "Iluminación de alta potencia día y noche.",
    color: "#C6B997",
  },
  {
    icon: Accessibility,
    titulo: "Accesibilidad",
    descripcion: "Instalaciones para movilidad reducida.",
    color: "#133D34",
  },
];

// ── Infinite ticker ────────────────────────────────────────────────────────────
function InfiniteCarousel() {
  const tickerRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const dragX = useMotionValue(0);

  // GSAP infinite loop
  useEffect(() => {
    const el = tickerRef.current;
    if (!el) return;

    const totalW = el.scrollWidth / 2; // duplicated set
    tweenRef.current = gsap.to(el, {
      x: `-=${totalW}`,
      duration: 28,
      ease: "none",
      repeat: -1,
      modifiers: {
        x: gsap.utils.unitize(
          (x: string | number) => parseFloat(String(x)) % totalW,
        ),
      },
    });

    return () => {
      tweenRef.current?.kill();
    };
  }, []);

  const pauseTicker = () => tweenRef.current?.pause();
  const resumeTicker = () => tweenRef.current?.play();

  return (
    <div
      className="relative"
      style={{
        overflowX: "hidden",
        overflowY: "visible",
        paddingTop: "12px",
        paddingBottom: "16px",
      }}
      onMouseEnter={pauseTicker}
      onMouseLeave={resumeTicker}
    >
      <motion.div
        ref={tickerRef}
        drag="x"
        dragElastic={0.05}
        style={{ x: dragX, cursor: "grab" }}
        whileDrag={{ cursor: "grabbing" }}
        className="flex gap-5 w-max"
      >
        {/* Duplicate for seamless loop */}
        {[...SERVICIOS, ...SERVICIOS].map((s, i) => {
          const Icon = s.icon;
          const isCrema = s.color === "#C6B997";
          return (
            <motion.div
              key={i}
              whileHover={{ scale: 1.04, y: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="shrink-0 w-60 sm:w-72 rounded-2xl p-6 flex flex-col gap-4"
              style={{
                background: isCrema
                  ? "linear-gradient(145deg, #f5f1e8 0%, #ede8db 100%)"
                  : "linear-gradient(145deg, #133D34 0%, #0f2e27 100%)",
                border: isCrema ? "1px solid #C6B997" : "1px solid #1a5248",
              }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: isCrema ? "#133D34" : "rgba(198,185,151,0.15)",
                }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: isCrema ? "#fff" : "#C6B997" }}
                />
              </div>
              <div>
                <h3
                  className="font-semibold text-base mb-1"
                  style={{ color: isCrema ? "#133D34" : "#F8F6F1" }}
                >
                  {s.titulo}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    color: isCrema
                      ? "rgba(26,26,26,0.6)"
                      : "rgba(248,246,241,0.6)",
                  }}
                >
                  {s.descripcion}
                </p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Edge fades */}
      <div
        className="pointer-events-none absolute left-0 inset-y-0 w-16 z-10"
        style={{
          background: "linear-gradient(to right, #0C2820, transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute right-0 inset-y-0 w-16 z-10"
        style={{ background: "linear-gradient(to left, #0C2820, transparent)" }}
      />
    </div>
  );
}

// ── Photo lightbox ─────────────────────────────────────────────────────────────
function PhotoLightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: typeof FOTOS_PREDIO;
  startIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(startIndex);
  const prev = () => setCurrent((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setCurrent((i) => (i + 1) % photos.length);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "rgba(12,40,32,0.97)" }}
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
      >
        <X className="h-5 w-5 text-white" />
      </button>
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/50 text-sm">
        {current + 1} / {photos.length}
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          prev();
        }}
        className="absolute left-4 sm:left-8 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
      >
        <ChevronLeft className="h-6 w-6 text-white" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
        className="absolute right-4 sm:right-8 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
      >
        <ChevronRight className="h-6 w-6 text-white" />
      </button>

      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, scale: 0.93, x: 30 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.93, x: -30 }}
          transition={{ duration: 0.26 }}
          className="relative w-[min(860px,calc(100vw-5rem))] aspect-video rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src={photos[current].src}
            alt={photos[current].caption}
            fill
            unoptimized
            className="object-cover"
          />
          <div
            className="absolute bottom-0 inset-x-0 px-5 py-3"
            style={{
              background:
                "linear-gradient(to top, rgba(12,40,32,0.85), transparent)",
            }}
          >
            <p className="text-[#C6B997] text-sm font-medium">
              {photos[current].caption}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {photos.map((_, i) => (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              setCurrent(i);
            }}
            className="rounded-full transition-all cursor-pointer"
            style={{
              width: i === current ? 20 : 8,
              height: 8,
              background: i === current ? "#C6B997" : "rgba(255,255,255,0.25)",
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
export default function ServiciosSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // GSAP title reveal
  useEffect(() => {
    const ctx = gsap.context(() => {
      if (titleRef.current) {
        gsap.from(titleRef.current, {
          opacity: 0,
          y: 40,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: {
            trigger: titleRef.current,
            start: "top 82%",
            once: true,
          },
        });
      }
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="servicios"
      className="py-24 overflow-hidden"
      style={{ background: "#0C2820" }}
    >
      {/* ── Servicios carousel ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-14">
        <div ref={titleRef}>
          <p className="text-[#C6B997] text-sm font-semibold tracking-widest uppercase mb-3">
            Instalaciones
          </p>
          <h2
            className="text-4xl sm:text-5xl font-bold text-white leading-tight max-w-lg mb-4"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Todo lo que necesitás{" "}
            <span className="text-[#C6B997]">en un solo lugar</span>
          </h2>
          <p className="text-white/40 text-sm">
            Pasá el mouse por las cards o deslizá
          </p>
        </div>
      </div>

      <InfiniteCarousel />

      {/* ── Fotos del predio ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7 }}
          className="mb-8"
        >
          <p className="text-[#C6B997] text-sm font-semibold tracking-widest uppercase mb-2">
            El predio
          </p>
          <h3
            className="text-3xl font-bold text-white"
            style={{ fontFamily: "var(--font-display), serif" }}
          >
            Conocé nuestras instalaciones
          </h3>
        </motion.div>

        {/* Masonry-style grid */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.07 } },
          }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"
        >
          {FOTOS_PREDIO.map((foto, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, scale: 0.93 },
                show: { opacity: 1, scale: 1, transition: { duration: 0.45 } },
              }}
              whileHover={{ scale: 1.03, zIndex: 5 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              onClick={() => setLightboxIdx(i)}
              className={`relative rounded-xl overflow-hidden cursor-pointer group ${
                i === 0
                  ? "col-span-2 row-span-2 aspect-square"
                  : "aspect-square"
              }`}
            >
              <Image
                src={foto.src}
                alt={foto.caption}
                fill
                unoptimized
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[#0C2820]/0 group-hover:bg-[#0C2820]/40 transition-colors duration-300 flex items-center justify-center">
                <ZoomIn className="h-7 w-7 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </div>
              {/* Caption on hover */}
              <div
                className="absolute bottom-0 inset-x-0 px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{
                  background:
                    "linear-gradient(to top, rgba(12,40,32,0.9), transparent)",
                }}
              >
                <p className="text-white text-xs font-medium">{foto.caption}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.5 }}
          className="text-white/25 text-xs mt-4"
        >
          · Hacé click en cualquier foto para ampliar
        </motion.p>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIdx !== null && (
          <PhotoLightbox
            photos={FOTOS_PREDIO}
            startIndex={lightboxIdx}
            onClose={() => setLightboxIdx(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
