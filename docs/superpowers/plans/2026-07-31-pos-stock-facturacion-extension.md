# Diseño: POS + Stock + Extensión Facturación
**Fecha:** 2026-07-31  
**Branch:** feat/facturacion-electronica  
**Estado:** Aprobado por usuario — pendiente de implementación

---

## Contexto

El módulo de facturación electrónica ya existe (ARCA/AFIP SDK). Este diseño extiende el sistema con:
1. Soporte multi-entidad fiscal + cuentas bancarias
2. Pagos con split (efectivo + transferencia) en reservas y consumos
3. Nueva sección **Cobros** — vista financiera completa de todos los ingresos
4. **Comprobantes** se mantiene como vista exclusiva de documentos fiscales ARCA con CAE
5. Módulo POS (Punto de Venta) para consumos en barra
6. Módulo Stock con productos, categorías, compras y precios históricos
7. Tabla `config_modulos` para habilitar/deshabilitar módulos desde DB

---

## Decisiones de arquitectura

| # | Decisión | Elección |
|---|----------|----------|
| 1 | Vista financiera | **Sección "Cobros"** — todos los ingresos agrupados por reserva/consumo, expandibles a pagos individuales |
| 2 | Vista fiscal | **Sección "Comprobantes"** — solo documentos ARCA con CAE, sin cambios conceptuales |
| 3 | Pagos split | **Tabla `pagos` polimórfica** — `origen_tipo` + `origen_id`, una fila por medio de pago |
| 4 | Entidades fiscales | **Rename + multi-row** — `config_facturacion` → `entidades_fiscales`, campo `predeterminada` |
| 5 | POS UI | **Dos vistas alternables** — Grid por categorías / Lista con buscador, persistido en `localStorage` |
| 6 | Módulos deshabilitables | **`config_modulos`** — tabla fila única con bools por módulo (facturacion, pos, stock) |

---

## Modelo de datos completo

### `entidades_fiscales` (reemplaza `config_facturacion`)

```sql
CREATE TABLE entidades_fiscales (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_interno  text NOT NULL,
  cuit            text,
  razon_social    text,
  domicilio       text,
  condicion_iva   text CHECK (condicion_iva IN ('monotributo', 'responsable_inscripto')),
  punto_venta     int,
  afipsdk_token   text,
  cert_encrypted  text,
  key_encrypted   text,
  modo            text DEFAULT 'testing' CHECK (modo IN ('testing', 'produccion')),
  activo          bool DEFAULT true,
  predeterminada  bool DEFAULT false,
  created_at      timestamptz DEFAULT now()
);
-- Constraint: solo una fila puede tener predeterminada = true
-- Migrar la fila existente de config_facturacion a esta tabla
```

### `cuentas_bancarias`

```sql
CREATE TABLE cuentas_bancarias (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_display    text NOT NULL,
  banco             text,
  cbu               text,
  alias             text,
  entidad_fiscal_id uuid REFERENCES entidades_fiscales(id),
  activo            bool DEFAULT true,
  created_at        timestamptz DEFAULT now()
);
```

### `pagos` (nueva — polimórfica)

```sql
CREATE TABLE pagos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origen_tipo         text NOT NULL CHECK (origen_tipo IN ('reserva', 'consumo')),
  origen_id           uuid NOT NULL,
  medio_pago          text NOT NULL CHECK (medio_pago IN ('efectivo', 'transferencia', 'otro')),
  monto               numeric NOT NULL CHECK (monto > 0),
  cuenta_bancaria_id  uuid REFERENCES cuentas_bancarias(id),  -- solo si transferencia
  empleado_id         uuid REFERENCES empleados(id),
  created_at          timestamptz DEFAULT now()
);
-- Index: (origen_tipo, origen_id) para lookups frecuentes
```

### `comprobantes` (modificada)

```sql
-- Cambio principal: reemplazar reserva_id por pago_id
-- Agregar: origen_tipo para filtros en UI
ALTER TABLE comprobantes
  DROP COLUMN reserva_id,
  ADD COLUMN pago_id uuid REFERENCES pagos(id),
  ADD COLUMN origen_tipo text CHECK (origen_tipo IN ('reserva', 'consumo'));
```

