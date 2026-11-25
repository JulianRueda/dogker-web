/* Utilidades compartidas del panel: sesión, menú, avisos, confirmaciones, fotos. */
import "../logic.js";
import { supabase, BUCKET } from "../src/supabase.js";

export { supabase };
export const DK = globalThis.DK;
export const $ = (s, el = document) => el.querySelector(s);
export const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const PATHS = {
  plus: '<path d="M5 12h14M12 5v14"/>', trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>', left: '<path d="m15 18-6-6 6-6"/>', right: '<path d="m9 18 6-6-6-6"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>', edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>', ext: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
};
export const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${PATHS[n]}</svg>`;
export const spinner = '<span class="spin" aria-hidden="true"></span>';

/* ---------- avisos (toasts) ---------- */
export function toast(msg, type = "ok") {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; box.setAttribute("aria-live", "polite"); document.body.append(box); }
  const el = document.createElement("div");
  el.className = `atoast atoast--${type}`; el.innerHTML = `${icon(type === "ok" ? "check" : "alert")}<span>${esc(msg)}</span>`;
  box.append(el); setTimeout(() => el.remove(), type === "ok" ? 3500 : 7000);
}
// Traduce errores frecuentes de Supabase a algo entendible para el cliente.
export function errMsg(e) {
  const m = e?.message || String(e);
  if (/JWT|session|not authenticated|row-level security/i.test(m)) return "Tu sesión expiró. Vuelve a ingresar.";
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sin conexión. Revisa tu internet e intenta de nuevo.";
  if (/foreign key/i.test(m)) return "No se puede borrar: hay elementos que dependen de este.";
  return m;
}

/* ---------- confirmación antes de borrar ---------- */
export function confirmDialog({ title, text, ok = "Eliminar", danger = true }) {
  return new Promise((resolve) => {
    const d = document.createElement("dialog"); d.className = "adialog";
    d.innerHTML = `<h3>${esc(title)}</h3><p class="muted">${esc(text)}</p><div class="adialog__row"><button class="abtn" value="no">Cancelar</button><button class="abtn ${danger ? "abtn--danger" : "abtn--primary"}" value="si">${esc(ok)}</button></div>`;
    document.body.append(d);
    d.querySelectorAll("button").forEach((b) => (b.onclick = () => d.close(b.value)));
    d.onclose = () => { resolve(d.returnValue === "si"); d.remove(); };
    d.showModal();
  });
}

/* ---------- sesión + menú ---------- */
// La protección real de los datos es RLS en Supabase; esta guardia solo evita mostrar el panel sin sesión.
export async function requireSession(active) {
  if (!supabase) { document.body.innerHTML = `<div class="acenter"><div class="acard"><h2>Falta configurar Supabase</h2><p class="muted">Crea el archivo <b>.env</b> a partir de <b>.env.example</b> con la URL y la anon key del proyecto.</p></div></div>`; throw new Error("sin config"); }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.replace(`/admin/login/?next=${encodeURIComponent(location.pathname + location.search)}`); throw new Error("sin sesión"); }
  supabase.auth.onAuthStateChange((ev, s) => { if (!s) location.replace("/admin/login/"); });
  const links = [["productos", "Productos"], ["categorias", "Categorías"], ["textos", "Textos de la página"]];
  document.body.insertAdjacentHTML("afterbegin", `<header class="abar"><div class="abar__in">
    <a href="/admin/productos/" class="abar__logo"><img src="/assets/logo-dogker.png" alt="Dögker" width="96" height="41"><span>Panel</span></a>
    <nav class="abar__nav">${links.map(([k, l]) => `<a href="/admin/${k}/" ${k === active ? 'aria-current="page"' : ""}>${l}</a>`).join("")}</nav>
    <div class="abar__end"><a href="/" target="_blank" rel="noopener" class="abtn abtn--ghost">${icon("ext")}<span class="hide-sm">Ver tienda</span></a>
      <button class="abtn abtn--ghost" id="logout" title="${esc(session.user.email)}">${icon("out")}<span class="hide-sm">Salir</span></button></div>
  </div></header>`);
  $("#logout").onclick = async () => { await supabase.auth.signOut(); location.replace("/admin/login/"); };
  document.body.classList.remove("booting");
  return session;
}

/* ---------- precios COP ---------- */
export const parseCOP = (s) => { const d = String(s ?? "").replace(/\D/g, ""); return d ? Number(d) : null; };
export const fmtCOP = (n) => (n == null ? "" : Math.round(n).toLocaleString("es-CO").replace(/,/g, "."));

/* ---------- fotos: validación + compresión + subida ---------- */
const MAX_IN = 15 * 1024 * 1024, MAX_OUT = 5 * 1024 * 1024, MAX_SIDE = 1600;
export async function compressImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`«${file.name}»: formato no permitido. Usa JPG, PNG o WebP.`);
  if (file.size > MAX_IN) throw new Error(`«${file.name}» pesa más de 15 MB.`);
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * s), height: Math.round(bmp.height * s) });
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); // PNG transparente -> fondo blanco
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
  if (!blob || blob.size > MAX_OUT) throw new Error(`«${file.name}» sigue pesando demasiado después de optimizarla.`);
  return blob;
}
export async function uploadImage(blob, folder) {
  const path = `${folder}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw error;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
// Borra del bucket las fotos subidas desde el panel (las del catálogo original viven en /imagenes y no se tocan).
export async function removeStored(urls) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const paths = urls.filter((u) => u?.includes(marker)).map((u) => decodeURIComponent(u.split(marker)[1]));
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
}
export async function uniqueSlug(table, name) {
  const base = DK.slugify(name) || "item";
  const { data } = await supabase.from(table).select("slug").like("slug", `${base}%`);
  const taken = new Set((data || []).map((r) => r.slug));
  let s = base, i = 2; while (taken.has(s)) s = `${base}-${i++}`;
  return s;
}
