# Optimizaciones de SEO - ViaNova Canchas de Fútbol

## ✅ Optimizaciones Completadas

### 1. **Metadata Completa** (app/layout.tsx)

- ✅ Título optimizado con palabras clave
- ✅ Meta descripción atractiva y descriptiva
- ✅ Keywords específicas para Reconquista, Santa Fe
- ✅ Open Graph tags para redes sociales (Facebook, LinkedIn)
- ✅ Twitter Cards
- ✅ Configuración de robots para indexación óptima
- ✅ Viewport y theme color

### 2. **Structured Data - Schema.org** (app/layout.tsx)

- ✅ JSON-LD con tipo `SportsActivityLocation`
- ✅ Información de ubicación (Reconquista, Santa Fe)
- ✅ Coordenadas geográficas
- ✅ Horarios de apertura
- ✅ Características de las canchas (Fútbol 5, Fútbol 7, césped sintético)
- ✅ Información de contacto

### 3. **Archivos de SEO**

- ✅ **sitemap.xml** dinámico (app/sitemap.ts)
- ✅ **robots.txt** (app/robots.ts)
- ✅ **manifest.json** para PWA (public/manifest.json)
- ✅ **security.txt** (public/.well-known/security.txt)

### 4. **Contenido HTML Semántico**

- ✅ Etiquetas semánticas apropiadas (header, article, section, footer)
- ✅ Alt text descriptivo en imágenes
- ✅ ARIA labels para accesibilidad
- ✅ Contenido textual visible y rico en palabras clave
- ✅ Información de contacto y ubicación visible

---

## 📋 TAREAS PENDIENTES (Importantes)

### 1. **Actualizar URL del Sitio**

Busca y reemplaza en estos archivos:

- `app/layout.tsx` (línea 18)
- `app/sitemap.ts` (línea 3)
- `app/robots.ts` (línea 4)

**Reemplazar:**

```typescript
const siteUrl = "https://vianova-reconquista.com.ar";
```

**Por tu dominio real:**

```typescript
const siteUrl = "https://tu-dominio-real.com";
```

### 2. **Actualizar Coordenadas GPS Exactas**

En `app/layout.tsx` (líneas 112-113), actualizar con las coordenadas exactas de tu complejo:

```typescript
geo: {
  "@type": "GeoCoordinates",
  latitude: -29.1503, // ⚠️ ACTUALIZAR con coordenadas exactas
  longitude: -59.6473, // ⚠️ ACTUALIZAR con coordenadas exactas
},
```

**Para obtener las coordenadas exactas:**

1. Abre Google Maps
2. Busca tu ubicación exacta
3. Click derecho > "¿Qué hay aquí?"
4. Copia las coordenadas que aparecen

### 3. **Crear Imágenes para SEO** (CRÍTICO)

Necesitas crear estas imágenes y colocarlas en la carpeta `public/`:

#### a) **og-image.jpg** (Open Graph Image)

- **Dimensiones:** 1200 x 630 pixels
- **Contenido sugerido:**
  - Logo de ViaNova
  - Texto: "Canchas de Fútbol 5 y 7"
  - Texto: "Reconquista, Santa Fe"
  - Imagen de las canchas si es posible
  - Colores: Verde/Blanco (identidad de marca)

#### b) **favicon.ico** (Ya existe, pero puedes mejorar)

- **Dimensiones:** 32 x 32 pixels
- Logo simplificado de ViaNova

#### c) **apple-touch-icon.png**

- **Dimensiones:** 180 x 180 pixels
- Logo de ViaNova optimizado para iOS

#### d) **Iconos PWA** (Para manifest.json)

- `icon-192.png` - 192 x 192 pixels
- `icon-512.png` - 512 x 512 pixels
- `icon-maskable-192.png` - 192 x 192 pixels (con padding para Android)
- `icon-maskable-512.png` - 512 x 512 pixels (con padding para Android)

#### e) **screenshot-1.png** (Para PWA)

- **Dimensiones:** 540 x 720 pixels
- Screenshot de la pantalla principal de reservas

**Herramientas recomendadas para crear imágenes:**

