// Actualización del catálogo (noviembre 2026) a partir de supabase/catalogo-2026-11.txt (export del Word del cliente).
// Uso: node scripts/catalogo-nov.mjs "<carpeta con las fotos nuevas>"
//  -> public/imagenes/<slug>-<n>.webp (+ -540.webp) para los productos nuevos
//  -> supabase/actualizar-catalogo.sql (idempotente: se puede ejecutar más de una vez)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { framed } from "./fotos.mjs";

const DOC = readFileSync(new URL("../supabase/catalogo-2026-11.txt", import.meta.url), "utf8").split("\n").map((s) => s.trim());
const isTitle = (l, i) => i > 10 && l.length > 3 && !l.includes(":") && !/^Descripciones comerciales/.test(l);
const TITLES = DOC.map((l, i) => (isTitle(l, i) ? i + 1 : 0)).filter(Boolean); // números de línea (1-based)

function block(line) {
  const next = TITLES.find((t) => t > line) ?? DOC.length + 1;
  return DOC.slice(line, next - 1).filter(Boolean);
}
const field = (b, re) => b.find((l) => re.test(l))?.replace(re, "").trim() || null;
const desc = (line) => field(block(line), /^Descripción comercial\s*:\s*/i);
const dims = (line) => field(block(line), /^(Dimensiones|Talla y medidas|tamaño)\s*:\s*/i)?.replace(/\.$/, "") || null;
export function prices(line) {
  const m = /Precios?\s*:\s*([\s\S]*)$/.exec(block(line).join(" "));
  if (!m) return [];
  const pairs = [...m[1].matchAll(/([A-Za-zÁÉÍÓÚáéíóúñ][\wÁÉÍÓÚáéíóúñ ]*?)\s*:\s*\$\s?([\d.]+)/g)].map((r) => ({ label: r[1].trim(), price: +r[2].replace(/\./g, "") }));
  if (pairs.length) return pairs;
  const one = /\$\s?([\d.]+)/.exec(m[1]);
  return one ? [{ label: null, price: +one[1].replace(/\./g, "") }] : [];
}

