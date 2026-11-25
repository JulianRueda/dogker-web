/* Textos editables de la página. Sirven de:
   1) respaldo si Supabase tarda o la tabla está vacía, y
   2) contenido inicial de la tabla site_content (scripts/seed.mjs).
   [sección del panel, section_key, etiqueta para el cliente, texto original] */
export const CONTENT = [
  ["Barra superior", "topbar_text", "Mensaje de la franja roja superior", "Entregas en Bogotá y Soacha de lunes a sábado · Envíos nacionales coordinados por WhatsApp"],

  ["Banner principal", "hero_eyebrow", "Texto pequeño sobre el título", "Nueva colección de peluches"],
  ["Banner principal", "hero_title", "Título principal del banner", "¿Y si tu mascota pudiera escoger?"],
  ["Banner principal", "hero_subtitle", "Subtítulo del banner", "Productos premium para el juego, el paseo y el cuidado de tu mascota. Calidad en cada detalle y atención cercana en cada pedido."],
  ["Banner principal", "hero_cta_primary_text", "Botón rojo: texto", "Ver la colección"],
  ["Banner principal", "hero_cta_primary_link", "Botón rojo: enlace", "#/c/peluches"],
  ["Banner principal", "hero_cta_secondary_text", "Botón blanco: texto", "Arena de tofu"],
  ["Banner principal", "hero_cta_secondary_link", "Botón blanco: enlace", "#/p/arena-ecologica-de-tofu"],
  ["Banner principal", "hero_product_ref", "Producto de la foto grande (Ref. del producto)", "peluche-dispensador-perezoso"],

  ["Secciones de inicio", "categories_title", "Título de categorías", "Explora por categoría"],
  ["Secciones de inicio", "featured_eyebrow", "Destacados: texto pequeño", "Colección nueva"],
  ["Secciones de inicio", "featured_title", "Destacados: título (muestra los productos marcados como «Destacado»)", "Peluches con dispensador de premios"],
  ["Secciones de inicio", "featured_button_text", "Destacados: texto del botón", "Ver la colección"],
  ["Secciones de inicio", "featured_button_link", "Destacados: enlace del botón", "#/c/peluches?col=peluches-dispensador"],
  ["Secciones de inicio", "paseo_title", "Título de la sección de paseo", "Para el paseo"],

  ["Bloque rojo (arena)", "arena_product_ref", "Producto del bloque (Ref. del producto)", "arena-ecologica-de-tofu"],
  ["Bloque rojo (arena)", "arena_badge", "Etiqueta", "Para gatos"],
  ["Bloque rojo (arena)", "arena_bullets", "Viñetas (una por línea)", "Contenido: 2,4 kg (6 litros)\nAromas: manzana y durazno\nDe origen vegetal, con alta capacidad de absorción\nSe desintegra al contacto con el agua"],
  ["Bloque rojo (arena)", "arena_cta", "Texto del botón", "Elegir aroma"],
  ["Bloque rojo (arena)", "arena_note", "Nota pequeña", "Para desecharla, sigue las indicaciones del empaque y de tu sistema sanitario."],

  ["Cómo pedir", "steps_title", "Título", "Así de fácil es pedir"],
  ["Cómo pedir", "step1_title", "Paso 1: título", "Arma Mi pedido"],
  ["Cómo pedir", "step1_text", "Paso 1: texto", "Elige productos, opciones y cantidades. Tu selección se guarda aunque cierres la página."],
  ["Cómo pedir", "step2_title", "Paso 2: título", "Continúa por WhatsApp"],
  ["Cómo pedir", "step2_text", "Paso 2: texto", "Preparamos un mensaje con tus productos y valores, listo para enviar al +57 312 557 5932."],
  ["Cómo pedir", "step3_title", "Paso 3: título", "Confirmamos contigo"],
  ["Cómo pedir", "step3_text", "Paso 3: texto", "Verificamos disponibilidad, acordamos la entrega y cerramos el pago por WhatsApp."],

  ["Contacto", "whatsapp_number", "Número de WhatsApp (solo números, con 57 al inicio)", "573125575932"],
  ["Contacto", "whatsapp_display", "WhatsApp como se muestra en la página", "+57 312 557 5932"],
  ["Contacto", "instagram_user", "Usuario de Instagram (sin @)", "dogkercol"],

  ["Pie de página", "footer_about", "Descripción de la marca", "Productos premium para el juego, el paseo y el cuidado de tu mascota. Calidad en cada detalle y atención cercana en cada pedido."],
  ["Pie de página", "footer_wa_title", "Recuadro WhatsApp: título", "¿Dudas antes de pedir?"],
  ["Pie de página", "footer_wa_text", "Recuadro WhatsApp: texto", "Escríbenos y te ayudamos a escoger."],
  ["Pie de página", "footer_wa_button", "Recuadro WhatsApp: botón", "Escríbenos"],
  ["Pie de página", "footer_legal_left", "Línea legal izquierda", "© 2026 Dögker · Bogotá, Colombia"],
  ["Pie de página", "footer_legal_right", "Línea legal derecha", "Precios en pesos colombianos (COP). Toda solicitud queda pendiente de confirmación por WhatsApp."],

  ["Páginas de ayuda", "page_como_pedir", "Página «Cómo pedir» (un párrafo por línea)", "1. Agrega productos a Mi pedido. 2. Pulsa Continuar por WhatsApp: se abre un mensaje con tu selección. 3. Envíalo; verificamos disponibilidad, acordamos la entrega y el pago.\nLa lista enviada es una solicitud pendiente de confirmación."],
  ["Páginas de ayuda", "page_politicas", "Página «Políticas comerciales» (un párrafo por línea)", "Contenido pendiente: Dögker definirá aquí sus condiciones de cambios, garantías, pagos y tratamiento de datos."],
];

export const DEFAULTS = Object.fromEntries(CONTENT.map(([, k, , v]) => [k, v]));
