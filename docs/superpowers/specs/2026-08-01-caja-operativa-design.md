# Caja Operativa — Diseño

**Fecha:** 2026-08-01  
**Branch:** feat/facturacion-electronica  
**Alcance:** Control de caja diario, JornadaOperativa, SesionCaja, facturación diferida al cierre

---

## Contexto y motivación

La app no tiene control del dinero que se mueve en el día. Se necesita:

1. **Control de caja**: apertura con fondo inicial, cierre con resumen de movimientos
2. **Facturación diferida**: sacar `emitirFactura()` del POST de pagos y moverla al cierre de caja (opción del operador), eliminando el problema de no poder modificar/eliminar consumos ya facturados
3. **JornadaOperativa**: entidad que representa el "día de negocio", independiente del día calendario (el negocio opera de noche, puede cerrar a la 1am del día siguiente)

---

## Entidades de base de datos

### `jornadas_operativas`

```sql
id                    uuid PRIMARY KEY DEFAULT gen_random_uuid()
fecha_jornada         date NOT NULL        -- fecha del negocio (no calendar), ej "2026-08-01"
estado                text NOT NULL        -- "abierta" | "cerrada"
abierta_at            timestamptz NOT NULL DEFAULT now()
cerrada_at            timestamptz
empleado_apertura_id  uuid REFERENCES empleados(id)
empleado_cierre_id    uuid REFERENCES empleados(id)
```

**Constraint:** solo una jornada con `estado = "abierta"` a la vez (enforced en app layer).

### `sesiones_caja`

```sql
id                      uuid PRIMARY KEY DEFAULT gen_random_uuid()
jornada_id              uuid NOT NULL REFERENCES jornadas_operativas(id)
estado                  text NOT NULL        -- "abierta" | "cerrada"
monto_apertura          numeric NOT NULL     -- efectivo declarado al abrir
monto_cierre_declarado  numeric              -- efectivo contado al cerrar
abierta_at              timestamptz NOT NULL DEFAULT now()
cerrada_at              timestamptz
empleado_id             uuid REFERENCES empleados(id)
resumen_json            jsonb                -- snapshot del cierre
```

### Cambios en tablas existentes

- `pagos`: agregar columna `sesion_caja_id uuid REFERENCES sesiones_caja(id)` — trazabilidad de a qué sesión pertenece cada pago
- `config_modulos`: agregar columna `caja_cutoff_hour int NOT NULL DEFAULT 7` — hora de corte configurable

### Tab "General" en Configuración

Nueva pestaña **General** en `/admin/config` que expone:
- `caja_cutoff_hour`: hora de corte para determinar la jornada actual (default: 7)

---

## Lógica de JornadaOperativa y cutoff

### Función `getFechaJornadaActual(cutoffHour)`

```typescript
// lib/caja/jornada.ts
export function getFechaJornadaActual(cutoffHour = 7): string {
  const now = new Date()
  const hour = now.getHours()
  if (hour < cutoffHour) {
    const ayer = new Date(now)
    ayer.setDate(ayer.getDate() - 1)
    return ayer.toISOString().slice(0, 10)
  }
  return now.toISOString().slice(0, 10)
}
```

**Ejemplos con cutoff = 7:**

| Hora actual | fecha_jornada_actual |
|-------------|----------------------|
| 01:03am del 02/08 | 2026-08-01 (noche anterior) |
| 06:59am del 02/08 | 2026-08-01 (noche anterior) |
| 07:00am del 02/08 | 2026-08-02 (nuevo día) |
| 10:00am del 02/08 | 2026-08-02 (nuevo día) |

---

## Validación pre-pago

### `lib/caja/validar.ts` — `validarSesionActiva()`

Llamado desde:
- `POST /api/admin/pagos`
- `POST /api/admin/reservas` (cuando incluye pago)
- `POST /api/admin/consumos` (cuando incluye pago)

**Árbol de decisión:**

```
¿Hay sesión con estado="abierta"?
│
├── SÍ
│   ¿sesion.jornada.fecha_jornada === fechaJornadaActual?
│   ├── SÍ  → { ok: true, sesion }
│   └── NO  → { ok: false, code: "jornada_vencida" }
│               → frontend bloquea, muestra: "La caja pertenece a otra jornada.
│                 Cerrá la sesión actual y abrí una nueva." + [Ir a Caja]
│
└── NO
    ¿Hay jornada cerrada con fecha_jornada === fechaJornadaActual?
    ├── SÍ → { ok: false, code: "caja_cerrada_misma_jornada" }
    │         → frontend ofrece: "Reabrir sesión anterior" | "Abrir nueva caja"
    └── NO → { ok: false, code: "sin_caja" }
              → frontend ofrece: solo "Abrir nueva caja"
```

