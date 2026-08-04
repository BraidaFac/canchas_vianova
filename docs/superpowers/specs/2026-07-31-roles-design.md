# Sistema de Roles — Diseño

**Fecha:** 2026-07-31  
**Branch:** feat/facturacion-electronica  
**Estado:** Aprobado

---

## Contexto

El sistema tenía dos roles (`admin`, `superadmin`) con protección inconsistente:
- 7 API routes con `requireSuperAdmin` copiado manualmente
- Sidebar usaba `superadminOnly: boolean` — solo ocultaba el link, no protegía la ruta
- Acceso directo a `/admin/empleados` por URL no era bloqueado a nivel página

Se agrega un tercer rol `root` para gestión de módulos habilitados/deshabilitados, con arquitectura de 3 capas que cierra los agujeros existentes.

---

## Jerarquía de Roles

```
admin (0) < superadmin (1) < root (2)
```

| Rol        | Acceso                                                         |
|------------|----------------------------------------------------------------|
| `admin`    | Grilla, Reservas, Clientes, Eventos, Cobros, Facturación (si módulo activo) |
| `superadmin` | Todo lo anterior + Empleados, Configuración, Entidades fiscales, Cuentas bancarias |
| `root`     | Todo lo anterior + Módulos (habilitar/deshabilitar módulos del sistema) |

**Restricciones:**
- Solo puede existir un empleado con `rol = 'root'` (partial unique index en DB)
- El empleado `root` no aparece en la grilla de empleados (filtrado en query)
- El rol `root` solo puede asignarse directo en DB — no desde la UI de empleados

---

## Arquitectura: 3 Capas

### Capa 0 — Tipos y utilidades (`lib/auth.ts`)

Single source of truth para roles.

```ts
export type Role = "admin" | "superadmin" | "root"

export type AdminSession = {
  id: string
  nombre: string
  rol: Role          // antes: "admin" | "superadmin" — ahora usa Role
  telefono: string
}

export const ROLE_LEVEL: Record<Role, number> = {
  admin: 0,
  superadmin: 1,
  root: 2,
}

export function hasMinRole(session: AdminSession, min: Role): boolean {
  return ROLE_LEVEL[session.rol] >= ROLE_LEVEL[min]
}
```

### Capa 1 — `proxy.ts` (protección de páginas)

Archivo nuevo en raíz del proyecto. Corre antes de que Next.js renderice cualquier Server Component.

```ts
// proxy.ts
import { NextRequest, NextResponse } from "next/server"
import { verifySession, hasMinRole } from "@/lib/auth"

export const config = {
  matcher: [
    "/admin/empleados",
    "/admin/empleados/:path*",
    "/admin/config",
    "/admin/config/:path*",
    "/admin/modulos",
    "/admin/modulos/:path*",
  ],
}

export async function proxy(request: NextRequest) {
  const token = request.cookies.get("admin_session")?.value
  const session = token ? await verifySession(token) : null

  if (!session) {
    return NextResponse.redirect(new URL("/admin/login", request.url))
  }

  const { pathname } = request.nextUrl

  if (pathname.startsWith("/admin/modulos") && !hasMinRole(session, "root")) {
    return NextResponse.redirect(new URL("/admin", request.url))
  }

  if (
    (pathname.startsWith("/admin/empleados") || pathname.startsWith("/admin/config")) &&
    !hasMinRole(session, "superadmin")
  ) {
    return NextResponse.redirect(new URL("/admin", request.url))
  }

  return NextResponse.next()
}
```

**Nota:** Usa `request.cookies` directamente, no `cookies()` de `next/headers` — proxy.ts no tiene request context de Next.js, trabaja con la request HTTP cruda.

### Capa 2 — `lib/api-auth.ts` (protección de API routes)

Archivo nuevo. Centraliza todos los guards que hoy están copiados en 7 archivos.

```ts
// lib/api-auth.ts
import { getSession, hasMinRole, Role } from "@/lib/auth"

export async function requireRole(min: Role) {
  const session = await getSession()
  if (!session) return { error: "No autenticado", status: 401 as const }
  if (!hasMinRole(session, min)) return { error: `Requiere rol ${min}`, status: 403 as const }
  return session
}

export const requireAdmin      = () => requireRole("admin")
export const requireSuperAdmin = () => requireRole("superadmin")
export const requireRoot       = () => requireRole("root")
```

Uso en route handlers:

```ts
const auth = await requireSuperAdmin()
if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
// auth es AdminSession aquí
```

### Capa 3 — Sidebar (`AdminSidebar.tsx`)

Reemplaza `superadminOnly: boolean` con `minRole: Role`. Solo afecta visibilidad — nunca es la capa de seguridad.

