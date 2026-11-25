-- Diagnóstico de permisos. Ejecutar en el SQL Editor y copiar el resultado.
grant usage on schema public to anon, authenticated;
grant select on public.categories, public.products, public.product_images, public.product_variants, public.site_content to anon, authenticated;
grant insert, update, delete on public.categories, public.products, public.product_images, public.product_variants, public.site_content to authenticated;
notify pgrst, 'reload schema';

select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as permisos
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;
