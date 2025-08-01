"use client";
import { addDays, format, isAfter, isBefore, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import WelcomeScreen from "@/components/WelcomeScreen";
import { Turno } from "@/lib/turnos";
import { cn } from "@/lib/utils";

// Tipo para los turnos disponibles
type TurnosDisponibles = Record<string, Turno[]>;

export default function TurnosPage() {
  const [mostrarBienvenida, setMostrarBienvenida] = useState(true);
  const [fecha, setFecha] = useState<Date | undefined>(undefined);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [turnosDisponibles, setTurnosDisponibles] = useState<TurnosDisponibles>(
    {
      "1": [],
      "2": [],
      "3": [],
      "4": [],
      "5": [],
    }
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [hoy, setHoy] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [allTurnos, setAllTurnos] = useState<Record<string, Turno[]>>({});
  const initializedRef = useRef(false);

  const obtenerTurnosDisponibles = async (fecha: Date) => {
    if (!mounted) return;
    setCargando(true);
    setError(null);

    try {
      // Formatear la fecha como DD/MM para filtrar
      const fechaFormateada = format(fecha, "dd/MM");

      // Filtrar los turnos por fecha desde allTurnos
      const turnosFiltrados: TurnosDisponibles = {
        cancha1: [],
        cancha2: [],
      };
      console.log("allTurnos", allTurnos);
      console.log("fechaFormateada", fechaFormateada);
      if (allTurnos[fechaFormateada]) {
        turnosFiltrados.cancha1 = allTurnos[fechaFormateada].filter(
          (turno) => turno.canchaId === 1
        );
        turnosFiltrados.cancha2 = allTurnos[fechaFormateada].filter(
          (turno) => turno.canchaId === 2
        );
      }
      console.log("turnosFiltrados", turnosFiltrados);

      setTurnosDisponibles(turnosFiltrados);
    } catch {
      setError("No se pudieron cargar los turnos. Intenta de nuevo más tarde.");
    } finally {
      setCargando(false);
    }
  };

  const seleccionarFecha = (fechaSeleccionada: Date | undefined) => {
    // Validaciones tempranas
    if (!fechaSeleccionada || !mounted || !hoy) {
      return;
    }

    // Verificar si la fecha está en el pasado
    if (isBefore(fechaSeleccionada, hoy)) {
      setError("No se pueden seleccionar fechas pasadas");
      return;
    }

    // Verificar límite de 15 días
    const limiteFecha = addDays(hoy, 14);
    if (isAfter(fechaSeleccionada, limiteFecha)) {
      setWarning(
        "No se pueden visualizar los turnos después de 15 días desde hoy"
      );
      setFecha(fechaSeleccionada);
      setDialogoAbierto(true);
      return;
    }

    // Limpiar estados previos
    setError(null);
    setWarning(null);

    // Actualizar estado y abrir diálogo
    setFecha(fechaSeleccionada);
    setDialogoAbierto(true);

    // Obtener turnos disponibles
    obtenerTurnosDisponibles(fechaSeleccionada);
  };

  const handleIngresar = () => {
    setMostrarBienvenida(false);
  };

  const obtenerAllTurnos = async () => {
    setCargando(true);
    const response = await fetch("/api/turnos");

    if (!response.ok) {
      setError("No se pudieron cargar los turnos. Intenta de nuevo más tarde.");
      setCargando(false);
      return;
    }
    const allTurnos = await response.json();
    setAllTurnos(allTurnos);
    setCargando(false);
  };

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    setHoy(startOfToday());
    setMounted(true);
    obtenerAllTurnos();
  }, []);

  useEffect(() => {
    if (!dialogoAbierto) {
      setFecha(undefined);
    }
  }, [dialogoAbierto]);

  // Mostrar pantalla de bienvenida
  if (mostrarBienvenida) {
    return <WelcomeScreen onEnter={handleIngresar} />;
  }

  if (!mounted || !hoy) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-center border-b bg-background px-4">
          <h1 className="text-xl font-semibold">Turnos de Fútbol</h1>
        </header>
        <main className="flex-1 p-4">
          <div className="mx-auto max-w-md space-y-6">
            <div className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2">Cargando...</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className={`flex min-h-screen flex-col bg-background transition-all duration-300 ${
        dialogoAbierto ? "blur-sm" : ""
      }`}
    >
      <header className="sticky top-0 z-10 flex h-16 items-center justify-center border-b bg-background px-4">
        <h1 className="text-xl font-semibold">Turnos ViaNova</h1>
      </header>

      <main className="flex-1 p-4">
        <div className="mx-auto max-w-md space-y-6">
          {error ? (
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-2">
                    ¡Ups! Tenemos un problema técnico
                  </h2>
                  <p className="text-gray-600 mb-4">
                    No pudimos cargar los turnos disponibles en este momento.
                    Para obtener información actualizada sobre los horarios
                    libres, te recomendamos contactar directamente a las
                    canchas.
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-medium text-green-800 mb-2">
                      📱 Contacta por WhatsApp
                    </h3>
                    <p className="text-green-700 text-sm">
                      Envía un mensaje a las canchas para consultar los turnos
                      disponibles y realizar tu reserva de forma directa.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="w-full flex justify-center">
                  <div className="flex items-center gap-x-4">
                    <h2 className="text-lg font-medium">Selecciona un día</h2>
                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  {hoy && (
                    <Calendar
                      mode="single"
                      selected={fecha}
                      locale={es}
                      onSelect={seleccionarFecha}
                      disabled={(date) => isBefore(date, hoy)}
                      className="mx-auto"
                      classNames={{
                        day_selected:
                          "text-primary-foreground  hover:text-primary-foreground  focus:text-primary-foreground",
                        day_today:
                          "bg-accent text-accent-foreground text-destructive",
                        day: cn(
                          "hover:bg-gray-100 hover:text-primary-foreground",
                          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
                        ),
                        day_disabled: "text-muted-foreground opacity-50",
                        nav_button:
                          "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100",
                        nav_button_previous: "absolute left-1",
                        nav_button_next: "absolute right-1",
                        caption:
                          "flex justify-center py-2 relative items-center",
                        caption_label: "text-sm font-medium",
                        cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      }}
                      components={{
                        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
                        IconRight: () => <ChevronRight className="h-4 w-4" />,
                      }}
                    />
                  )}
                </div>
              </div>

              <div className="rounded-lg border bg-card p-4 shadow-sm">
                <h2 className="text-lg font-medium">Instrucciones</h2>
                <ul className="mt-2 space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-2 w-2 rounded-full bg-green-600" />
                    <span>
                      Selecciona un día para ver los turnos disponibles
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-2 w-2 rounded-full bg-green-600" />
                    <span>Los días pasados aparecen deshabilitados</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-2 w-2 rounded-full bg-green-600" />
                    <span>Verás los horarios disponibles para cada cancha</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-0.5 h-2 w-2 rounded-full bg-green-600" />
                    <span>
                      Los turnos después de 15 días no están disponibles
                    </span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      </main>

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="mt-4">
            <DialogTitle className="text-center">
              {fecha && mounted && !error && !warning && "Turnos disponibles: "}

              {fecha && mounted && !error && !warning && (
                <>
                  <span className="capitalize ">
                    {format(fecha, "EEEE d 'de' MMMM", { locale: es })}
                  </span>
                </>
              )}

              {warning && "Fecha no disponible"}
              {error && !warning && !fecha && "Error"}
            </DialogTitle>
          </DialogHeader>

          {cargando ? (
            <div className="flex h-[300px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="ml-2">Cargando turnos...</span>
            </div>
          ) : error || warning ? (
            <Alert variant={error ? "destructive" : "default"} className="mt-4">
              <AlertTitle className="text-center mb-4 text-lg">
                {error ? "Error" : "Acción no permitida"}
              </AlertTitle>
              <AlertDescription className="text-center">
                {error || warning}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="space-y-3">
                <h3 className="text-center font-medium">Cancha 1</h3>
                <Separator />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 px-1">
                    {turnosDisponibles.cancha1 &&
                    turnosDisponibles.cancha1.length > 0 ? (
                      turnosDisponibles.cancha1.map((turno) => (
                        <Button
                          key={turno.id}
                          className={`w-full text-center ${"text-green-700 hover:bg-green-50"}`}
                        >
                          {turno.horaInicio} - {turno.horaFin}
                        </Button>
                      ))
                    ) : (
                      <p className="text-center text-sm text-gray-500">
                        No hay turnos para esta fecha
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-3">
                <h3 className="text-center font-medium">Cancha 2</h3>
                <Separator />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 px-1">
                    {turnosDisponibles.cancha2 &&
                    turnosDisponibles.cancha2.length > 0 ? (
                      turnosDisponibles.cancha2.map((turno) => (
                        <Button
                          key={turno.id}
                          className={`w-full text-center ${"text-green-700 hover:bg-green-50"}`}
                        >
                          {turno.horaInicio} - {turno.horaFin}
                        </Button>
                      ))
                    ) : (
                      <p className="text-center text-sm text-gray-500">
                        No hay turnos para esta fecha
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
