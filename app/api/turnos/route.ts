import { getTurnosLibresPorFecha } from "@/lib/turnos";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Obtener la fecha de la URL
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");

    if (!fecha) {
      return NextResponse.json(
        { error: "Se requiere el parámetro fecha (formato dd/MM)" },
        { status: 400 }
      );
    }

    // Obtener los turnos disponibles para la fecha
    const turnosDisponibles = await getTurnosLibresPorFecha(fecha);

    return NextResponse.json(turnosDisponibles);
  } catch (error) {
    console.error("Error en la API de turnos:", error);
    return NextResponse.json(
      { error: "Error al obtener los turnos disponibles" },
      { status: 500 }
    );
  }
}
