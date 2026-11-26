-- Actualiza dos textos ya guardados al tono cercano nuevo, SOLO si nadie los cambió desde el panel.
-- Ejecutar en Supabase → SQL Editor → Run. Se puede repetir sin problema.
update public.site_content
set content_value = 'Precios en pesos colombianos (COP). Confirmamos cada pedido contigo por WhatsApp.'
where section_key = 'footer_legal_right'
  and content_value = 'Precios en pesos colombianos (COP). Toda solicitud queda pendiente de confirmación por WhatsApp.';

update public.site_content
set content_value = E'1. Agrega productos a Mi pedido. 2. Pulsa Continuar por WhatsApp: se abre un mensaje con tu selección. 3. Envíalo y listo: revisamos disponibilidad y acordamos contigo la entrega y el pago.\nTu lista es una solicitud: antes de cobrarte, te confirmamos todo por WhatsApp.'
where section_key = 'page_como_pedir'
  and content_value = E'1. Agrega productos a Mi pedido. 2. Pulsa Continuar por WhatsApp: se abre un mensaje con tu selección. 3. Envíalo; verificamos disponibilidad, acordamos la entrega y el pago.\nLa lista enviada es una solicitud pendiente de confirmación.';

-- El texto obsoleto de "Políticas comerciales" ya no se usa (la página ahora es Términos y condiciones).
delete from public.site_content where section_key = 'page_politicas';

select section_key, left(content_value, 80) as texto from public.site_content where section_key in ('footer_legal_right', 'page_como_pedir');
