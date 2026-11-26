// Verifica el parser del catálogo de noviembre y la coherencia del SQL generado.
import assert from "node:assert";
import { readdirSync } from "node:fs";
import { prices, buildSql, NEW, EXISTING, TITLES } from "../scripts/catalogo-nov.mjs";

assert.deepStrictEqual(prices(160), [{ label: "XS", price: 48200 }, { label: "S", price: 57800 }, { label: "L", price: 59000 }, { label: "XL", price: 63600 }]); // Arnés Honey
assert.deepStrictEqual(prices(638).map((x) => x.price), [13200, 69700]); // Magic Bones (con "$ 69.700")
assert.deepStrictEqual(prices(913).map((x) => x.label), ["Collar talla S", "Collar talla M", "Correa"]);
assert.deepStrictEqual(prices(981), [{ label: null, price: 22200 }]); // "Precios: $22.200" sin etiqueta
assert.deepStrictEqual(prices(42), [{ label: null, price: 40700 }]);
assert.deepStrictEqual(prices(32), []); // Kronox sin precio

for (const line of [...Object.keys(EXISTING).map(Number), ...NEW.map((p) => p.line)]) assert.ok(TITLES.includes(line), `línea ${line} no es un título`);
assert.strictEqual(new Set(NEW.map((p) => p.slug)).size, NEW.length);
NEW.filter((p) => !p.hidden).forEach((p) => assert.ok(p.imgs.length, `${p.slug} visible sin fotos`));

const sql = buildSql();
assert.ok(!/undefined|NaN/.test(sql));
assert.ok(sql.includes("'pelota-maciza-volley-mediana-azul'") && sql.includes("22200"));
// Cada foto referenciada existe en public/imagenes (se generan con el script).
const files = new Set(readdirSync(new URL("../public/imagenes/", import.meta.url)));
for (const [, url] of sql.matchAll(/'\/imagenes\/([^']+)'/g)) assert.ok(files.has(url), `falta ${url}`);
console.log("catalogo ok");
