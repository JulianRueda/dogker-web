// Genera supabase/seed.sql a partir del catálogo original (supabase/catalogo.json) y de los textos por defecto.
// Uso: npm run seed   → luego pega supabase/seed.sql en el SQL Editor de Supabase.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CONTENT } from "../content-defaults.js";
import "../logic.js";

const DK = globalThis.DK;

const HIGHLIGHT = ["peluche-dispensador-koala", "peluche-dispensador-perezoso", "peluche-dispensador-unicornio", "peluche-dispensador-lemur"];
const DEPT_IMG = { peluches: "peluche-leon-alargado", gatos: "arena-ecologica-de-tofu", paseo: "arnes-honey-rojo", juguetes: "juguete-sandia-en-tpr", cuidado: "cepillo-expulsapelo-360", comederos: "comedero-dinastia-verde" };
const colSlug = (dept, name) => `${dept.slug}-${DK.slugify(name)}`;

// "Precios: Collar talla S: $31.200 Correa: $57.800 Paquete de 24 huesos:" -> [{label, price|null}]
function priceList(desc) {
  const m = /Precios?:\s*([\s\S]*)$/.exec(desc);
  if (!m) return [];
  return [...m[1].matchAll(/([^:$]+?):\s*(?:\$\s?([\d.]+))?/g)].map((r) => ({ label: r[1].trim(), price: r[2] ? Number(r[2].replace(/\./g, "")) : null }));
}

export function productVariants(p) {
  const d = p.descripcion || "";
  const sizesSeg = /(Tallas?|Tamaños?):\s*([\s\S]*?)(?=\s*Precios?:|$)/.exec(d);
  const detail = Object.fromEntries([...(sizesSeg?.[2] || "").matchAll(/\b([A-Z]{1,4})\s*\(([^)]+)\)/g)].map((r) => [r[1], `${r[1]} (${r[2]})`]));
  let list = priceList(d);
  if (!list.length && sizesSeg) list = sizesSeg[2].split(/,|\sy\s/).map((s) => ({ label: s.trim(), price: null })).filter((s) => s.label);
  let label = /^Tama/.test(sizesSeg?.[1] || "") ? "Tamaño" : list.every((v) => v.label.length <= 4) ? "Talla" : "Opción";
  if (/Presentaciones?:/.test(d) && list.some((v) => v.label.length > 4)) label = "Presentación";
  if (!list.length && /Presentaciones?:/.test(d)) {
    const pres = DK.parsePresentations(d);
    if (pres.length > 1) { list = pres.map((x) => ({ label: x, price: p.precio })); label = "Aroma"; }
  }
  if (!list.length) return { label: "Talla", variants: [{ label: "", price: p.precio ?? p.precio_desde }] };
  const seen = new Set();
  return { label, variants: list.map((v) => ({ ...v, label: detail[v.label] || v.label })).filter((v) => !seen.has(v.label) && seen.add(v.label)) };
}

const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);

export function buildSeed(catalog) {
  const out = ["-- Generado por scripts/seed.mjs. Ejecutar DESPUÉS de schema.sql. Se puede re-ejecutar: no duplica datos.", "begin;", ""];
  out.push("-- Categorías");
  DK.DEPTS.forEach((d, i) => {
    out.push(`insert into public.categories (name, slug, image_url, display_order) values (${q(d.name)}, ${q(d.slug)}, ${q(`/imagenes/${DEPT_IMG[d.slug]}.jpg`)}, ${i * 10}) on conflict (slug) do nothing;`);
    d.cols.forEach((c, j) => out.push(`insert into public.categories (name, slug, parent_id, display_order) values (${q(c)}, ${q(colSlug(d, c))}, (select id from public.categories where slug = ${q(d.slug)}), ${j * 10}) on conflict (slug) do nothing;`));
  });
  out.push("", "-- Productos, tallas y fotos");
  catalog.productos.forEach((p, i) => {
    const col = DK.collectionOf(p); const dept = DK.deptOf(col);
    const { label, variants } = productVariants(p);
    out.push(`insert into public.products (slug, name, description, dimensions, category_id, variant_label, is_featured, display_order) values (${q(p.id)}, ${q(p.nombre)}, ${q(DK.cleanDesc(p.descripcion))}, ${q(DK.dimensions(p.descripcion))}, (select id from public.categories where slug = ${q(colSlug(dept, col))}), ${q(label)}, ${HIGHLIGHT.includes(p.id)}, ${i * 10}) on conflict (slug) do nothing;`);
    variants.forEach((v, j) => out.push(`insert into public.product_variants (product_id, size_label, price, display_order) select id, ${q(v.label)}, ${v.price ?? "null"}, ${j} from public.products pr where slug = ${q(p.id)} and not exists (select 1 from public.product_variants x where x.product_id = pr.id and x.size_label = ${q(v.label)});`));
    out.push(`insert into public.product_images (product_id, image_url, display_order) select id, ${q("/" + p.imagen)}, 0 from public.products pr where slug = ${q(p.id)} and not exists (select 1 from public.product_images i where i.product_id = pr.id);`);
  });
  out.push("", "-- Textos de la página");
  CONTENT.forEach(([section, key, label, value], i) => out.push(`insert into public.site_content (section_key, label, content_value, section, display_order) values (${q(key)}, ${q(label)}, ${q(value)}, ${q(section)}, ${i}) on conflict (section_key) do nothing;`));
  out.push("", "commit;", "");
  return out.join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const catalog = JSON.parse(readFileSync(new URL("../supabase/catalogo.json", import.meta.url), "utf8"));
  writeFileSync(new URL("../supabase/seed.sql", import.meta.url), buildSeed(catalog));
  console.log(`supabase/seed.sql listo: ${catalog.productos.length} productos, ${CONTENT.length} textos.`);
}
