// Ejecutar: node tests/seed.test.mjs — verifica que la migración del catálogo a tallas+precios sea correcta.
import assert from "node:assert";
import { readFileSync } from "node:fs";
import { productVariants, buildSeed } from "../scripts/seed.mjs";

const cat = JSON.parse(readFileSync(new URL("../supabase/catalogo.json", import.meta.url), "utf8"));
const by = Object.fromEntries(cat.productos.map((p) => [p.id, p]));
const v = (id) => productVariants(by[id]);

assert.deepStrictEqual(v("arnes-honey-rojo").variants.map((x) => [x.label, x.price]), [["XS", 48200], ["S", 57800], ["L", 59000], ["XL", 63600]]);
assert.strictEqual(v("arnes-honey-rojo").label, "Talla");
assert.strictEqual(v("transportador-rel-azul").label, "Tamaño");
assert.deepStrictEqual(v("transportador-rel-azul").variants.map((x) => x.label), ["S (44 x 20 x 27 cm)", "L (56 x 26 x 33 cm)"]);
assert.deepStrictEqual(v("correa-collar-extreme-rojo").variants.map((x) => [x.label, x.price]), [["Collar talla S", 31200], ["Collar talla M", 39800], ["Correa", 57800]]);
assert.deepStrictEqual(v("arena-ecologica-de-tofu"), { label: "Aroma", variants: [{ label: "Manzana", price: 29900 }, { label: "Durazno", price: 29900 }] });
assert.deepStrictEqual(v("huesos-magic-bones").variants.map((x) => x.price), [13200, null]);
assert.deepStrictEqual(v("collar-kronox-azul").variants.map((x) => [x.label, x.price]), [["M", null], ["L", null]]);
assert.deepStrictEqual(v("peluche-mister-aguila").variants, [{ label: "", price: 67400 }]);

// Todo producto tiene al menos una talla, sin etiquetas repetidas, y los precios son enteros >= 0 o null.
for (const p of cat.productos) {
  const { variants } = productVariants(p);
  assert.ok(variants.length >= 1, p.id);
  assert.strictEqual(new Set(variants.map((x) => x.label)).size, variants.length, p.id);
  assert.ok(variants.every((x) => x.price === null || (Number.isInteger(x.price) && x.price >= 0)), p.id);
}

const sql = buildSeed(cat);
assert.strictEqual((sql.match(/insert into public\.products /g) || []).length, 123);
assert.ok(!/undefined|NaN/.test(sql));
console.log("seed ok");
