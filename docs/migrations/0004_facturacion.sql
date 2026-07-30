-- Configuración de facturación electrónica (fila única, id=1)
create table if not exists config_facturacion (
  id int primary key default 1,
  cuit text,
  razon_social text,
  domicilio text,
  condicion_iva text default 'monotributo',  -- 'monotributo' | 'responsable_inscripto'
  punto_venta int,
  afipsdk_token text,
  cert_encrypted text,   -- AES-256-GCM encrypted PEM certificate
  key_encrypted text,    -- AES-256-GCM encrypted RSA private key
  modo text default 'testing',   -- 'testing' | 'produccion'
  activo boolean default false,
  updated_at timestamptz default now()
);

-- Insertar fila única vacía si no existe
insert into config_facturacion (id) values (1) on conflict (id) do nothing;

-- Registro completo de todos los comprobantes
create table if not exists comprobantes (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references reservas(id) on delete set null,
  tipo_cbte int not null default 11,       -- 11=Factura C, 6=Factura B
  punto_venta int,
  nro_cbte bigint,                         -- null hasta confirmación ARCA
  fecha_cbte date not null,
  cae text,
  vencimiento_cae date,
  importe numeric(12,2) not null,
  concepto int default 2,                  -- 2=Servicios
  doc_tipo int default 99,                 -- 99=Consumidor Final
  doc_nro bigint default 0,
  nombre_receptor text,
  estado text default 'pendiente',         -- pendiente | emitida | fallida | anulada
  cae_manual boolean default false,        -- true si el CAE fue ingresado manualmente desde el portal ARCA
  intentos int default 0,
  datos_envio jsonb,                       -- payload exacto enviado a ARCA
  datos_respuesta jsonb,                   -- respuesta completa de ARCA
  ultimo_error text,
  emitida_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists comprobantes_reserva_id_idx on comprobantes(reserva_id);
create index if not exists comprobantes_estado_idx on comprobantes(estado);
create index if not exists comprobantes_created_at_idx on comprobantes(created_at desc);
create unique index if not exists comprobantes_unique_nro
  on comprobantes(punto_venta, nro_cbte, tipo_cbte)
  where nro_cbte is not null;
