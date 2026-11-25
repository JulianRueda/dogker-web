-- Ejecutar en el SQL Editor si la tienda muestra "permission denied for table ...".
-- (Ya está incluido en schema.sql; esto es solo para proyectos donde schema.sql se corrió antes del arreglo.)
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.product_images, public.product_variants, public.site_content to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_images, public.product_variants, public.site_content to authenticated;

-- Verificación: debería mostrar 25 categorías, 123 productos, >=123 fotos, ~180 tallas, 38 textos y el bucket público.
select 'categorias' as tabla, count(*) from public.categories
union all select 'productos', count(*) from public.products
union all select 'fotos', count(*) from public.product_images
union all select 'tallas', count(*) from public.product_variants
union all select 'textos', count(*) from public.site_content
union all select 'bucket productos (1 = ok)', count(*) from storage.buckets where id = 'productos' and public;
