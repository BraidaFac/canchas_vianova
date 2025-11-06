import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://canchas-vianova.vercel.app"; // Cambiar por tu dominio real

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"], // Opcionalmente bloquear APIs privadas
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
