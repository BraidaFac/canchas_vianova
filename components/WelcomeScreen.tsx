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

      <div className="text-center space-y-8 z-10">
        {/* Logo de la empresa */}
        <div className="mb-8 flex flex-col items-center justify-center">
          <div className="w-full h-full mx-auto mb-4 rounded-full flex items-center justify-center">
            <Image
              src="/blanco.png"
              alt="ViaNova Logo"
              width={500}
              height={500}
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="md:text-8xl text-6xl font-bold text-white mb-2">
            Vía Nova
          </h1>
          <p className="md:text-3xl text-xl text-white">COMPLEJO DEPORTIVO</p>
        </div>

        {/* Botones de selección */}
        <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
          {/* Botón Fútbol 5 */}
          <Button
            onClick={(e) => handleEnter(e, 1)}
            disabled={isLoading}
            className={`
              relative overflow-hidden
              bg-gradient-to-r from-emerald-500 to-green-600
              hover:from-emerald-600 hover:to-green-700
              text-white font-bold
              md:px-12 md:py-8 px-10 py-7
              text-xl md:text-2xl
              rounded-2xl
              transition-all duration-300
              transform hover:scale-110 hover:-rotate-2
              shadow-2xl hover:shadow-emerald-500/50
              border-4 border-white/20
              ${isLoading ? "opacity-50" : ""}
            `}
            style={{
              animation: !isLoading
                ? "float 3s ease-in-out infinite, pulse-green 2s ease-in-out infinite"
                : "",
            }}
          >
            <span className="relative z-10">⚽ Fútbol 5</span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] transition-transform duration-1000" />
          </Button>

          {/* Botón Fútbol 7 */}
          <Button
            onClick={(e) => handleEnter(e, 2)}
            disabled={isLoading}
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
        </div>

        {isLoading && (
          <p className="text-white text-lg animate-pulse mt-4">
            Cargando canchas...
          </p>
        )}
      </div>

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
      `}</style>
    </div>
  );
}