/* ---------- Fichas que ya existen: línea del documento -> productos (uno por color) ---------- */
const EXISTING = {
  12: ["collar-atomic"], 22: ["collar-running"], 32: ["collar-kronox-fucsia", "collar-kronox-azul", "collar-kronox-turquesa"],
  42: ["peluche-mapache-alargado"], 52: ["correa-todo-mountain-negra"], 62: ["juguete-interactivo-mariposa"], 80: ["juguete-deluxe-para-gatos"],
  90: ["arenera-tom-amarillo", "arenera-tom-rojo", "arenera-tom-azul"], 100: ["arenera-silvestre-azul", "arenera-silvestre-beige", "arenera-silvestre-rojo"],
  110: ["arenera-capsula-2-en-1"], 120: ["comedero-4-paticas"], 130: ["comedero-romance"], 140: ["comedero-burbuja"], 150: ["arena-ecologica-de-tofu"],
  160: ["arnes-honey-azul", "arnes-honey-rojo", "arnes-honey-durazno", "arnes-honey-negro", "arnes-honey-verde"],
  178: ["arenera-doble-altura-con-pala-y-portapala-azul", "arenera-doble-altura-con-pala-y-portapala-gris", "arenera-doble-altura-con-pala-y-portapala-rosado-claro", "arenera-doble-altura-con-pala-y-portapala-rosado-oscuro"],
  188: ["arenera-max-2-en-1", "arenera-max-2-en-1-gris"], 198: ["tt-series-rocket-cat-litter-box-rosa", "tt-series-rocket-cat-litter-box-gris"],
  208: ["areneras-suprema"], 218: ["arenera-titanic-azul", "arenera-titanic-rosado"],
  228: ["transportador-rel-azul", "transportador-rel-rojo", "transportador-rel-gris", "transportador-rel-negro", "transportador-rel-rosado", "transportador-rel-camuflado", "transportador-rel-morado"],
  238: ["peluche-monkey-rosado", "peluche-monkey-amarillo", "peluche-monkey-azul"], 248: ["peluche-ciclope-azul", "peluche-ciclope-naranja"],
  258: ["peluche-yogui"], 268: ["peluche-minino"], 278: ["peluche-puerquito"], 288: ["peluche-osito-multicolor-firme"], 298: ["peluche-osito-multicolor-sentado"],
  308: ["peluche-conejo-multicolor"], 318: ["peluche-conejo-alargado"], 328: ["peluche-mono-alargado"], 338: ["peluche-oveja-alargada"], 348: ["peluche-leon-alargado"],
  360: ["peluche-zorro-alargado"], 372: ["peluche-aguila-hunter"], 384: ["peluche-gallo-hunter"], 396: ["peluche-paloma-hunter"], 408: ["peluche-pato-hunter"],
  420: ["peluche-coco-pet"], 432: ["peluche-dispensador-jirafa"], 444: ["peluche-dispensador-koala"], 456: ["peluche-dispensador-unicornio"],
  468: ["peluche-dispensador-mono"], 480: ["peluche-dispensador-perezoso"], 492: ["peluche-dispensador-lemur"], 504: ["peluche-dispensador-dinosaurio"],
  516: ["peluche-mister-alejo"], 528: ["peluche-mister-aguila"], 540: ["peluche-mister-flamenco"], 552: ["juguete-de-vinilo-racimo-de-bananos"],
  562: ["juguete-pina-en-tpr"], 574: ["juguete-sandia-en-tpr"], 586: ["juguete-limon-en-tpr"],
  598: ["lazo-con-pelota-mediana-azul", "lazo-con-pelota-mediana-rosada"], 612: ["lazo-nudo-verdugo-azul", "lazo-nudo-verdugo-morado"],
  626: ["lazo-doble-nudo-con-agarradera-azul-rosado", "lazo-doble-nudo-con-agarradera-rosado-azul"], 638: ["huesos-magic-bones"],
  650: ["comedero-para-perros-ansiosos-huesos"], 668: ["comedero-para-perros-ansiosos-xl"], 678: ["bebedero-portatil-ciclovia"],
  686: ["dispensador-de-alimentos-con-medidor"], 694: ["comedero-inteligente-interactivo"], 704: ["cepillo-expulsapelo-rectangular"],
  712: ["cepillo-expulsapelo-360"], 720: ["cepillo-deslanador-furmipets"],
  728: ["comedero-dinastia-verde", "comedero-dinastia-gris", "comedero-dinastia-rosado", "comedero-dinastia-azul"], 738: ["bebedero-fuente-sweet"],
  746: ["pala-filtradora-para-arenera"], 762: ["portabolsas-soda", "portabolsas-cupcake"], 770: ["toallas-de-entrenamiento"],
  778: ["panal-para-mascotas-hembra"], 786: ["panal-postquirurgico-y-antimarcas-para-macho"],
  804: ["collar-para-gato-corazones"], 812: ["collar-para-gatos-coronas"], 827: ["collar-para-gato-flores"], 835: ["collar-para-gatos-minimalista"],
  858: ["collar-para-gatos-escarchado"], 866: ["collar-para-gatos-happy-cats"], 881: ["collar-para-gatos-cachaco"], 889: ["collar-para-gatos-cool-cat"],
  897: ["collar-para-gatos-flores-delicadas"], 905: ["collar-para-gatos-corazoncitos-azules"],
  913: ["correa-collar-extreme-solida-azul", "correa-collar-extreme-solida-negra", "correa-collar-extreme-solida-rosada", "correa-collar-extreme-rojo"],
  927: ["correa-collar-extreme-dual-rosada", "correa-collar-extreme-dual-azul"],
};
// Disponibilidad según el título de la ficha: "out" = agotado; lista = solo esas tallas disponibles; sin entrada = todo disponible.
const STOCK = { 120: "out", 130: "out", 150: "out", 188: "out", 198: "out", 218: "out", 228: "out", 552: "out", 668: "out", 746: "out",
  22: ["S", "L", "XL"], 160: ["XS", "S", "L"], 720: ["S"], 786: ["S", "L"], 913: ["Correa"],
  12: "skip" }; // Atomic: dice "solo S" pero no tiene talla S -> no se toca, queda para revisión

