import { RenderMounted } from "@/components/ui/ClientRender";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteName = "ViaNova - Canchas de Fútbol Sintético";
const siteDescription =
  "Reservá tu cancha de fútbol 5 y fútbol 7 en ViaNova, el mejor complejo de canchas de fútbol sintético en Reconquista, Santa Fe. Sistema de reservas online 24/7. Canchas de césped sintético de última generación.";
const siteUrl = "https://canchas-vianova.vercel.app"; // Cambiar por tu dominio real
const keywords =
  "cancha futbol 5 reconquista, cancha futbol 7 reconquista, canchas sinteticas reconquista, futbol reconquista santa fe, vianova reconquista, alquiler cancha futbol reconquista, canchas futbol santa fe, reservar cancha futbol reconquista";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: keywords,
  authors: [{ name: "ViaNova Canchas" }],
  creator: "ViaNova Canchas",
  publisher: "ViaNova Canchas",
  formatDetection: {
    telephone: true,
    email: true,
    address: true,
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: siteUrl,
    siteName: siteName,
    title: siteName,
    description: siteDescription,
    images: [
      {
        url: "/verde.png", // Asegúrate de crear esta imagen
        width: 1200,
        height: 630,
        alt: "ViaNova - Canchas de Fútbol Sintético en Reconquista",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/verde.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/verde.png", sizes: "any" },
      { url: "/verde.png", sizes: "16x16", type: "image/png" },
      { url: "/verde.png", sizes: "32x32", type: "image/png" },
      { url: "/verde.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: "/verde.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/verde.png", sizes: "96x96", type: "image/png" }],
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: siteUrl,
  },
  category: "sports",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#16a34a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Structured Data para SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: "ViaNova - Canchas de Fútbol Sintético",
    alternateName: "Via Nova Canchas",
    description: siteDescription,
    url: siteUrl,
    telephone: "+54-3482-678377",
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Reconquista",
      addressRegion: "Santa Fe",
      addressCountry: "AR",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: -29.163159,
      longitude: -59.637172,
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        opens: "08:00",
        closes: "00:00",
      },
    ],
    sport: "Soccer",
    amenityFeature: [
      {
        "@type": "LocationFeatureSpecification",
        name: "Cancha de Fútbol 5",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Cancha de Fútbol 7",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Césped Sintético",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Iluminación LED",
        value: true,
      },
      {
        "@type": "LocationFeatureSpecification",
        name: "Reservas Online",
        value: true,
      },
    ],
    hasMap: `https://www.google.com/maps/search/?api=1&query=ViaNova+Canchas+Reconquista+Santa+Fe`,
    image: `${siteUrl}/blanco.png`,
    sameAs: [
      // Agregar aquí las redes sociales cuando estén disponibles
      "https://www.instagram.com/vianova.complejo/",
    ],
  };

  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased dark`}
      >
        <RenderMounted>{children}</RenderMounted>
      </body>
    </html>
  );
}
