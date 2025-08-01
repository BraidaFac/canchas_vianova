import { getTurnosDisponibles } from "@/lib/turnos";
import { NextResponse } from "next/server";

export async function GET() {
  // Obtener la fecha de la URL

  try {
    // Obtener TODOS los turnos para la fecha (libres y ocupados)
    const todosLosTurnos = await getTurnosDisponibles();

    if (!todosLosTurnos) {
      return NextResponse.json(
        { error: "No hay turnos disponibles" },
        { status: 404 }
      );
    }
    return NextResponse.json(todosLosTurnos);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener los turnos" },
      { status: 500 }
    );
  }
}
