# ✅ Guía de Verificación de SEO - ViaNova

Esta guía te ayudará a verificar que todas las optimizaciones de SEO estén funcionando correctamente.

## 🔍 Verificaciones Inmediatas (Antes de Deploy)

### 1. Verificar Metadata en Desarrollo

```bash
npm run dev
```

Abre http://localhost:3000 y:

1. **Click derecho → "Ver código fuente"** o **Ctrl+U** (Windows) / **Cmd+Option+U** (Mac)
2. Busca estas etiquetas en el código HTML:

```html
<!-- Debe aparecer -->
<title>ViaNova - Canchas de Fútbol Sintético</title>
<meta name="description" content="Reservá tu cancha de fútbol 5..." />
<meta property="og:title" content="ViaNova..." />
<meta property="og:type" content="website" />

<!-- Busca el JSON-LD -->
<script type="application/ld+json">
  {"@context":"https://schema.org","@type":"SportsActivityLocation"...}
</script>
```

### 2. Verificar Archivos Públicos

Verifica que existan estos archivos:

```bash
# En la carpeta public/
✅ public/manifest.json
✅ public/.well-known/security.txt

# Próximamente debes crear:
⚠️ public/og-image.jpg
⚠️ public/apple-touch-icon.png
⚠️ public/icon-192.png
⚠️ public/icon-512.png
```

### 3. Verificar Rutas Generadas

Después de hacer build:

```bash
npm run build
npm start
```

Visita estas URLs:

- http://localhost:3000/sitemap.xml ✅ Debe mostrar XML válido
- http://localhost:3000/robots.txt ✅ Debe mostrar configuración
- http://localhost:3000/manifest.json ✅ Debe mostrar JSON válido

---

## 🌐 Verificaciones Después del Deploy

### 1. Herramientas Gratuitas de Verificación

#### **Google Rich Results Test**

URL: https://search.google.com/test/rich-results

1. Ingresa la URL de tu sitio
2. Click en "Probar URL"
3. Verifica que aparezca:
   - ✅ `SportsActivityLocation` válido
   - ✅ Sin errores críticos
   - ⚠️ Avisos son aceptables

#### **Facebook Sharing Debugger**

URL: https://developers.facebook.com/tools/debug/

1. Ingresa tu URL
2. Click en "Debug"
3. Verifica:
   - ✅ Imagen og:image aparece (1200x630)
   - ✅ Título correcto
   - ✅ Descripción completa

#### **Twitter Card Validator**

URL: https://cards-dev.twitter.com/validator

1. Ingresa tu URL
2. Verifica preview de la tarjeta
3. Debe mostrar imagen y descripción

#### **Schema.org Validator**

URL: https://validator.schema.org/

1. Ingresa tu URL
2. Verifica que no haya errores
3. Opcional: Corregir advertencias

#### **Lighthouse (Chrome DevTools)**

En Chrome:

1. Abre tu sitio
2. F12 (Abrir DevTools)
3. Tab "Lighthouse"
4. Check: Performance, Accessibility, Best Practices, SEO
5. Click "Generate report"

**Objetivos:**

- Performance: > 90
- Accessibility: > 95
- Best Practices: > 95
- SEO: 100 ✅

### 2. Verificación Manual de SEO

#### **Test de Búsqueda en Google**

Después de 1-2 semanas del deploy:

```
site:tu-dominio.com
```

Debe aparecer tu sitio indexado.

```
"ViaNova Reconquista"
"cancha futbol 5 reconquista"
"canchas sintéticas reconquista"
```

Verifica que aparezcas en los resultados (posición mejorará con tiempo).

#### **Test de Snippet**

Busca tu negocio en Google y verifica que aparezca:

- ✅ Título atractivo
- ✅ Descripción completa
- ✅ URL correcta
- ✅ Posiblemente: Rating (si tienes reviews)
- ✅ Posiblemente: Información de ubicación

### 3. Verificación de Velocidad

#### **PageSpeed Insights**

URL: https://pagespeed.web.dev/

1. Ingresa tu URL
2. Verifica tanto Mobile como Desktop
3. Objetivos:
   - Mobile: > 80
   - Desktop: > 90

#### **GTmetrix**

URL: https://gtmetrix.com/

1. Ingresa tu URL
2. Verifica:
   - Performance Score: > A
   - Structure Score: > A
   - Tiempo de carga: < 2 segundos

