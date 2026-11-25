// Ejecutar: node tests/logic.test.cjs
const assert = require("assert");
require("../logic.js");
const DK = globalThis.DK;
const cat = require("../supabase/catalogo.json");

// Tallas y precios del arnés
assert.deepStrictEqual(DK.parseSizes("Tallas: XS, S, L y XL Precios: XS: $48.200 S: $57.800 L: $59.000 XL: $63.600").map((s) => s.price), [48200, 57800, 59000, 63600]);
// Aromas de la arena
assert.deepStrictEqual(DK.parsePresentations("Presentaciones: Manzana 🍎 Durazno 🍑 Contenido: 2,4 kg"), ["Manzana", "Durazno"]);
assert.strictEqual(DK.cop(57800), "$ 57.800");
assert.deepStrictEqual(DK.splitName("Arnés Honey - Rojo"), { base: "Arnés Honey", variant: "Rojo" });

// Horarios Bogotá (UTC-5): límites 10 a. m. y 1 p. m., sábado y domingo
const at = (iso) => DK.deliveryEstimate(new Date(iso));
assert.strictEqual(at("2026-11-18T14:59:00Z").window, "11 a. m. y 1 p. m."); // miércoles 9:59
assert.strictEqual(at("2026-11-18T15:00:00Z").window, "1 p. m. y 4 p. m.");  // miércoles 10:00
assert.strictEqual(at("2026-11-18T17:59:00Z").window, "1 p. m. y 4 p. m.");  // miércoles 12:59
assert.strictEqual(at("2026-11-18T18:00:00Z").when, "mañana");              // miércoles 13:00
assert.strictEqual(at("2026-11-21T18:30:00Z").when, "el lunes");            // sábado 13:30
assert.ok(at("2026-11-22T15:00:00Z").note);                                 // domingo

// Mensaje de WhatsApp (el número es editable desde el panel)
const m = DK.waMessage([{ name: "Arnés Honey - Rojo", variant: "Talla S", ref: "arnes-honey-rojo", qty: 2, price: 57800 }], "Bogotá");
assert.ok(m.text.includes("2 × $ 57.800 = $ 115.600"));
assert.strictEqual(m.subtotal, 115600);
assert.ok(m.url.startsWith("https://wa.me/573125575932?text="));
DK.WA_NUMBER = "570000000000";
assert.ok(DK.waMessage([], "Bogotá").url.startsWith("https://wa.me/570000000000?text="));

// Búsqueda con plurales y sinónimos
const P = cat.productos.map((p) => ({ ...p, _col: DK.collectionOf(p) }));
assert.ok(P.some((p) => DK.matches(p, "arena gatos")));
assert.ok(P.filter((p) => DK.matches(p, "peluches")).length >= 30);
// Todo producto cae en una categoría conocida
assert.deepStrictEqual(P.filter((p) => !DK.deptOf(p._col)).map((p) => p.id), []);
console.log("logic ok");
