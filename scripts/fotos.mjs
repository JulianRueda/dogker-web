// Utilidades de fotos del catálogo. Formato único: 1080×1080 WebP + miniatura 540 px (`-540.webp`).
// Uso directo: node scripts/fotos.mjs  → convierte a WebP todo .jpg/.png que quede en public/imagenes y borra el original.
import sharp from "sharp";
import { readdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);
export const IMG_DIR = fileURLToPath(new URL("public/imagenes/", ROOT));
const FRAME = fileURLToPath(new URL("scripts/assets/marco.png", ROOT));
const BOX = 780; // lado máximo del producto dentro del marco (zona blanca ≈ 860 px)

export async function writePair(input, base) {
  const img = sharp(input).flatten({ background: "#ffffff" });
  await img.clone().resize(1080, 1080, { fit: "cover" }).webp({ quality: 80, effort: 5 }).toFile(`${IMG_DIR}${base}.webp`);
  await img.clone().resize(540, 540, { fit: "cover" }).webp({ quality: 78, effort: 5 }).toFile(`${IMG_DIR}${base}-540.webp`);
}

// Foto nueva de estudio (fondo blanco, cualquier proporción) -> producto recortado y centrado sobre el marco de la marca.
export async function framed(file, base) {
  const product = await sharp(file).flatten({ background: "#ffffff" }).trim({ background: "#ffffff", threshold: 18 })
    .resize(BOX, BOX, { fit: "inside" }).toBuffer();
  const { width, height } = await sharp(product).metadata();
  const composed = await sharp(FRAME).composite([{ input: product, left: Math.round(540 - width / 2), top: Math.round(540 - height / 2) }]).png().toBuffer();
  await writePair(composed, base);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const todo = readdirSync(IMG_DIR).filter((f) => /\.(jpe?g|png)$/i.test(f));
  for (const f of todo) { await writePair(IMG_DIR + f, f.replace(/\.\w+$/, "")); unlinkSync(IMG_DIR + f); }
  console.log(`${todo.length} fotos convertidas a WebP.`);
}