### `iva_alicuotas`

```sql
CREATE TABLE iva_alicuotas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre         text NOT NULL,      -- "21%", "10.5%", "Exento"
  porcentaje     numeric NOT NULL,   -- 21.00, 10.50, 0.00
  predeterminada bool DEFAULT false,
  activo         bool DEFAULT true
);
-- Seed data:
-- ('21%', 21.00, true, true)
-- ('10.5%', 10.50, false, true)
-- ('Exento', 0.00, false, true)
```

### `categorias`

```sql
CREATE TABLE categorias (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre  text NOT NULL,
  color   text,        -- hex para badge en UI, ej: "#16a34a"
  orden   int DEFAULT 0,
  activo  bool DEFAULT true
);
```

### `productos`

```sql
CREATE TABLE productos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            text NOT NULL,
  categoria_id      uuid REFERENCES categorias(id),
  precio            numeric NOT NULL,      -- precio vigente (desnormalizado)
  costo_con_iva     numeric,               -- último costo ingresado con IVA
  costo_neto        numeric,               -- derivado: costo_con_iva / (1 + iva%)
  iva_alicuota_id   uuid REFERENCES iva_alicuotas(id),
  stock_actual      int DEFAULT 0,
  tiene_stock       bool DEFAULT true,     -- false = amenity sin límite (ej: parrillas)
  unidad            text DEFAULT 'unidad', -- 'unidad' | 'kg' | 'litro'
  activo            bool DEFAULT true,
  created_at        timestamptz DEFAULT now()
);
```

### `producto_precios` (historial de precios de venta)

```sql
CREATE TABLE producto_precios (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id   uuid REFERENCES productos(id),
  precio        numeric NOT NULL,
  vigente_desde date NOT NULL,
  empleado_id   uuid REFERENCES empleados(id),
  created_at    timestamptz DEFAULT now()
);
```

### `consumos` (sesión de venta POS)

```sql
CREATE TABLE consumos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id   uuid REFERENCES reservas(id),  -- opcional
  empleado_id  uuid REFERENCES empleados(id),
  total        numeric NOT NULL,
  notas        text,
  created_at   timestamptz DEFAULT now()
);
```

### `consumo_items`

```sql
CREATE TABLE consumo_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consumo_id       uuid REFERENCES consumos(id),
  producto_id      uuid REFERENCES productos(id),
  cantidad         int NOT NULL,
  precio_unitario  numeric NOT NULL  -- snapshot al momento de venta
);
```

### `compras` (compras de mercadería al proveedor)

```sql
CREATE TABLE compras (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha        date NOT NULL,
  proveedor    text,
  notas        text,
  empleado_id  uuid REFERENCES empleados(id),
  created_at   timestamptz DEFAULT now()
);
```

### `compra_items`

```sql
CREATE TABLE compra_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id             uuid REFERENCES compras(id),
  producto_id           uuid REFERENCES productos(id),
  cantidad              int NOT NULL,
  costo_con_iva         numeric NOT NULL,   -- lo que ingresa el usuario
  iva_alicuota_id       uuid REFERENCES iva_alicuotas(id),
  costo_neto            numeric NOT NULL    -- derivado: costo_con_iva / (1 + iva%)
);
-- Al registrar compra: suma cantidad a productos.stock_actual
--                      actualiza productos.costo_con_iva, costo_neto, iva_alicuota_id
```

---

## Módulos nuevos / modificados

### `config_modulos` (nueva — módulos deshabilitables)

```sql
CREATE TABLE config_modulos (
  id          int PRIMARY KEY DEFAULT 1,
  facturacion bool DEFAULT false,
  pos         bool DEFAULT false,
  stock       bool DEFAULT false,
  CHECK (id = 1)
);
INSERT INTO config_modulos DEFAULT VALUES;
```