**Códigos de respuesta:**

| code | Significado | Dialog mostrado |
|------|-------------|-----------------|
| `ok` | Sesión válida | — |
| `jornada_vencida` | Caja abierta de otra jornada | Bloqueo + botón "Ir a Caja" |
| `caja_cerrada_misma_jornada` | Caja cerrada, misma jornada | "Reabrir" o "Nueva caja" |
| `sin_caja` | Sin caja del día | Solo "Abrir nueva caja" |

---

## Flujos operativos

### Apertura de caja

1. Operador hace clic en "Abrir caja" (banner o página `/admin/caja`)
2. `AbrirCajaDialog`: campo `monto_apertura` (requerido, numérico)
3. `POST /api/admin/caja/abrir`:
   - Lee `caja_cutoff_hour` de config
   - Calcula `fecha_jornada_actual`
   - Verifica que no haya jornada con `estado = "abierta"` → 409 si hay
   - Verifica que no haya jornada abierta de otra fecha (caso "olvidó cerrar") → 409 con mensaje específico
   - Inserta `jornadas_operativas` + `sesiones_caja`
4. Banner desaparece, sistema operativo

### Cierre de caja

**Paso 1 — Resumen del día** (modal, primer paso):

Métricas mostradas:
- **Por medio de pago**: total efectivo / transferencia / otro (solo pagos de la sesión actual)
- **Por origen**: total reservas / total consumos
- **Conciliación de efectivo**: monto_apertura + cobros_efectivo - monto_cierre_declarado = diferencia
- Campo editable: "Efectivo contado al cierre"

**Paso 2 — Facturación** (segundo paso del mismo modal):

- Lista de pagos `medio_pago = "transferencia"` sin comprobante emitido
- **Sección "Del día"**: pagos de la sesión actual → preseleccionados
- **Sección "Pendientes de otros días"**: pagos históricos sin facturar → deseleccionados por defecto
- El operador puede marcar/desmarcar individualmente
- Botones: "Facturar seleccionados y cerrar" | "Cerrar sin facturar"

`POST /api/admin/caja/cerrar`:
- Guarda `monto_cierre_declarado` y `resumen_json` en `sesiones_caja`
- Cierra `sesiones_caja` y `jornadas_operativas` (estado → "cerrada", `cerrada_at = now()`)
- Para cada pago seleccionado: llama `emitirFactura()` en background (fire and forget — errores quedan en `comprobantes.estado = "fallida"` para reintento manual)

### Reapertura (misma jornada)

Triggered cuando `code = "caja_cerrada_misma_jornada"` y operador elige "Reabrir":

`POST /api/admin/caja/reabrir`:
- Verifica `sesion.jornada.fecha_jornada === fechaJornadaActual`
- Si no coincide → 409 (no se puede reabrir, es otra jornada)
- Actualiza `sesiones_caja.estado = "abierta"`, `cerrada_at = null`
- Actualiza `jornadas_operativas.estado = "abierta"`, `cerrada_at = null`
- Sin monto de apertura adicional (continuación de la misma sesión)

### Caso: jornada anterior sin cerrar

Si al intentar abrir caja el sistema detecta jornada con `estado = "abierta"` de fecha anterior:
- Banner cambia a: "⚠ Tenés una caja sin cerrar del DD/MM · [Ir a Caja]"
- Al intentar registrar un pago: `code = "jornada_vencida"` → bloqueo total
- Operador debe ir a `/admin/caja` → completar cierre de jornada anterior → luego abrir la nueva

---

## API Routes

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/admin/caja/estado` | Estado actual: jornada activa o última cerrada |
| POST | `/api/admin/caja/abrir` | Abre nueva jornada + sesión |
| POST | `/api/admin/caja/cerrar` | Cierra sesión, guarda resumen, dispara facturación |
| POST | `/api/admin/caja/reabrir` | Reabre sesión de la jornada actual |
| GET | `/api/admin/caja/historial` | Lista de jornadas cerradas paginada |
| GET | `/api/admin/caja/[id]` | Detalle completo de una jornada |
| GET | `/api/admin/caja/pendientes-facturacion` | Pagos transferencia sin comprobante |

---

## UI / Componentes

### Banner en layout

Ubicación: `AdminLayoutClient` — franja sobre el contenido principal, visible en todas las páginas.

```
Estado: sin caja      → "⚠ No hay caja abierta · [Abrir caja]"
Estado: jornada vieja → "⚠ Tenés una caja sin cerrar del DD/MM · [Ir a Caja]"
Estado: abierta       → sin banner
```

El layout consulta `GET /api/admin/caja/estado` on mount (client side).

### Sidebar

```typescript
{ href: "/admin/caja", label: "Caja", icon: Landmark }
// Posición: entre Cobros y Empleados
// Sin flag de módulo — feature core
```

### `/admin/caja` — `CajaClient`

**Header** (patrón igual a CobrosClient):
```
px-4 py-3 border-b border-border bg-card
icon Landmark size={16} color="#133D34" · "Caja"
Si abierta: "Jornada DD/MM · Abierta HH:MM · $X.XXX inicial" + [Cerrar caja]
Si cerrada:  "Sin jornada activa" + [Abrir caja]
```

**Tabla historial** (patrón igual a CobrosClient):
```
rounded-lg border border-border bg-card overflow-hidden
thead: bg-muted/50, text-xs font-medium text-muted-foreground
rows: divide-y divide-border, hover:bg-muted/30, cursor-pointer