```ts
import { Role, hasMinRole } from "@/lib/auth"

const navItems: Array<{
  href: string
  label: string
  icon: LucideIcon
  minRole?: Role
  requiresFacturacion?: boolean
  requiresPos?: boolean
  requiresStock?: boolean
}> = [
  { href: "/admin/grilla",     label: "Grilla",        icon: CalendarDays },
  { href: "/admin/reservas",   label: "Reservas",       icon: List },
  { href: "/admin/clientes",   label: "Clientes",       icon: Contact },
  { href: "/admin/eventos",    label: "Eventos",        icon: Trophy },
  { href: "/admin/cobros",     label: "Cobros",         icon: Wallet },
  { href: "/admin/empleados",  label: "Empleados",      icon: Users,    minRole: "superadmin" },
  { href: "/admin/facturacion",label: "Facturación",    icon: Receipt,  requiresFacturacion: true },
  { href: "/admin/pos",        label: "POS",            icon: ShoppingCart, requiresPos: true },
  { href: "/admin/stock",      label: "Stock",          icon: Package,  requiresStock: true },
  { href: "/admin/config",     label: "Configuración",  icon: Settings, minRole: "superadmin" },
  { href: "/admin/modulos",    label: "Módulos",        icon: Layers,   minRole: "root" },
]

const visibleItems = navItems.filter((item) => {
  if (!hasMinRole(session, item.minRole ?? "admin")) return false
  if (item.requiresFacturacion && !facturacionActiva) return false
  if (item.requiresPos && !posActivo) return false
  if (item.requiresStock && !stockActivo) return false
  return true
})
```

---

## Base de Datos

### 1. Actualizar constraint de rol en empleados

```sql
ALTER TABLE empleados
  DROP CONSTRAINT IF EXISTS empleados_rol_check,
  ADD CONSTRAINT empleados_rol_check
    CHECK (rol IN ('admin', 'superadmin', 'root'));
```

### 2. Partial unique index — solo un root posible

```sql
CREATE UNIQUE INDEX unique_root_empleado ON empleados (rol) WHERE rol = 'root';
```

Impide crear un segundo empleado root incluso desde Supabase directamente.

### 3. Filtrar root en query de empleados

```ts
// app/api/admin/empleados/route.ts
const { data } = await supabase
  .from("empleados")
  .select("*")
  .neq("rol", "root")
  .order("nombre")
```

---

## Nueva página: `/admin/modulos`

- **Route:** `app/admin/(protected)/modulos/page.tsx`
- **API:** `app/api/admin/config/modulos/route.ts` (ya existe) — actualizar guard a `requireRoot()`
- **UI:** Toggles para habilitar/deshabilitar `facturacion`, `pos`, `stock` en tabla `config_modulos`
- **Protección:** proxy.ts redirige si `rol !== "root"`, API route devuelve 403

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `lib/auth.ts` | Agregar `Role`, `ROLE_LEVEL`, `hasMinRole` |
| `lib/api-auth.ts` | **Nuevo** — `requireRole`, `requireAdmin`, `requireSuperAdmin`, `requireRoot` |
| `proxy.ts` | **Nuevo** — protección de páginas por rol |
| `components/admin/AdminSidebar.tsx` | `superadminOnly` → `minRole: Role`, usar `hasMinRole` |
| `app/api/admin/empleados/route.ts` | Importar `requireSuperAdmin` de `lib/api-auth`, filtrar `rol != 'root'` |
| `app/api/admin/empleados/[id]/route.ts` | Importar `requireSuperAdmin` de `lib/api-auth` |
| `app/api/admin/config/bot/route.ts` | Importar `requireSuperAdmin` de `lib/api-auth` |
| `app/api/admin/config/facturacion/route.ts` | Importar `requireSuperAdmin` de `lib/api-auth` |
| `app/api/admin/config/modulos/route.ts` | Cambiar guard a `requireRoot` |
| `app/api/admin/cuentas-bancarias/route.ts` | Importar `requireSuperAdmin` de `lib/api-auth` |
| `app/api/admin/cuentas-bancarias/[id]/route.ts` | Importar `requireSuperAdmin` de `lib/api-auth` |
| `app/api/admin/entidades-fiscales/route.ts` | Importar `requireSuperAdmin` de `lib/api-auth` |
| `app/api/admin/entidades-fiscales/[id]/route.ts` | Importar `requireSuperAdmin` de `lib/api-auth` |
| `app/admin/(protected)/modulos/page.tsx` | **Nuevo** — UI de gestión de módulos |
| `app/admin/(protected)/modulos/` | **Nuevo** — directorio de ruta |
| DB migration | Constraint + partial unique index + query filter |

---

## Invariantes de Seguridad

1. **proxy.ts** — ningún Server Component de página protegida renderiza sin rol correcto
2. **lib/api-auth.ts** — ningún dato sensible sale de API sin verificación JWT + rol
3. **DB constraint** — `rol` solo acepta valores válidos
4. **DB unique index** — imposible tener 2 empleados root
5. **Query filter** — root nunca aparece en UI de empleados
6. **Sidebar** — cosmético, nunca capa de seguridad

Las capas 1 y 2 son independientes. Si una falla (bug, olvido), la otra contiene el agujero.
