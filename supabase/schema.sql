-- =====================================================================
-- Dögker · Esquema de base de datos para Supabase
-- Pegar COMPLETO en: Supabase Dashboard → SQL Editor → New query → Run.
-- Se puede volver a ejecutar sin romper nada (usa IF NOT EXISTS / DROP POLICY IF EXISTS).
-- Después ejecuta supabase/seed.sql para cargar el catálogo y los textos actuales.
-- =====================================================================

-- ---------- Categorías (2 niveles: departamento del menú → colección) ----------
create table if not exists public.categories (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  slug          text not null unique,
  parent_id     uuid references public.categories(id) on delete restrict,  -- null = aparece en el menú
  image_url     text,                                                       -- foto redonda en "Explora por categoría"
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

-- ---------- Productos ----------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,               -- "Ref." del producto; se usa en la URL y en el pedido de WhatsApp
  name          text not null check (length(trim(name)) > 0),
  description   text not null default '',
  dimensions    text,                               -- "Medidas", ej. 23 × 27 cm
  category_id   uuid references public.categories(id) on delete set null,  -- categoría (opcional)
  variant_label text not null default 'Talla',      -- cómo se llama la opción: Talla, Tamaño, Aroma, Presentación…
  is_active     boolean not null default true,      -- false = oculto en la tienda sin borrarlo
  is_featured   boolean not null default false,     -- aparece en la sección "Destacados" del inicio
  display_order integer not null default 0,         -- orden manual en la tienda (menor = primero)
  created_at    timestamptz not null default now()
);

-- ---------- Fotos (varias por producto; display_order 0 = principal) ----------
create table if not exists public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  image_url     text not null,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists product_images_product_idx on public.product_images(product_id);

-- ---------- Tallas + precios (COP, enteros) ----------
create table if not exists public.product_variants (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products(id) on delete cascade,
  size_label    text not null default '',           -- '' = talla única
  price         integer check (price >= 0),         -- null = "Precio por confirmar"
  sale_price    integer check (sale_price >= 0),    -- precio de oferta (opcional)
  in_stock      boolean not null default true,      -- disponibilidad
  display_order integer not null default 0,         -- (tallas repetidas: las valida el panel)
  check (sale_price is null or price is null or sale_price < price)
);
create index if not exists product_variants_product_idx on public.product_variants(product_id);

-- ---------- Textos de la página (CMS) ----------
create table if not exists public.site_content (
  id            uuid primary key default gen_random_uuid(),
  section_key   text not null unique,               -- ej. hero_title
  label         text not null,                      -- nombre amigable, ej. "Título principal del banner"
  content_value text not null default '',
  section       text not null default 'General',    -- agrupa los campos en el panel
  display_order integer not null default 0
);

-- =====================================================================
-- Seguridad (RLS): todo el mundo puede LEER; solo usuarios autenticados
-- pueden CREAR / EDITAR / BORRAR.
-- IMPORTANTE: desactiva el registro público de usuarios (ver README),
-- de lo contrario cualquiera podría crearse una cuenta y editar.
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['categories','products','product_images','product_variants','site_content'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Lectura pública" on public.%I', t);
    execute format('create policy "Lectura pública" on public.%I for select using (true)', t);
    execute format('drop policy if exists "Admin inserta" on public.%I', t);
    execute format('create policy "Admin inserta" on public.%I for insert to authenticated with check (true)', t);
    execute format('drop policy if exists "Admin edita" on public.%I', t);
    execute format('create policy "Admin edita" on public.%I for update to authenticated using (true) with check (true)', t);
    execute format('drop policy if exists "Admin borra" on public.%I', t);
    execute format('create policy "Admin borra" on public.%I for delete to authenticated using (true)', t);
  end loop;
end $$;

-- =====================================================================
-- Storage: bucket público "productos" para las fotos (máx. 5 MB, solo imágenes).
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Fotos: lectura pública" on storage.objects;
create policy "Fotos: lectura pública" on storage.objects for select using (bucket_id = 'productos');
drop policy if exists "Fotos: admin sube" on storage.objects;
create policy "Fotos: admin sube" on storage.objects for insert to authenticated with check (bucket_id = 'productos');
drop policy if exists "Fotos: admin edita" on storage.objects;
create policy "Fotos: admin edita" on storage.objects for update to authenticated using (bucket_id = 'productos');
drop policy if exists "Fotos: admin borra" on storage.objects;
create policy "Fotos: admin borra" on storage.objects for delete to authenticated using (bucket_id = 'productos');
