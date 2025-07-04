"use client";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface WelcomeScreenProps {
  onEnter: () => void;
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
    for (let i = 0; i < 30; i++) {
      newParticles.push({
        id: i,
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 25, // Velocidad más alta para distribuir por toda la pantalla
        vy: (Math.random() - 0.5) * 25,
        opacity: 1,
        size: Math.random() * 6 + 3, // Partículas un poco más grandes
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
              x: particle.x + particle.vx,
              y: particle.y + particle.vy,
              opacity: particle.opacity - 0.015, // Desvanecimiento más lento
              size: particle.size - 0.05,
            }))
            .filter((particle) => particle.opacity > 0)
        );
      }, 16);

      return () => clearInterval(interval);
    }
  }, [showParticles]);

  const handleEnter = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    createParticles(x, y);
    setIsLoading(true);

    // Simular un pequeño delay para la transición
    setTimeout(() => {
      onEnter();
    }, 1200); // Un poco más de tiempo para ver la animación completa
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
            }}
          />
        ))}

      <div className="text-center space-y-8">
        {/* Logo de la empresa */}
        <div className="mb-8">
          <div className="w-32 h-32 mx-auto mb-4 bg-white rounded-full flex items-center justify-center">
            <span className="text-4xl font-bold text-black">VN</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">ViaNova</h1>
          <p className="text-gray-300 text-lg">Turnos de Canchas</p>
        </div>

        {/* Botón de ingreso */}
        <Button
          onClick={handleEnter}
          disabled={isLoading}
          className={`bg-white text-black hover:bg-gray-200 px-8 py-3 text-lg font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 ${
            isLoading ? "animate-pulse" : ""
          }`}
          size="lg"
        >
          {isLoading ? "Ingresando..." : "Ingresar"}
        </Button>
      </div>
    </div>
  );
}
