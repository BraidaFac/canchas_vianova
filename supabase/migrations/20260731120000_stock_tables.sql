-- Stock module tables

CREATE TABLE categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  orden int NOT NULL DEFAULT 0,
  activo bool NOT NULL DEFAULT true
);

CREATE TABLE productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  categoria_id uuid REFERENCES categorias(id),
  precio numeric NOT NULL DEFAULT 0,
  costo_con_iva numeric,
  costo_neto numeric,
  iva_alicuota_id uuid REFERENCES iva_alicuotas(id),
  stock_actual int NOT NULL DEFAULT 0,
  tiene_stock bool NOT NULL DEFAULT true,
  unidad text NOT NULL DEFAULT 'unidad' CHECK (unidad IN ('unidad','kg','litro')),
  activo bool NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE producto_precios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  precio numeric NOT NULL,
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  empleado_id uuid REFERENCES admins(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE compras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  proveedor text,
  notas text,
  empleado_id uuid REFERENCES admins(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE compra_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id uuid NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES productos(id),
  cantidad int NOT NULL CHECK (cantidad > 0),
  costo_con_iva numeric NOT NULL,
  iva_alicuota_id uuid NOT NULL REFERENCES iva_alicuotas(id),
  costo_neto numeric NOT NULL
);
