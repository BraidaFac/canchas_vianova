"use client";
import {
  addDays,
  format,
  isAfter,
  isBefore,
  startOfDay,
  startOfToday,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import WelcomeScreen from "@/components/WelcomeScreen";
import { avisos } from "@/lib/avisos";
import { TurnosCanchas } from "@/lib/turnos";
import { cn } from "@/lib/utils";

// Tipo para los turnos disponibles

// Función helper para capitalizar la primera letra
const capitalizeFirst = (text: string): string => {
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const mapCanchas = {
  1: [3, 4, 5], // Fútbol 5
  2: [1, 2], // Fútbol 7
};
const numeroWhatsApp = "+5493482678377";
export default function TurnosPage() {
  const [mostrarBienvenida, setMostrarBienvenida] = useState(true);
  const [tipoFutbol, setTipoFutbol] = useState<1 | 2 | null>(null);
  const [fecha, setFecha] = useState<Date | undefined>(undefined);
  const [dialogoAviso, setdialogoAviso] = useState(false);
  const [dialogoAbierto, setDialogoAbierto] = useState(false);
  const [turnosDisponibles, setTurnosDisponibles] = useState<TurnosCanchas>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [hoy, setHoy] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);
  const [allTurnos, setAllTurnos] = useState<TurnosCanchas>([]);
  const initializedRef = useRef(false);
  const [dialogoReservaAbierto, setDialogoReservaAbierto] = useState(false);
  const [nombre, setNombre] = useState<string>("");
  const [turnoSeleccionado, setTurnoSeleccionado] = useState<{
    dia: Date;
    horaInicio: string;
    horaFin: string;
    cancha: string;
  } | null>(null);
  const [mostrarIndicadorScroll, setMostrarIndicadorScroll] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const obtenerTurnosDisponibles = async (fecha: Date) => {
    if (!mounted) return;
    setCargando(true);

    if (!tipoFutbol) setError("Debes seleccionar un tipo de fútbol");
    const canchasSegunTipoFutbol = mapCanchas[tipoFutbol!];

    const fechaFormateada = format(fecha, "dd/MM");
    const nuevosTurnos = allTurnos
      .filter((cancha) => canchasSegunTipoFutbol.includes(cancha.id))
      .map((cancha) => {
        if (cancha.turnos[fechaFormateada]) {
          return {
            ...cancha,
            turnosDisponibles: cancha.turnos[fechaFormateada],
          };
        }
        return cancha;
      });
    setTurnosDisponibles(nuevosTurnos as TurnosCanchas);
    setCargando(false);
  };

  const seleccionarFecha = (fechaSeleccionada: Date | undefined) => {
    // Validaciones tempranas
    if (!fechaSeleccionada || !mounted || !hoy) {
      return;
    }

    fechaSeleccionada = startOfDay(fechaSeleccionada);
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

  const handleIngresar = (tipo: 1 | 2) => {
    setTipoFutbol(tipo);
    setMostrarBienvenida(false);
    if (tipo === 1) {
      setdialogoAviso(true);
      setTimeout(() => {
        setdialogoAviso(false);
      }, 5000);
    }
  };

  const handleSeleccionarTurno = (
    dia: Date,
    horaInicio: string,
    horaFin: string,
    cancha: string
  ) => {
    setTurnoSeleccionado({ dia, horaInicio, horaFin, cancha });
    setDialogoReservaAbierto(true);
  };

  const handleEnviarWhatsApp = () => {
    if (!turnoSeleccionado) return;

    const fechaFormateada = capitalizeFirst(
      format(turnoSeleccionado.dia, "EEEE d 'de' MMMM", {
        locale: es,
      })
    );
    const mensaje = `Quiero reservar el turno del ${fechaFormateada} de ${turnoSeleccionado.horaInicio} - ${turnoSeleccionado.horaFin} de la ${turnoSeleccionado.cancha}. Mi nombre es ${nombre}.`;
    const mensajeCodificado = encodeURIComponent(mensaje);
    window.open(
      `https://wa.me/${numeroWhatsApp}?text=${mensajeCodificado}`,
      "_blank"
    );
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

  // Reset del tipo de fútbol al volver al welcome screen
  useEffect(() => {
    if (mostrarBienvenida) {
      setTipoFutbol(null);
    }
  }, [mostrarBienvenida]);

  useEffect(() => {
    if (!dialogoAbierto || cargando || error || warning) {
      setMostrarIndicadorScroll(false);
      return;
    }

    const checkScroll = () => {
      const container = scrollContainerRef.current;
      // Verificar que el container exista cada vez que se llama checkScroll
      if (!container) {
        return;
      }

      const hasScroll = container.scrollHeight > container.clientHeight;

      // Calculamos cuánto falta para llegar al final
      const scrollBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;

      // Consideramos que está al final si falta menos de 50px
      const isAtBottom = scrollBottom < 50;

      console.log("Scroll Debug:", {
        scrollHeight: container.scrollHeight,
        scrollTop: container.scrollTop,
        clientHeight: container.clientHeight,
        scrollBottom: scrollBottom.toFixed(2),
        isAtBottom,
        hasScroll,
        shouldShow: hasScroll && !isAtBottom,
      });

      // Solo mostrar si hay scroll Y NO estamos al final (o cerca)
      setMostrarIndicadorScroll(hasScroll && !isAtBottom);
    };

    // Corre varias veces para asegurar render completo
    const timeouts = [
      setTimeout(checkScroll, 50),
      setTimeout(checkScroll, 150),
      setTimeout(checkScroll, 300),
      setTimeout(checkScroll, 600),
    ];

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener("scroll", checkScroll);
    }
    window.addEventListener("resize", checkScroll);

    return () => {
      timeouts.forEach(clearTimeout);
      if (container) {
        container.removeEventListener("scroll", checkScroll);
      }
      window.removeEventListener("resize", checkScroll);
    };
  }, [turnosDisponibles, dialogoAbierto, cargando, error, warning, fecha]);

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
        dialogoAbierto || dialogoReservaAbierto || dialogoAviso ? "blur-sm" : ""
      }`}
    >
      <header className="flex justify-center mt-2 z-10 h-16 border-b bg-background px-4  items-center">
        <div className="absolute left-4 top-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setMostrarBienvenida(true)}
            className="hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5 " />
            <span className="hidden sm:inline">Volver</span>
          </Button>
        </div>
        <h1 className="text-xl font-semibold text-center flex flex-col items-center justify-center w-full">
          Turnos ViaNova{" "}
          {tipoFutbol && (
            <span
              className={`
              ${tipoFutbol === 1 ? "text-green-600" : "text-blue-600"}`}
            >
              {tipoFutbol === 1
                ? "Fútbol 5 ⚽"
                : tipoFutbol === 2
                ? "Fútbol 7/8 ⚽"
                : ""}
            </span>
          )}
        </h1>
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
                      locale={es}
                      selected={fecha}
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

              <div className="rounded-lg border bg-card p-6 shadow-sm">
                <p className="leading-relaxed mb-4 text-md text-green-700">
                  Sigue estos 3 sencillos pasos para asegurar tu cancha:
                </p>
                <ol className="space-y-3 text-sm text-gray-200 list-decimal list-inside marker:text-green-700 marker:font-semibold">
                  <li className="leading-relaxed">
                    Toca el día deseado en el calendario para visualizar los
                    horarios disponibles.
                  </li>
                  <li className="leading-relaxed">
                    Selecciona el horario de tu preferencia, ingresa tu nombre y
                    presiona el botón &quot;Contactar por Whatsapp&quot;.
                  </li>
                  <li className="leading-relaxed">
                    Serás redirigido automáticamente al chat de Vía Nova.
                    Simplemente presiona &quot;Enviar&quot; para confirmar tu
                    solicitud de reserva.
                  </li>
                </ol>
                <p className="mt-4 text-sm text-gray-400 italic">
                  La disponibilidad de turnos se muestra hasta con 15 días de
                  anticipación.
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      <Dialog open={dialogoAbierto} onOpenChange={setDialogoAbierto}>
        <DialogContent
          className={`sm:max-w-md p-0 self-start min-h-[3/4] flex flex-col max-h-[100vh] ${
            dialogoReservaAbierto ? "blur-sm" : ""
          }`}
        >
          <DialogHeader className="mt-4 mb-2">
            <DialogTitle className="text-center">
              {fecha && mounted && !error && !warning && (
                <span
                  className={`text-xl ${
                    tipoFutbol === 1 ? "text-green-600" : "text-blue-600"
                  }`}
                >
                  Turnos disponibles:{" "}
                </span>
              )}

              {fecha && mounted && !error && !warning && (
                <>
                  <br />
                  <span className="capitalize">
                    {capitalizeFirst(
                      format(fecha, "EEEE d 'de' MMMM", { locale: es })
                    )}
                  </span>
                </>
              )}

              {warning && "Fecha no disponible"}
              {error && !warning && !fecha && "Error"}
            </DialogTitle>
          </DialogHeader>

          {cargando ? (
            <div className="flex  items-center justify-center">
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
            fecha && (
              <div
                ref={scrollContainerRef}
                className={`grid pt-4 px-1 h-min-content max-h-[60vh] overflow-y-auto scrollbar-hide ${
                  tipoFutbol === 1 ? "grid-cols-3 gap-1" : "grid-cols-2 gap-4"
                }`}
                style={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                }}
              >
                {turnosDisponibles.map((cancha) => (
                  <div
                    key={cancha.id}
                    className="w-full flex flex-col items-center justify-start h-full"
                  >
                    <h3 className="text-center w-full text-xl text-gray-200 font-medium mb-2">
                      {cancha.nombre}
                    </h3>
                    <Separator className="w-full mb-2" />
                    {cancha?.turnosDisponibles &&
                    cancha.turnosDisponibles.length > 0 ? (
                      cancha.turnosDisponibles?.map((turno) => (
                        <div
                          key={`${cancha.id}-${turno.id}`}
                          className="px-1 w-full mx-auto"
                        >
                          <Button
                            onClick={() =>
                              handleSeleccionarTurno(
                                fecha!,
                                turno.horaInicio,
                                turno.horaFin,
                                cancha.nombre
                              )
                            }
                            className={` w-full mx-auto my-1 text-center  ${
                              tipoFutbol === 1
                                ? "text-green-800 hover:bg-green-50"
                                : "text-blue-700 hover:bg-blue-50"
                            }`}
                          >
                            {turno.horaInicio} - {turno.horaFin}
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-sm text-gray-500">
                        No hay turnos para esta fecha
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {/* Indicador de scroll */}
          {mostrarIndicadorScroll && (
            <div className="flex justify-center mt-2 pb-2">
              <div className="flex flex-col items-center text-muted-foreground animate-bounce-gentle">
                <ChevronDown className="h-6 w-6" />
                <span className="text-xs font-medium">
                  Desliza para ver más
                </span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Reserva */}
      <Dialog
        open={dialogoReservaAbierto}
        onOpenChange={setDialogoReservaAbierto}
      >
        <DialogContent className="sm:max-w-md ">
          <DialogHeader>
            <DialogTitle>Confirmar Reserva</DialogTitle>
            <DialogContent>
              {turnoSeleccionado && mounted && (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <p className="text-base font-medium">
                      {turnoSeleccionado.cancha}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {capitalizeFirst(
                        format(turnoSeleccionado.dia, "EEEE d 'de' MMMM", {
                          locale: es,
                        })
                      )}
                    </p>
                    <p className="text-lg font-semibold">
                      {turnoSeleccionado.horaInicio} -{" "}
                      {turnoSeleccionado.horaFin}
                    </p>
                  </div>
                  <Input
                    type="text"
                    placeholder="Ingresa tu nombre"
                    value={nombre}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNombre(e.target.value)
                    }
                  />
                  <Button
                    onClick={handleEnviarWhatsApp}
                    className="w-full"
                    size="lg"
                    disabled={!nombre.trim()}
                  >
                    📱 Contactar por WhatsApp
                  </Button>
                </div>
              )}
            </DialogContent>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogoAviso} onOpenChange={setdialogoAviso}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold">
              Aviso {avisos[0].titulo}
            </DialogTitle>
          </DialogHeader>
          <DialogDescription className="text-center">
            {avisos[0].descripcion}
          </DialogDescription>
          <Button onClick={() => setdialogoAviso(false)}>Entendido</Button>
        </DialogContent>
      </Dialog>
      {/* Botón flotante de WhatsApp */}
      <a
        href={`https://wa.me/${numeroWhatsApp}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white rounded-full p-4 shadow-2xl transition-all duration-300 transform hover:scale-110 animate-bounce-slow"
        aria-label="Contactar por WhatsApp"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-8 h-8"
        >
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
        </svg>
      </a>
    </div>
  );
}
