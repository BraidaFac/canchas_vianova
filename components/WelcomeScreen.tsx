"use client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
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
              willChange: "transform, opacity", // Optimización para animaciones
            }}
          />
        ))}

      <div className="text-center space-y-8">
        {/* Logo de la empresa */}
        <div className="mb-8 flex flex-col items-center justify-center">
          <div className="w-full h-full mx-auto mb-4  rounded-full flex items-center justify-center">
            <Image
              src="/blanco.png"
              alt="ViaNova Logo"
              width={500}
              height={500}
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="md:text-8xl text-6xl font-bold text-white  mb-2">
            Vía Nova
          </h1>
          <p className="md:text-3xl text-xl text-white">COMPLEJO DEPORTIVO</p>
        </div>

        {/* Botón de ingreso */}
        <Button
          onClick={handleEnter}
          disabled={isLoading}
          className={`bg-white text-black hover:bg-gray-200 md:px-16 md:py-6 px-16 py-8 text-lg font-semibold rounded-lg transition-all duration-300 transform hover:scale-105 animate-float shadow-lg hover:shadow-xl ${
            isLoading ? "animate-pulse" : ""
          }`}
          style={{
            animation: isLoading
              ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
              : "glow 2s ease-in-out infinite alternate, float 3s ease-in-out infinite",
          }}
        >
          {isLoading ? "Ingresando..." : "Ingresar"}
        </Button>
      </div>
    </div>
  );
}
