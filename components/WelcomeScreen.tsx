"use client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useEffect, useState } from "react";

interface WelcomeScreenProps {
  onEnter: (tipoFutbol: 1 | 2) => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  opacity: number;
  size: number;
  color: string;
}

export default function WelcomeScreen({ onEnter }: WelcomeScreenProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showParticles, setShowParticles] = useState(false);

  // Array de colores vibrantes para las partículas
  const colors = [
    "#FF6B6B", // Rojo
    "#4ECDC4", // Turquesa
    "#45B7D1", // Azul
    "#96CEB4", // Verde menta
    "#FFEAA7", // Amarillo
    "#DDA0DD", // Lavanda
    "#FFB347", // Naranja
    "#98D8C8", // Verde agua
    "#F7DC6F", // Amarillo dorado
    "#BB8FCE", // Violeta
    "#85C1E9", // Azul cielo
    "#F8C471", // Melocotón
    "#82E0AA", // Verde lima
    "#F1948A", // Rosa salmón
    "#85C1E9", // Azul claro
  ];

  const createParticles = (x: number, y: number) => {
    const newParticles: Particle[] = [];
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    for (let i = 0; i < 30; i++) {
      // Crear partículas que se expandan por toda la pantalla
      const targetX = Math.random() * screenWidth;
      const targetY = Math.random() * screenHeight;

      // Calcular velocidad hacia el objetivo
      const dx = targetX - x;
      const dy = targetY - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const speed = 15 + Math.random() * 20; // Velocidad mucho más alta

      newParticles.push({
        id: i,
        x: x,
        y: y,
        vx: (dx / distance) * speed, // Velocidad hacia el objetivo
        vy: (dy / distance) * speed,
        opacity: 1,
        size: Math.random() * 6 + 3,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    setParticles(newParticles);
    setShowParticles(true);
  };

  useEffect(() => {
    if (showParticles) {
      const interval = setInterval(() => {
        setParticles((prev) =>
          prev
            .map((particle) => ({
              ...particle,
              x: particle.x + particle.vx * 0.3, // Movimiento mucho más rápido
              y: particle.y + particle.vy * 0.3,
              opacity: particle.opacity - 0.008, // Desvanecimiento más rápido
              size: particle.size - 0.02, // Reducción más rápida del tamaño
            }))
            .filter((particle) => particle.opacity > 0)
        );
      }, 16); // 60 FPS para animación más fluida

      return () => clearInterval(interval);
    }
  }, [showParticles]);

  const handleEnter = (
    event: React.MouseEvent<HTMLButtonElement>,
    tipoFutbol: 1 | 2
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    createParticles(x, y);
    setIsLoading(true);

    // Simular un pequeño delay para la transición
    setTimeout(() => {
      onEnter(tipoFutbol);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Partículas animadas */}
      {showParticles &&
        particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: particle.x,
              top: particle.y,
              opacity: particle.opacity,
              width: particle.size,
              height: particle.size,
              backgroundColor: particle.color,
              transform: "translate(-50%, -50%)",
              boxShadow: `0 0 ${particle.size * 2}px ${particle.color}`,
              willChange: "transform, opacity",
            }}
          />
        ))}

      <article className="text-center space-y-8 z-10">
        {/* Logo de la empresa */}
        <header className="mb-8 flex flex-col items-center justify-center">
          <div className="w-full h-full mx-auto mb-4 rounded-full flex items-center justify-center">
            <Image
              src="/blanco.png"
              alt="ViaNova Canchas de Fútbol Sintético - Logo del complejo deportivo en Reconquista, Santa Fe"
              width={500}
              height={500}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <h1 className="md:text-8xl text-6xl font-bold text-white mb-2">
            Vía Nova
          </h1>
          <p className="md:text-3xl text-xl text-white">COMPLEJO DEPORTIVO</p>
          {/* Contenido SEO adicional - visible pero sutil */}
          <p className="text-gray-400 mt-4 max-w-2xl text-sm md:text-base hidden">
            Canchas de fútbol 5 y fútbol 7 con césped de última generación en
            Reconquista, Santa Fe.
          </p>
        </header>

        {/* Botones de selección */}
        <section
          className="flex flex-col md:flex-row gap-6 items-center justify-center"
          aria-label="Seleccionar tipo de cancha"
        >
          {/* Botón Fútbol 5 */}
          <div className="flex flex-col items-center gap-3">
            <Button
              onClick={(e) => handleEnter(e, 1)}
              disabled={true}
              aria-label="Reservar cancha de Fútbol 5 en ViaNova"
              className={`
                relative overflow-hidden
                bg-gradient-to-r from-gray-500/40 to-gray-600/40
                text-white/60 font-bold
                md:px-12 md:py-8 px-10 py-7
                text-xl md:text-2xl
                rounded-2xl
                transition-all duration-300
                shadow-2xl
                border-4 border-white/10
                opacity-50 cursor-not-allowed
              `}
            >
              <span className="relative z-10">⚽ Fútbol 5</span>
            </Button>
            <div className="relative">
              <div
                className="relative overflow-hidden bg-gradient-to-r from-emerald-500/20 to-green-500/20 backdrop-blur-sm text-emerald-300 font-semibold px-6 py-2 rounded-lg text-sm md:text-base shadow-xl border border-emerald-400/30"
                style={{
                  animation:
                    " 2s ease-in-out infinite, pulse-glow 2s ease-in-out infinite",
                }}
              >
                <span className="relative z-10">🚧 Próximamente 🚧</span>
                {/* Efecto shimmer/brillo que se desliza */}
                <div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-300/30 to-transparent transform -skew-x-12 translate-x-[-200%]"
                  style={{
                    animation: "shimmer 3s ease-in-out infinite",
                  }}
                />
              </div>
              <div
                className="absolute inset-0 bg-emerald-500/20 rounded-lg blur-xl"
                style={{
                  animation: "pulse-spread 2s ease-in-out infinite",
                }}
              />
            </div>
          </div>

          {/* Botón Fútbol 7 */}
          <Button
            onClick={(e) => handleEnter(e, 2)}
            disabled={isLoading}
            aria-label="Reservar cancha de Fútbol 7 en ViaNova"
            className={`
              relative overflow-hidden
              bg-gradient-to-r from-blue-500 to-indigo-600
              hover:from-blue-600 hover:to-indigo-700
              text-white font-bold
              md:px-12 md:py-8 px-10 py-7
              text-xl md:text-2xl
              rounded-2xl
              transition-all duration-300
              transform hover:scale-110 hover:rotate-2
              shadow-2xl hover:shadow-blue-500/50
              border-4 border-white/20
              ${isLoading ? "opacity-50" : ""}
            `}
            style={{
              animation: !isLoading
                ? "float 3s ease-in-out infinite 0.5s, pulse-blue 2s ease-in-out infinite"
                : "",
            }}
          >
            <span className="relative z-10">⚽ Fútbol 7</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000" />
          </Button>
        </section>

        {isLoading && (
          <p className="text-white text-lg animate-pulse mt-4">
            Cargando canchas...
          </p>
        )}

        {/* Información adicional para SEO */}
        <footer className="mt-8 text-gray-500 text-xs md:text-sm max-w-3xl mx-auto space-y-2 hidden">
          <p>
            <strong className="text-gray-400">📍 Ubicación:</strong>{" "}
            Reconquista, Santa Fe, Argentina
          </p>
          <p>
            <strong className="text-gray-400">⏰ Horarios:</strong> Abierto
            todos los días de 8:00 a 23:00
          </p>
          <p>
            <strong className="text-gray-400">📱 Contacto:</strong> +54 9 3482
            678377 (WhatsApp disponible)
          </p>
          <p className="pt-2">
            Nuestras canchas de <strong>fútbol 5</strong> y{" "}
            <strong>fútbol 7</strong> cuentan con césped sintético de última
            generación, iluminación LED profesional. Ideal para partidos con
            amigos, torneos y eventos deportivos en Reconquista.
          </p>
        </footer>
      </article>

      <style jsx>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes pulse-green {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(16, 185, 129, 0.5),
              0 0 40px rgba(16, 185, 129, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(16, 185, 129, 0.8),
              0 0 60px rgba(16, 185, 129, 0.5);
          }
        }

        @keyframes pulse-blue {
          0%,
          100% {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.5),
              0 0 40px rgba(59, 130, 246, 0.3);
          }
          50% {
            box-shadow: 0 0 30px rgba(59, 130, 246, 0.8),
              0 0 60px rgba(59, 130, 246, 0.5);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-200%) skewX(-12deg);
          }
          100% {
            transform: translateX(200%) skewX(-12deg);
          }
        }

        @keyframes pulse-glow {
          0%,
          100% {
            box-shadow: 0 0 15px rgba(16, 185, 129, 0.4),
              0 0 30px rgba(16, 185, 129, 0.2);
            border-color: rgba(16, 185, 129, 0.3);
          }
          50% {
            box-shadow: 0 0 25px rgba(16, 185, 129, 0.7),
              0 0 50px rgba(16, 185, 129, 0.4);
            border-color: rgba(16, 185, 129, 0.6);
          }
        }

        @keyframes pulse-spread {
          0%,
          100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.1);
          }
        }
      `}</style>
    </div>
  );
}
