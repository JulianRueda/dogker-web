# Dögker — tienda + panel de administración

Tienda (descargada de Figma Make) conectada a **Supabase**. El cliente administra productos, fotos, tallas/precios, categorías y textos desde **`/admin`**, sin tocar código.

```
index.html, app.js, styles.css, logic.js   → tienda pública
content-defaults.js                         → textos originales (respaldo + contenido inicial)
admin/                                      → panel: login, productos, editar, categorías, textos
supabase/schema.sql                         → tablas + RLS + bucket de fotos
supabase/seed.sql                           → catálogo actual (123 productos) + textos
public/imagenes/                            → fotos originales del catálogo
```

## 1. Configurar Supabase (una sola vez)

1. **SQL Editor → New query** → pega **todo** `supabase/schema.sql` → **Run**.
   Crea las tablas `categories`, `products`, `product_images`, `product_variants`, `site_content`, las políticas RLS (lectura pública, escritura solo con sesión) y el bucket público **`productos`** (máx. 5 MB, JPG/PNG/WebP).
2. Nueva query → pega **todo** `supabase/seed.sql` → **Run**. Carga el catálogo y los textos actuales. Se puede repetir sin duplicar.
3. **Authentication → Sign In / Providers → Email** → desactiva **"Allow new users to sign up"**.
   ⚠️ Obligatorio: las políticas dejan editar a *cualquier usuario autenticado*. Si el registro queda abierto, cualquiera podría crearse una cuenta y modificar la tienda.
4. **Authentication → URL Configuration**: en *Site URL* pon el dominio de la tienda (ej. `https://dogker.com`) y en *Redirect URLs* agrega `https://dogker.com/admin/login/` (y `http://localhost:5173/admin/login/` para pruebas). Lo usa "¿Olvidaste tu contraseña?".

## 2. Variables de entorno

Copia `.env.example` a `.env` y pega los valores de **Project Settings → API**:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Llevan el prefijo `VITE_` porque Vite solo expone al navegador variables con ese prefijo (es la protección para no filtrar por error otra clave). La anon key es pública por diseño; **nunca** pongas la `service_role` key.

## 3. Correr y publicar

```
npm install
npm run dev      # http://localhost:5173  y  http://localhost:5173/admin/
npm run build    # genera dist/ para subir a Vercel, Netlify, Cloudflare Pages, etc.
npm test
```

En el hosting, configura las mismas dos variables `VITE_SUPABASE_*`. Cada ruta del panel es una página real (`/admin/productos/`, `/admin/textos/`…), así que no requiere reglas de redirección.

## 4. Crear el usuario del cliente

1. Supabase → **Authentication → Users → Add user → Create new user**.
2. Escribe el correo del cliente y una contraseña temporal. Marca **Auto Confirm User**.
3. Envíale: la dirección `https://tu-dominio/admin/`, su correo y la contraseña temporal.
4. Pídele que entre y use **"¿Olvidaste tu contraseña?"** para crear la suya propia (así tú no conoces su clave). Desde ahí puede cambiarla cuando quiera, sin depender de tu cuenta.

Para quitarle el acceso: Users → el usuario → **Delete user**.

## Qué puede editar el cliente

- **Productos**: nombre, descripción, medidas, categoría, visible/oculto, destacado en el inicio, orden (flechas), varias fotos (subir, reordenar, la primera es la principal; se comprimen a 1600 px en el navegador) y N filas de **talla + precio + precio de oferta + disponible**. El nombre de la opción también se edita (Talla, Tamaño, Aroma…).
- Colores: un producto por color, nombrado «Nombre - Color» (ej. «Arnés Honey - Rojo»); la tienda los agrupa en una ficha con selector de color, igual que el diseño original.
- **Categorías**: menú principal y subcategorías, orden y foto redonda del inicio.
- **Textos de la página**: banner, secciones del inicio, pasos, contacto/WhatsApp, Instagram, pie de página y páginas de ayuda. Si un campo queda vacío, la página usa el texto original.

Fuera del panel (siguen en código): la tabla de horarios de entrega y los tiempos de envío nacional.

## Regenerar el seed

Si cambias `supabase/catalogo.json` o `content-defaults.js`: `npm run seed` → vuelve a ejecutar `supabase/seed.sql`.