/* ---------- Productos nuevos ---------- */
const P = (slug, name, line, cat, imgs, extra = {}) => ({ slug, name, line, cat, imgs, ...extra });
const NEW = [
  P("cepillo-dental-triple-contacto", "Cepillo dental Triple Contacto", 1145, "cuidado-cepillos", ["Cepillo triple contacto 1", "Cepillo triple contacto 2", "Cepillo triple contacto 3", "Cepillo triple contacto 4"]),
  ...["Gris", "Rosa"].map((c) => P(`comedero-importado-deluxe-${c.toLowerCase()}`, `Comedero importado Deluxe - ${c}`, 941, "comederos-comederos-y-bebederos",
    [`Comedero importado Deluxe_${c}`, `Comedero importado Deluxe_${c} 2`, `Comedero importado Deluxe_${c} 3`, `Comedero importado Deluxe_${c} 4`],
    { label: "Diseño", dims: "18 cm o 23 cm", variants: [["Hueso · 18 cm", 17200], ["Corona · 18 cm", 17200], ["Moño · 18 cm", 17200], ["Hueso · 23 cm", 20900], ["Corona · 23 cm", 20900], ["Moño · 23 cm", 20900]] })),
  P("juguete-bowling-l-azul", "Juguete Bowling L - Azul", 1109, "juguetes-juguetes", ["Juguete Bowling L_Azul", "Juguete Bowling L_Azul 2"]),
  P("juguete-bowling-l-rosa", "Juguete Bowling L - Rosa", 1109, "juguetes-juguetes", ["Juguete Bowling L_Rosa", "Juguete Bowling L_Rosa 2"]),
  P("juguete-bowling-m-amarillo", "Juguete Bowling M - Amarillo", 1100, "juguetes-juguetes", ["Juguete Bowling M_Amarillo", "Juguete Bowling M_Amarillo 2"]),
  P("juguete-bowling-m-azul", "Juguete Bowling M - Azul", 1100, "juguetes-juguetes", ["Juguete Bowling M_Azul", "Juguete Bowling M_Azul 2"]),
  P("juguete-rugby-l-amarillo", "Juguete Rugby L - Amarillo", 1118, "juguetes-juguetes", ["Juguete Rugby L 1", "Juguete Rugby L 2"]),
  P("juguete-rugby-l-rosa", "Juguete Rugby L - Rosa", 1118, "juguetes-juguetes", ["Juguete Rugby L 3", "Juguete Rugby L 4"]),
  P("juguete-rugby-m-azul", "Juguete Rugby M - Azul", 1127, "juguetes-juguetes", ["Juguete Rugby S 2", "Juguete Rugby S 3", "Juguete Rugby S 1"]),
  P("juguete-rugby-m-rosa", "Juguete Rugby M - Rosa", 1127, "juguetes-juguetes", ["Juguete Rugby S 4", "Juguete Rugby S 5", "Juguete Rugby S 1"]),
  P("juguete-tripode-l", "Juguete Trípode L", 1064, "juguetes-juguetes", ["Juguete Tripode L", "Juguete Tripode L morado", "Juguete Tripode L_Verde"]),
  P("juguete-tripode-m", "Juguete Trípode M", 1073, "juguetes-juguetes", ["Juguete Tripode M", "Juguete Tripode M 2", "Juguete Tripode M_Amarillo", "Juguete Tripode M_Naranja"]),
  P("pelota-boom-gigante-amarillo", "Pelota Boom gigante - Amarillo", 1055, "juguetes-pelotas", ["Pelota boom Gigante_Amarilla", "Pelota boom Gigante"]),
  P("pelota-boom-gigante-rosa", "Pelota Boom gigante - Rosa", 1055, "juguetes-pelotas", ["Pelota boom Gigante_Rosa", "Pelota boom Gigante"]),
  P("pelota-boom-grande-azul", "Pelota Boom grande - Azul", 1046, "juguetes-pelotas", ["Pelota boom grande_Azul", "Pelota boom grande"]),
  P("pelota-boom-grande-verde", "Pelota Boom grande - Verde", 1046, "juguetes-pelotas", ["Pelota boom grande_Verde", "Pelota boom grande"]),
  P("pelota-dispensadora-sensory-ball", "Pelota dispensadora Sensory Ball", 1019, "juguetes-pelotas", ["Pelota dispensadora Sensory ball", "Pelota dispensadora Sensory ball 2"]),
  P("pelota-grande-track-azul", "Pelota grande Track - Azul", 1037, "juguetes-pelotas", ["Pelota grande Track Azul_1", "Pelota grande Track_Azul 2"]),
  P("pelota-grande-track-verde", "Pelota grande Track - Verde", 1037, "juguetes-pelotas", ["Pelota grande Track_Verde", "Pelota grande Track_Verde 2"]),
  P("pelota-maciza-basket-gigante-azul", "Pelota maciza Basket gigante - Azul", 1010, "juguetes-pelotas", ["Pelota maciza Basket Gigante_Azul", "Pelota maciza Basket Gigante_Azul 2"]),
  P("pelota-maciza-basket-gigante-verde", "Pelota maciza Basket gigante - Verde", 1010, "juguetes-pelotas", ["Pelota maciza Basket Gigante_Verde", "Pelota maciza Basket Gigante_Verde 2"]),
  P("pelota-maciza-basket-mediana-roja", "Pelota maciza Basket mediana - Roja", 1001, "juguetes-pelotas", ["Pelota maciza basket mediana_Roja", "Pelota maciza basket mediana_Roja 2"]),
  P("pelota-maciza-basket-mediana-verde", "Pelota maciza Basket mediana - Verde", 1001, "juguetes-pelotas", ["Pelota maciza basket mediana_Verde", "Pelota maciza basket mediana_Verde 2"]),
  P("pelota-maciza-futbol-gigante-roja", "Pelota maciza Fútbol gigante - Roja", 992, "juguetes-pelotas", ["Pelota maciza futbol gigante_Roja 2", "Pelota maciza futbol gigante"]),
  P("pelota-maciza-futbol-gigante-verde", "Pelota maciza Fútbol gigante - Verde", 992, "juguetes-pelotas", ["Pelota maciza futbol gigante_Verde", "Pelota maciza futbol gigante"]),
  P("pelota-maciza-volley-mediana-azul", "Pelota maciza Volley mediana - Azul", 981, "juguetes-pelotas", ["Pelota maciza volley mediana_Azul", "Pelota maciza volley mediana_Azul 2"]),
  P("pelota-maciza-volley-mediana-roja", "Pelota maciza Volley mediana - Roja", 981, "juguetes-pelotas", ["Pelota maciza volley mediana_Roja", "Pelota maciza volley mediana_Roja 2"]),
  P("pelota-mediana-track-amarillo", "Pelota mediana Track - Amarillo", 1028, "juguetes-pelotas", ["Pelota mediana Track _Amarillo", "Pelota mediana Track _Amarillo 2"]),
  P("pelota-mediana-track-rosa", "Pelota mediana Track - Rosa", 1028, "juguetes-pelotas", ["Pelota mediana Track _Rosa", "Pelota mediana Track _Rosa 2"]),
  // Fotos "Colita catnip": blanca/naranja = felina (blanco y café), negra/gris = gatuna (negro y gris). Revisar con el cliente.
  P("juguete-deluxe-colita-felina", "Juguete Deluxe Colita felina", 1166, "gatos-juguetes-para-gato", ["Peluche Colita catnip 5", "Peluche Colita catnip", "Peluche Colita catnip 3"]),
  P("juguete-deluxe-colita-gatuna", "Juguete Deluxe Colita gatuna", 1175, "gatos-juguetes-para-gato", ["Peluche Colita catnip 4", "Peluche Colita catnip (2)", "Peluche Colita catnip 3"]),
  P("toallas-de-entrenamiento-x30", "Toallas de entrenamiento x 30", 1155, "cuidado-cuidado-del-peludito", ["Toallas entrenamiento X30", "Toallas entrenamiento X30 - 2"]),
  // Sin fotos todavía: se crean OCULTOS para que el cliente suba la foto en /admin y los active.
  P("peluche-importado-tiburon", "Peluche importado Tiburón", 1136, "peluches-otros-peluches", [], { hidden: true }),
  P("juguete-dumbbell-l", "Juguete Dumbbell L", 1082, "juguetes-juguetes", [], { hidden: true }),
  P("juguete-dumbbell-m", "Juguete Dumbbell M", 1091, "juguetes-juguetes", [], { hidden: true }),
  P("juguete-deluxe-garrita-gatuna", "Juguete Deluxe Garrita gatuna", 1184, "gatos-juguetes-para-gato", [], { hidden: true }),
  P("juguete-deluxe-garrita-felina-catnip", "Juguete Deluxe Garrita felina", 1193, "gatos-juguetes-para-gato", [], { hidden: true }),
  P("collar-para-gatos-pescaditos", "Collar para gatos Pescaditos", 843, "gatos-collares-para-gato", [], { hidden: true, out: true }),
  P("collar-para-gatos-huellitas", "Collar para gatos Huellitas", 850, "gatos-collares-para-gato", [], { hidden: true }),
  P("collar-para-gatos-espina-tommy", "Collar para gatos Espina Tommy", 874, "gatos-collares-para-gato", [], { hidden: true }),
  P("comedero-lento-espiral", "Comedero lento Espiral", 660, "comederos-comederos-y-bebederos", [], { hidden: true }),
  P("bolsas-biodegradables", "Bolsas biodegradables para desechos", 754, "paseo-portabolsas", [], { hidden: true, label: "Presentación", variants: [["3 unidades", null], ["8 unidades", null], ["70 unidades", null]] }),
  P("correa-honey", "Correa Honey", 170, "paseo-collares-y-correas-perros", [], { hidden: true, variants: [["S", null], ["L", null, false]] }),
  P("kit-de-juego-laser", "Kit de juego Láser", 72, "gatos-juguetes-para-gato", [], { hidden: true, out: true }),
];
const NEW_CATS = [["Pelotas", "juguetes-pelotas", "juguetes", 40], ["Juguetes para gato", "gatos-juguetes-para-gato", "gatos", 40]];

