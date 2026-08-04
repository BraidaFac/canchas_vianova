# DB Local con Supabase CLI + Docker

## Prerequisitos

- Docker Desktop corriendo
- Supabase CLI instalado:
  ```bash
  # Windows (scoop)
  scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
  scoop install supabase

  # o npm global
  npm install -g supabase
  ```

## Setup inicial (una sola vez)

```bash
# Inicializar config de Supabase en el proyecto
supabase init
```

Crea `supabase/config.toml`. Verificar que el `project_id` del config sea razonable (ej. `canchas`).

## Levantar stack local

```bash
supabase start
```

Levanta en Docker:
- **PostgreSQL** → `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- **API (PostgREST)** → `http://127.0.0.1:54321`
- **Studio** → `http://127.0.0.1:54323`
- **Auth** → `http://127.0.0.1:54321/auth/v1`

Al terminar imprime las keys locales. Ejemplo de output:

```
API URL: http://127.0.0.1:54321
DB URL:  postgresql://postgres:postgres@127.0.0.1:54322/postgres
anon key: eyJhbGci...
service_role key: eyJhbGci...
```

## .env.local para desarrollo local

Crear `.env.local` (sobreescribe `.env` solo en local):

```env
# Supabase local
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key del output de supabase start>
SUPABASE_SERVICE_ROLE_KEY=<service_role key del output de supabase start>

# JWT — mismo valor que en producción o uno nuevo para local
ADMIN_JWT_SECRET=77f603493275c209404a8e191fb7936ba67c75057f1a1e16a1ce0b8b969d1af1

# Encryption key — mismo valor que prod o uno nuevo para local
ENCRYPTION_KEY=c4a6d1a105943b45f281449defbc5d6d304ded9099b0ea3ddb803866ca8fe881
```

## Correr migrations

```bash
# Aplica todas las migrations de supabase/migrations/ en orden
supabase db reset
```

`db reset` dropea la DB local, la recrea y aplica todas las migrations. Útil para empezar limpio.

Para solo correr migrations nuevas sin resetear:

```bash
supabase migration up
```

## Ver migrations aplicadas

```bash
supabase migration list
```

## Conectarse directo a Postgres

```bash
# psql
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres

# o con supabase CLI
supabase db connect
```

## Detener

```bash
supabase stop
```

Para detener y borrar todos los datos:

```bash
supabase stop --no-backup
```

## Estado del stack

```bash
supabase status
```

---

## Orden de migrations

| Archivo | Descripción |
|---------|-------------|
| `00000000000000_initial_schema.sql` | Schema base (turnos, canchas, etc.) |
| `20260731000001_foundation.sql` | Módulos admin (empleados, clientes, reservas, facturación, config) |
| `20260731120000_stock_tables.sql` | Módulo stock/pos (categorias, productos, compras, consumos) |
