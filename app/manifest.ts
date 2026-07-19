import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ViaNova - Canchas de Fútbol Sintético",
    short_name: "ViaNova",
    description:
      "Reservá tu cancha de fútbol 5 y fútbol 7 en ViaNova, Reconquista, Santa Fe.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#133D34",
    orientation: "portrait",
    lang: "es-AR",
    dir: "ltr",
    scope: "/",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Reservar Fútbol 5",
        short_name: "Fútbol 5",
        description: "Reservar turno de fútbol 5",
        url: "/?tipo=futbol5",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Reservar Fútbol 7",
        short_name: "Fútbol 7",
        description: "Reservar turno de fútbol 7",
        url: "/?tipo=futbol7",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
    categories: ["sports", "lifestyle"],
  };
}