---

## 📱 Verificación Mobile

### 1. Mobile-Friendly Test

URL: https://search.google.com/test/mobile-friendly

1. Ingresa tu URL
2. Debe mostrar: ✅ "La página es compatible con dispositivos móviles"

### 2. Prueba Manual

En tu teléfono:

- ✅ La página carga rápido
- ✅ Los botones son fáciles de tocar
- ✅ El texto es legible sin zoom
- ✅ Las imágenes se ven bien
- ✅ El calendario funciona correctamente

---

## 🗺️ Verificación de Google My Business

Después de crear tu perfil:

1. Busca "ViaNova Reconquista" en Google
2. Debe aparecer:
   - ✅ Panel de información a la derecha
   - ✅ Ubicación en el mapa
   - ✅ Horarios
   - ✅ Teléfono clickeable
   - ✅ Botón "Sitio web"
   - ✅ Fotos de las canchas

---

## 📊 Checklist de Verificación Completa

### Antes del Deploy

- [ ] Metadata visible en código fuente
- [ ] JSON-LD presente y válido
- [ ] sitemap.xml accesible
- [ ] robots.txt accesible
- [ ] manifest.json accesible
- [ ] URLs actualizadas con dominio real
- [ ] Coordenadas GPS actualizadas
- [ ] Todas las imágenes creadas y en `/public`

### Después del Deploy

- [ ] Google Rich Results Test: ✅ VÁLIDO
- [ ] Facebook Debugger: ✅ Preview correcto
- [ ] Twitter Card: ✅ Preview correcto
- [ ] Schema Validator: ✅ Sin errores
- [ ] Lighthouse SEO: 100/100
- [ ] Lighthouse Performance: > 90
- [ ] PageSpeed Mobile: > 80
- [ ] PageSpeed Desktop: > 90
- [ ] Mobile-Friendly Test: ✅ Compatible

### Después de 1-2 Semanas

- [ ] Sitio indexado en Google (`site:tu-dominio.com`)
- [ ] Aparece en búsquedas relevantes
- [ ] Google Search Console configurado
- [ ] Sitemap enviado a Google
- [ ] Google My Business creado y verificado
- [ ] Primeras métricas de tráfico visible

### Después de 1-2 Meses

- [ ] Posicionamiento mejorando para palabras clave
- [ ] Tráfico orgánico aumentando
- [ ] Reviews de clientes en Google
- [ ] Backlinks de directorios locales

---

## 🚨 Problemas Comunes y Soluciones

### Problema: "Sitemap no encontrado"

**Solución:** Verifica que `app/sitemap.ts` exista y haz rebuild:

```bash
npm run build
```

### Problema: "Metadata no aparece en Facebook"

**Solución:**

1. Verifica que `og:image` tenga URL absoluta
2. La imagen debe ser 1200x630px
3. Usa Facebook Debugger para forzar re-scrape

### Problema: "No aparezco en Google"

**Solución:**

1. Espera 1-2 semanas (indexación toma tiempo)
2. Envía sitemap en Search Console
3. Verifica que robots.txt permita indexación
4. Crea backlinks desde directorios locales

### Problema: "Lighthouse Performance bajo"

**Solución:**

1. Optimiza tamaño de imágenes (usa WebP)
2. Next.js ya optimiza automáticamente
3. Considera usar CDN (Vercel, Netlify)

---

## 📞 Contacto y Soporte

Si encuentras problemas durante la verificación:

1. **Revisa la documentación de Next.js:** https://nextjs.org/docs
2. **Google Search Central:** https://developers.google.com/search
3. **Schema.org Docs:** https://schema.org/
4. **Contrata un experto en SEO:** Si necesitas ayuda profesional

---

## 📈 Siguientes Pasos

Una vez verificado todo:

1. ✅ Monitorea Google Search Console semanalmente
2. ✅ Responde reviews de clientes en Google
3. ✅ Publica contenido regular (blog, noticias)
4. ✅ Consigue backlinks de sitios locales
5. ✅ Optimiza según métricas de usuarios reales
6. ✅ Mantén el sitio actualizado con información precisa

---

**¡Éxito con tu SEO!** 🚀

Si tienes alguna pregunta, no dudes en consultar el archivo `SEO-OPTIMIZATIONS.md` para más detalles.