El layout del admin fetcha esta tabla y pasa los flags al sidebar. Cada módulo no visible si su flag es `false`. Los toggles de activación van en Configuración (solo superadmin).

---

### Módulo: Cobros (nuevo)

**Ruta:** `/admin/cobros`

Vista financiera completa de todos los ingresos del negocio. Agrupa por origen (reserva o consumo), expandible a pagos individuales.

**Estructura de filas:**
```
▶ Reserva #R-001  |  Cancha 3  |  31/07  |  $5.000  |  Mixto
▼ Reserva #R-002  |  Cancha 1  |  31/07  |  $5.000  |  Facturado
    └─ Transferencia $5.000  →  Facturado  CAE: 7312...  [ver comprobante]
▼ Reserva #R-003  |  Cancha 2  |  31/07  |  $3.000  |  Sin comprobante
    └─ Efectivo $3.000
▼ Consumo #C-001  |  —         |  31/07  |  $1.600  |  Mixto
    └─ Transferencia $800  →  Facturado  CAE: 8821...  [ver comprobante]
    └─ Efectivo $800
```

**Fila principal (agrupador):**
- Una fila por reserva/consumo
- Estado resumido: `Facturado` / `Mixto` / `Sin comprobante`
- Click expande sub-filas

**Sub-filas (pagos individuales):**
- Una por cada fila en tabla `pagos` con ese `origen_id`
- Medio de pago + monto
- Si `medio_pago = 'transferencia'`: muestra estado fiscal + CAE + link a comprobante ARCA

**Query base:**
```sql
-- Agrupador: reservas/consumos con sus totales
-- Sub-filas: JOIN pagos + LEFT JOIN comprobantes ON pago_id
-- Estado resumido:
--   todos transfer + CAE  → 'facturado'
--   mix efectivo+transfer → 'mixto'
--   solo efectivo         → 'sin_comprobante'
```

**Sin toggle por ahora** — muestra todo. Iteración futura: filtro global de vista por medio de pago.

---

### Módulo: Facturación — Comprobantes (sin cambio conceptual)

**Ruta:** `/admin/facturacion` (existente)

Solo muestra documentos fiscales ARCA con CAE. Sin cambio de concepto. Es la vista legal/contable.

**Cambios menores:**
- Columna `Origen` (badge Reserva/Consumo)
- Columna `Cuenta bancaria` que emitió

**Cambios en `lib/facturacion/`:**
- `afip-client.ts` → recibe `entidad_fiscal_id` en lugar de asumir `id=1`
- `emitir.ts` → recibe `pago_id`, resuelve entidad fiscal desde `pago → cuenta_bancaria → entidad_fiscal`
- `types.ts` → nuevos tipos para `EntidadFiscal`, `CuentaBancaria`, `Pago`

**Nuevas APIs:**
- `GET/POST/PATCH /api/admin/entidades-fiscales`
- `GET/POST/PATCH /api/admin/cuentas-bancarias`
- `POST /api/admin/pagos` — registrar pago de reserva o consumo

**UI — Configuración (sección Facturación):**
- CRUD de entidades fiscales (antes era config de fila única)
- CRUD de cuentas bancarias con asociación a entidad
- CRUD de alícuotas IVA
- Toggle de módulos (facturacion, pos, stock) — solo superadmin
- La config existente se migra como primera entidad fiscal

### Módulo: POS — Punto de Venta (nuevo)

**Ruta:** `/admin/pos`

**Layout:**
```
┌─────────────────────────────────┬──────────────────┐
│  Catálogo          [≡] [⊞]      │  Carrito         │
│  ─────────────────────────────  │  ─────────────── │
│  [Todos] [Bebidas] [Snacks] ... │  Item 1    $xxx  │
│                                 │  Item 2    $xxx  │
│  ┌──────┐ ┌──────┐ ┌──────┐   │  ─────────────── │
│  │Coca  │ │Agua  │ │Fernet│   │  Total:   $xxxx  │
│  │$800  │ │$400  │ │$1200 │   │                  │
│  └──────┘ └──────┘ └──────┘   │  [Cobrar]        │
│                                 │                  │
└─────────────────────────────────┴──────────────────┘
```