- Canva (https://canva.com) - Fácil y gratuito
- Figma (https://figma.com) - Profesional
- Photoshop/GIMP - Avanzado

### 4. **Configurar Google Search Console**

1. Ve a https://search.google.com/search-console
2. Agrega tu sitio web
3. Verifica la propiedad (método HTML tag o DNS)
4. Envía el sitemap: `https://tu-dominio.com/sitemap.xml`

### 5. **Configurar Google My Business**

1. Ve a https://www.google.com/business/
2. Crea un perfil para "ViaNova - Canchas de Fútbol"
3. Agrega:
   - Dirección exacta
   - Horarios
   - Fotos de las canchas
   - Número de teléfono
   - Link al sitio web
   - Categoría: "Cancha de fútbol" o "Instalación deportiva"

### 6. **Actualizar Horarios de Apertura**

Si los horarios no son de 8:00 a 23:00, actualiza en `app/layout.tsx` (líneas 122-126):

```typescript
opens: "08:00",  // ⚠️ Actualizar si es necesario
closes: "23:00",  // ⚠️ Actualizar si es necesario
```

### 7. **Agregar Redes Sociales**

Cuando tengas perfiles en redes sociales, agrégalos en `app/layout.tsx` (línea 161-164):

```typescript
sameAs: [
  "https://www.facebook.com/vianovacanchas",
  "https://www.instagram.com/vianovacanchas",
  "https://www.twitter.com/vianovacanchas",
],
```

### 8. **Actualizar Email de Contacto**

En `public/.well-known/security.txt`, actualiza con tu email real.

---

## 🎯 Palabras Clave Principales Optimizadas

- ✅ cancha futbol 5 reconquista
- ✅ cancha futbol 7 reconquista
- ✅ canchas sinteticas reconquista
- ✅ futbol reconquista santa fe
- ✅ vianova reconquista
- ✅ alquiler cancha futbol reconquista
- ✅ canchas futbol santa fe
- ✅ reservar cancha futbol reconquista

---

## 📊 Métricas para Monitorear

### Google Search Console (Después de algunas semanas)

- Impresiones en búsqueda
- Clics desde Google
- CTR (Click-Through Rate)
- Posición promedio en resultados
- Palabras clave que generan tráfico

### Google Analytics (Si lo instalas)

- Visitantes únicos
- Páginas vistas
- Tasa de rebote
- Tiempo en sitio
- Conversiones (clicks en WhatsApp)

---

## 🚀 Optimizaciones Adicionales Recomendadas

### 1. **Rendimiento Web**

- ✅ Next.js ya optimiza automáticamente
- ✅ Imágenes con `next/image` (ya implementado)
- Considera usar Vercel/Netlify para hosting (edge optimization)

### 2. **Contenido Adicional**

Considera agregar páginas para:

- `/sobre-nosotros` - Historia del complejo
- `/instalaciones` - Fotos y detalles de las canchas
- `/precios` - Información de tarifas
- `/contacto` - Formulario de contacto
- `/blog` - Artículos sobre fútbol (aumenta SEO)

### 3. **Rich Snippets Adicionales**

Considera agregar:

- Reviews/Testimonios de clientes
- Preguntas frecuentes (FAQ Schema)
- Eventos deportivos (Event Schema)

### 4. **Link Building Local**

- Registra tu negocio en directorios locales de Reconquista
- Pide a clientes que dejen reviews en Google
- Colabora con clubes deportivos locales
- Crea contenido sobre fútbol en Reconquista

---

## ✅ Checklist de Lanzamiento SEO

- [ ] Actualizar URL del sitio en código
- [ ] Actualizar coordenadas GPS exactas
- [ ] Crear todas las imágenes requeridas (og-image, icons, etc.)
- [ ] Verificar que todas las imágenes estén en `/public`
- [ ] Configurar Google Search Console
- [ ] Configurar Google My Business
- [ ] Actualizar horarios si es necesario
- [ ] Agregar redes sociales cuando estén disponibles
- [ ] Actualizar email de contacto
- [ ] Hacer deploy del sitio
- [ ] Enviar sitemap a Google Search Console
- [ ] Verificar que el sitio aparezca en búsquedas de Google (puede tomar 1-2 semanas)
- [ ] Monitorear métricas semanalmente

---

## 📞 Soporte

Si tienes dudas sobre las optimizaciones de SEO, considera:

- Contratar un especialista en SEO local
- Usar herramientas como SEMrush, Ahrefs, o Moz
- Seguir las guías de Google Search Central
- Pedir feedback a clientes sobre cómo te encontraron

---

**Última actualización:** Noviembre 2025
**Versión:** 1.0
