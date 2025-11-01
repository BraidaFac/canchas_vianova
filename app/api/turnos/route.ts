import { getTurnosDisponibles } from "@/lib/turnos";
import { NextResponse } from "next/server";

export async function GET() {
  // Obtener la fecha de la URL

  try {
    const turnosLibresCanchas = await getTurnosDisponibles();

    return NextResponse.json(turnosLibresCanchas);
  } catch {
    return NextResponse.json(
      { error: "Error al obtener los turnos" },
      { status: 500 }
    );
  }
}