**Vista Grid (default):**
- Cards por categoría (tabs horizontales)
- Click suma al carrito
- Badge de cantidad sobre card si hay en carrito

**Vista Lista:**
- Buscador full-text en tiempo real
- Tabla compacta: nombre | precio | [+]
- Sin navegación de categorías

**Toggle de vista:** par de íconos (grid/list) persistido en `localStorage`. Sutil, sin texto.

**Panel de cobro (inline en carrito):**
```
┌────────────────────────┐
│ Total a cobrar: $2400  │
│                        │
│ [Efectivo  $_____]     │
│ [Transferencia $_____] │
│   → Cuenta: ▼          │
│                        │
│ Asociar a reserva: ▼   │ (opcional)
│                        │
│ [Confirmar venta]      │
└────────────────────────┘
```

**Orden de productos:** dentro de cada tab/categoría, ordenados por `total_vendido DESC` (suma de `consumo_items.cantidad`). Sin historial → orden alfabético. Se calcula en la API, el cliente filtra por categoría sobre datos ya ordenados.

```sql
SELECT p.*, COALESCE(SUM(ci.cantidad), 0) AS total_vendido
FROM productos p
LEFT JOIN consumo_items ci ON ci.producto_id = p.id
WHERE p.activo = true
GROUP BY p.id
ORDER BY total_vendido DESC, p.nombre ASC
```

**Flujo:**
1. Agregar productos → carrito
2. Click "Cobrar" → panel cobro se expande inline
3. Ingresar monto(s) de pago
4. Confirmar → crea `consumo` + `consumo_items` + `pagos` + (si hay transferencia) dispara `emitirFactura()`
5. Ticket de confirmación con total y medios de pago

### Módulo: Stock (nuevo)

**Ruta:** `/admin/stock`

**Tabs:** `Productos` | `Categorías` | `Compras`

**Tab Productos:**
- Tabla con: nombre, categoría, precio, costo (con IVA), margen%, stock, activo
- Botón "Modo edición rápida" — activa inputs inline en precio y stock para todas las filas
- Enter/blur guarda la fila (PATCH individual)
- Cambio de precio → inserta en `producto_precios` + actualiza `productos.precio`
- Botón "+ Producto" → drawer lateral (no modal): todos los campos incluyendo alícuota IVA
- Filtro por categoría + búsqueda

**Tab Categorías:**
- Tabla inline editable: nombre, color (color picker), orden
- "+ Categoría" inline al final de la tabla

**Tab Compras:**
- Tabla de compras registradas con fecha, proveedor, total, items
- "+ Registrar compra" → drawer con:
  - Fecha, proveedor, notas
  - Tabla de items: buscar producto, cantidad, costo con IVA, alícuota (autocompletada desde producto), neto calculado
  - Al confirmar: actualiza stock y costos de cada producto

---

## Flujo de pago en Reservas

Desde la vista de reserva, al registrar cobro:

```
┌─────────────────────────────────────┐
│ Registrar cobro — Reserva #R-1234   │
│ Total: $5.000                       │
│                                     │
│ + Agregar pago                      │
│   ┌─────────────────────────────┐   │
│   │ Medio: [Efectivo ▼]  $___  │   │
│   └─────────────────────────────┘   │
│   ┌─────────────────────────────┐   │
│   │ Medio: [Transfer. ▼] $___  │   │
│   │ Cuenta: [Galicia - Pepe ▼] │   │
│   └─────────────────────────────┘   │
│                                     │
│ Registrado: $3.000  Resto: $2.000   │
│                                     │
│ [Confirmar cobro]                   │
└─────────────────────────────────────┘
```

Si hay transferencia → `emitirFactura()` automático con la entidad fiscal de la cuenta seleccionada.

---

## Cambios en sidebar

