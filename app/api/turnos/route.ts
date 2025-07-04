import { getTurnosDisponibles } from "@/lib/turnos";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Obtener la fecha de la URL

    // Obtener TODOS los turnos para la fecha (libres y ocupados)
    const todosLosTurnos = await getTurnosDisponibles();

    return NextResponse.json(todosLosTurnos);
  } catch (error) {
    console.error("Error en la API de turnos:", error);
    return NextResponse.json(
      { error: "Error al obtener los turnos" },
      { status: 500 }
    );
  }
}