Columnas: Fecha | Apertura | Cierre | Efectivo inicial | Efectivo cierre | Diferencia | Estado | →
```

Click en fila → `CajaDetalleModal`

### Modales

**`AbrirCajaDialog`**:
- Campo: Efectivo inicial (numeric input)
- Botón: "Abrir caja"

**`CerrarCajaDialog`** (2 pasos, mismo Dialog):
- Paso 1: métricas del día + campo "Efectivo contado"
- Paso 2: checklist de transferencias a facturar (secciones "Del día" / "Otros días")
- Footer: "Anterior" | "Facturar seleccionados y cerrar" | "Cerrar sin facturar"

**`CajaDetalleModal`**:
- Resumen de jornada cerrada
- Métricas (mismo layout que paso 1 del cierre)
- Lista de comprobantes emitidos en ese cierre (estado: emitida / fallida / pendiente)

### Tab "General" en `/admin/config`

Nueva tab entre las existentes:
- Campo: "Hora de corte de jornada" (número 0–23, default 7)
- Descripción: "Pagos registrados antes de esta hora pertenecen a la jornada del día anterior"

---

## Cambio en flujo de facturación

**Antes:** `POST /api/admin/pagos` → si transferencia → `emitirFactura()` síncrono  
**Después:** `POST /api/admin/pagos` → guarda pago + `sesion_caja_id`, sin facturar  
**Facturación:** solo desde cierre de caja (manual, controlada por operador)

Esto resuelve el problema original: si el operador cargó mal un consumo, puede modificarlo o eliminarlo durante el día antes del cierre, sin comprobante emitido.

---

## Casos edge contemplados

| Caso | Comportamiento |
|------|---------------|
| Caja cerrada < cutoff, mismo día de negocio | Ofrecer reabrir |
| Caja cerrada > cutoff, día de negocio nuevo | Solo ofrecer nueva caja |
| Jornada anterior abierta (olvidó cerrar) | Bloqueo total de pagos, fuerza cierre previo |
| Intento de abrir caja con una ya abierta | 409 — imposible |
| Facturación falla al cierre | `comprobantes.estado = "fallida"` — visible en /admin/facturacion para reintento manual |

---

## Archivos a crear / modificar

### Nuevos
- `lib/caja/jornada.ts` — `getFechaJornadaActual()`
- `lib/caja/validar.ts` — `validarSesionActiva()`
- `app/api/admin/caja/estado/route.ts`
- `app/api/admin/caja/abrir/route.ts`
- `app/api/admin/caja/cerrar/route.ts`
- `app/api/admin/caja/reabrir/route.ts`
- `app/api/admin/caja/historial/route.ts`
- `app/api/admin/caja/[id]/route.ts`
- `app/api/admin/caja/pendientes-facturacion/route.ts`
- `app/admin/(protected)/caja/page.tsx`
- `components/admin/CajaClient.tsx`
- `components/admin/AbrirCajaDialog.tsx`
- `components/admin/CerrarCajaDialog.tsx`
- `components/admin/CajaDetalleModal.tsx`
- `supabase/migrations/YYYYMMDD_caja_operativa.sql`

### Modificados
- `app/api/admin/pagos/route.ts` — remover `emitirFactura()`, agregar `sesion_caja_id`
- `components/admin/AdminSidebar.tsx` — agregar item "Caja"
- `components/admin/AdminLayoutClient.tsx` — agregar banner de caja
- `app/admin/(protected)/layout.tsx` — pasar estado de caja al layout client
- `app/admin/(protected)/config/page.tsx` — agregar tab "General"
- `supabase/migrations/YYYYMMDD_pagos_sesion_caja.sql` — columna `sesion_caja_id` en `pagos`
