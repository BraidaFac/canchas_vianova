import { RenderMounted } from "@/components/ui/ClientRender";
import type { Metadata, Viewport } from "next";
import { DM_Serif_Display, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const siteName = "Vía Nova Complejo Deportivo";
const siteDescription =
  "Reservá tu cancha de fútbol 5 y fútbol 8 en Vía Nova Complejo Deportivo, el mejor complejo de canchas de fútbol sintético en Reconquista, Santa Fe. Canchas de césped sintético de última generación.";
const siteUrl = "https://canchas-vianova.vercel.app";
const keywords =
  "cancha futbol 5 reconquista, cancha futbol 8 reconquista, canchas sinteticas reconquista, futbol reconquista santa fe, vianova reconquista, alquiler cancha futbol reconquista, canchas futbol santa fe, reservar cancha futbol reconquista";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: keywords,
  authors: [{ name: "Vía Nova Complejo Deportivo" }],
  creator: "Vía Nova Complejo Deportivo",
  publisher: "Vía Nova Complejo Deportivo",
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
        url: "/favicon.ico",
        width: 1200,
        height: 630,
        alt: "Vía Nova Complejo Deportivo - Canchas de Fútbol Sintético en Reconquista",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription,
    images: ["/favicon.ico"],
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
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.ico", sizes: "16x16", type: "image/png" },
      { url: "/favicon.ico", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: "/favicon.ico", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/favicon.ico", sizes: "96x96", type: "image/png" }],
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
  themeColor: "#133D34",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    name: "Vía Nova Complejo Deportivo",
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
        name: "Cancha de Fútbol 8",
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
    image: `${siteUrl}/favicon.ico`,
    sameAs: [
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
        className={`${dmSerifDisplay.variable} ${dmSans.variable} ${jetbrainsMono.variable} antialiased`}
        style={{ fontFamily: "var(--font-sans), sans-serif" }}
      >
        <RenderMounted>{children}</RenderMounted>
      </body>
    </html>
  );
}