```typescript
// AdminSidebar.tsx — navItems actualizados
{ href: "/admin/cobros",  label: "Cobros",         icon: Wallet,       requiereModulo: undefined },  // siempre visible
{ href: "/admin/pos",     label: "Punto de Venta", icon: ShoppingCart, requiereModulo: "pos" },
{ href: "/admin/stock",   label: "Stock",           icon: Package,      requiereModulo: "stock" },
// Facturación ya existe con requiresFacturacion — se mantiene igual

// Props del sidebar:
// posActivo: boolean
// stockActivo: boolean
// (facturacionActiva ya existe)
```

---

## APIs nuevas requeridas

| Método | Ruta | Propósito |
|--------|------|-----------|
| GET/POST | `/api/admin/entidades-fiscales` | CRUD entidades |
| PATCH/DELETE | `/api/admin/entidades-fiscales/[id]` | Update/delete |
| GET/POST | `/api/admin/cuentas-bancarias` | CRUD cuentas |
| PATCH/DELETE | `/api/admin/cuentas-bancarias/[id]` | Update/delete |
| POST | `/api/admin/pagos` | Registrar pago de reserva/consumo |
| GET/POST | `/api/admin/pos/consumos` | Listar / crear consumo POS |
| GET | `/api/admin/pos/productos` | Productos activos para POS |
| GET/POST | `/api/admin/stock/productos` | CRUD productos |
| PATCH | `/api/admin/stock/productos/[id]` | Update inline (precio/stock) |
| GET/POST | `/api/admin/stock/categorias` | CRUD categorías |
| GET/POST | `/api/admin/stock/compras` | Registrar compras |
| GET/POST | `/api/admin/iva-alicuotas` | CRUD alícuotas |

---

## Métricas habilitadas

Con el modelo completo se pueden calcular:

- **Margen bruto por producto:** `precio - costo_neto`
- **Ganancia por consumo:** `Σ (precio_unitario - costo_neto) * cantidad`
- **Ingresos por medio de pago:** `Σ pagos GROUP BY medio_pago`
- **Ingresos por entidad fiscal:** `Σ comprobantes GROUP BY entidad_fiscal`
- **Rotación de stock:** consumo promedio vs stock actual
- **Evolución de precios:** historial en `producto_precios`
- **Costo de mercadería:** `Σ compra_items.costo_con_iva` por período

---

## Archivos a crear / modificar

### Nuevos
```
lib/facturacion/types.ts                    — agregar EntidadFiscal, CuentaBancaria, Pago
app/admin/(protected)/pos/page.tsx
app/admin/(protected)/stock/page.tsx
app/api/admin/entidades-fiscales/route.ts
app/api/admin/entidades-fiscales/[id]/route.ts
app/api/admin/cuentas-bancarias/route.ts
app/api/admin/cuentas-bancarias/[id]/route.ts
app/api/admin/pagos/route.ts
app/api/admin/pos/consumos/route.ts
app/api/admin/pos/productos/route.ts
app/api/admin/stock/productos/route.ts
app/api/admin/stock/productos/[id]/route.ts
app/api/admin/stock/categorias/route.ts
app/api/admin/stock/compras/route.ts
app/api/admin/iva-alicuotas/route.ts
components/admin/pos/POSClient.tsx
components/admin/pos/CatalogoGrid.tsx
components/admin/pos/CatalogoLista.tsx
components/admin/pos/Carrito.tsx
components/admin/pos/PanelCobro.tsx
components/admin/stock/StockClient.tsx
components/admin/stock/ProductosTab.tsx
components/admin/stock/CategoriasTab.tsx
components/admin/stock/ComprasTab.tsx
```

### Modificados
```
lib/facturacion/afip-client.ts              — recibe entidad_fiscal_id
lib/facturacion/emitir.ts                   — recibe pago_id
lib/facturacion/types.ts                    — nuevos tipos
components/admin/AdminSidebar.tsx           — +POS, +Stock
components/admin/facturacion/ComprobantesTab.tsx — +origen_tipo, +cuenta
app/api/admin/facturacion/route.ts          — query via pago_id
supabase/migrations/                        — nueva migración
```