/* ---------- SQL ---------- */
const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const list = (a) => a.map(q).join(", ");

export function buildSql() {
  const out = ["-- Generado por scripts/catalogo-nov.mjs a partir del catálogo de noviembre 2026. Idempotente.", "begin;", ""];
  out.push("-- Categorías nuevas");
  for (const [name, slug, parent, order] of NEW_CATS)
    out.push(`insert into public.categories (name, slug, parent_id, display_order) values (${q(name)}, ${q(slug)}, (select id from public.categories where slug = ${q(parent)}), ${order}) on conflict (slug) do nothing;`);

  out.push("", "-- Productos existentes: descripción, medidas, precios y disponibilidad");
  for (const [line, slugs] of Object.entries(EXISTING)) {
    const d = desc(+line), m = dims(+line), pr = prices(+line), st = STOCK[line];
    out.push(`-- ${DOC[line - 1]}`);
    if (d) out.push(`update public.products set description = ${q(d)}${m ? `, dimensions = ${q(m)}` : ""} where slug in (${list(slugs)});`);
    const where = `product_id in (select id from public.products where slug in (${list(slugs)}))`;
    for (const { label, price } of pr)
      out.push(label == null ? `update public.product_variants set price = ${price} where ${where};`
        : `update public.product_variants set price = ${price} where ${where} and split_part(size_label, ' (', 1) = ${q(label)};`);
    if (st === "out") out.push(`update public.product_variants set in_stock = false where ${where};`);
    else if (Array.isArray(st)) out.push(`update public.product_variants set in_stock = split_part(size_label, ' (', 1) = any(array[${list(st)}]) where ${where};`);
    else if (st !== "skip") out.push(`update public.product_variants set in_stock = true where ${where};`);
  }
  // La Sólida Azul se migró con un solo precio: le damos las mismas 3 opciones que las demás Extreme.
  out.push("", "-- Correa & Collar Extreme Sólida Azul: mismas opciones que las demás");
  [["Collar talla S", 31200, false], ["Collar talla M", 39800, false], ["Correa", 57800, true]].forEach(([l, p, s], i) =>
    out.push(`insert into public.product_variants (product_id, size_label, price, in_stock, display_order) select id, ${q(l)}, ${p}, ${s}, ${i} from public.products pr where slug = 'correa-collar-extreme-solida-azul' and not exists (select 1 from public.product_variants v where v.product_id = pr.id and v.size_label = ${q(l)});`));
  out.push(`delete from public.product_variants where size_label = '' and product_id = (select id from public.products where slug = 'correa-collar-extreme-solida-azul');`);

  out.push("", "-- Productos nuevos (los primeros aparecen arriba en la tienda; los ocultos esperan foto)");
  NEW.forEach((p, i) => {
    const d = desc(p.line) || "", m = p.dims ?? dims(p.line), base = prices(p.line);
    const variants = p.variants || (base.length && base[0].label ? base.map((x) => [x.label, x.price]) : [["", base[0]?.price ?? null]]);
    out.push(`insert into public.products (slug, name, description, dimensions, category_id, variant_label, is_active, display_order) values (${q(p.slug)}, ${q(p.name)}, ${q(d)}, ${q(m)}, (select id from public.categories where slug = ${q(p.cat)}), ${q(p.label || "Talla")}, ${!p.hidden}, ${-2000 + i * 10}) on conflict (slug) do nothing;`);
    variants.forEach(([label, price, inStock], j) =>
      out.push(`insert into public.product_variants (product_id, size_label, price, in_stock, display_order) select id, ${q(label)}, ${price ?? "null"}, ${!p.out && inStock !== false}, ${j} from public.products pr where slug = ${q(p.slug)} and not exists (select 1 from public.product_variants v where v.product_id = pr.id and v.size_label = ${q(label)});`));
    p.imgs.forEach((_, j) => {
      const url = `/imagenes/${p.slug}-${j + 1}.webp`;
      out.push(`insert into public.product_images (product_id, image_url, display_order) select id, ${q(url)}, ${j} from public.products pr where slug = ${q(p.slug)} and not exists (select 1 from public.product_images i where i.product_id = pr.id and i.image_url = ${q(url)});`);
    });
  });
  out.push("", "commit;", "");
  return out.join("\n");
}

export { NEW, EXISTING, TITLES };

if (process.argv[1]?.endsWith("catalogo-nov.mjs")) {
  const src = process.argv[2];
  if (src) for (const p of NEW) for (const [j, name] of p.imgs.entries()) await framed(join(src, `${name}.png`), `${p.slug}-${j + 1}`);
  writeFileSync(new URL("../supabase/actualizar-catalogo.sql", import.meta.url), buildSql());
  console.log(`SQL listo: ${Object.keys(EXISTING).length} fichas actualizadas, ${NEW.length} productos nuevos (${NEW.filter((p) => p.hidden).length} ocultos), ${NEW.reduce((s, p) => s + p.imgs.length, 0)} fotos.`);
}
