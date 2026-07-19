import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      name: "ViaNova Admin",
      short_name: "VN Admin",
      description: "Panel de administración – Vía Nova Complejo Deportivo",
      start_url: "/admin",
      display: "standalone",
      background_color: "#0a1f1a",
      theme_color: "#133D34",
      orientation: "portrait",
      icons: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
      },
    }
  );
}
