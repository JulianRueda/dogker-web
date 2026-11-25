import { supabase, $, esc, icon, spinner, toast, errMsg, confirmDialog, requireSession, parseCOP, fmtCOP, compressImage, uploadImage, removeStored, uniqueSlug } from "../../common.js";

await requireSession("productos");
const app = $("#app");
const id = new URLSearchParams(location.search).get("id");

let prod = { name: "", description: "", dimensions: "", category_id: null, variant_label: "Talla", is_active: true, is_featured: false };
let images = [];   // { id?, url, blob?, busy? }  — el orden del arreglo es el orden en la tienda (0 = principal)
let variants = []; // { id, size_label, price, sale_price, in_stock }
let removedImages = [], cats = [], dirty = false, saving = false;
const original = { variantIds: [], imageIds: [] };

const newVariant = () => ({ id: crypto.randomUUID(), size_label: "", price: null, sale_price: null, in_stock: true });

async function load() {
  const c = await supabase.from("categories").select("id, name, parent_id, display_order");
  if (c.error) return toast(errMsg(c.error), "err");
  cats = c.data.sort((a, b) => a.display_order - b.display_order);
  if (id) {
    const { data, error } = await supabase.from("products").select("*, product_images(*), product_variants(*)").eq("id", id).single();
    if (error) { app.innerHTML = `<div class="empty-a">No encontramos este producto. <a href="/admin/productos/">Volver a la lista</a></div>`; return; }
    const { product_images: pi, product_variants: pv, ...rest } = data;
    prod = rest;
    images = pi.sort((a, b) => a.display_order - b.display_order).map((i) => ({ id: i.id, url: i.image_url }));
    variants = pv.sort((a, b) => a.display_order - b.display_order).map(({ id, size_label, price, sale_price, in_stock }) => ({ id, size_label, price, sale_price, in_stock }));
    original.variantIds = variants.map((v) => v.id); original.imageIds = images.map((i) => i.id);
  }
  if (!variants.length) variants.push(newVariant());
  render();
}

function catOptions() {
  const tops = cats.filter((c) => !c.parent_id);
  return `<option value="">Sin categoría</option>` + tops.map((t) => {
    const kids = cats.filter((c) => c.parent_id === t.id);
    return kids.length ? `<optgroup label="${esc(t.name)}">${kids.map((k) => `<option value="${k.id}" ${prod.category_id === k.id ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</optgroup>`
      : `<option value="${t.id}" ${prod.category_id === t.id ? "selected" : ""}>${esc(t.name)}</option>`;
  }).join("");
}

function render() {
  document.title = `${id ? prod.name || "Producto" : "Nuevo producto"} · Panel Dögker`;
  app.innerHTML = `
    <a href="/admin/productos/" class="abtn abtn--ghost" style="margin-left:-12px">${icon("left")}Productos</a>
    <div class="ahead"><div><h1>${id ? esc(prod.name) : "Nuevo producto"}</h1>${prod.slug ? `<p class="muted">Ref. ${esc(prod.slug)} · <a href="/#/p/${esc(prod.slug)}" target="_blank" rel="noopener">ver en la tienda</a></p>` : ""}</div></div>

    <section class="acard"><h2>Información</h2>
      <label class="field"><span>Nombre del producto *</span><input id="name" value="${esc(prod.name)}" maxlength="140" required>
        <small>Para agrupar colores en una sola ficha usa «Nombre - Color», por ejemplo «Arnés Honey - Rojo».</small></label>
      <label class="field"><span>Descripción</span><textarea id="description" rows="5">${esc(prod.description)}</textarea></label>
      <div class="grid2">
        <label class="field"><span>Categoría</span><select id="category_id">${catOptions()}</select></label>
        <label class="field"><span>Medidas (opcional)</span><input id="dimensions" value="${esc(prod.dimensions)}" placeholder="Ej. 23 × 27 cm"></label>
      </div>
      <label class="switch"><input type="checkbox" id="is_active" ${prod.is_active ? "checked" : ""}><span><b>Visible en la tienda</b><span class="hint">Desmárcalo para ocultarlo sin borrarlo.</span></span></label>
      <label class="switch"><input type="checkbox" id="is_featured" ${prod.is_featured ? "checked" : ""}><span><b>Destacado en el inicio</b><span class="hint">Aparece en la sección de destacados de la página principal.</span></span></label>
    </section>

    <section class="acard"><h2>Fotos</h2><p class="hint">La primera foto es la principal. Usa las flechas para reordenar. Se optimizan automáticamente (máx. 1600 px).</p>
      <div class="photos" id="photos">${images.map((im, i) => `
        <div class="photo ${i === 0 ? "main" : ""} ${im.busy ? "busy" : ""}">
          <img src="${esc(im.url)}" alt="Foto ${i + 1}">
          ${i === 0 ? '<span class="photo__badge">Principal</span>' : ""}${im.blob ? '<span class="photo__new">Sin guardar</span>' : ""}
          <div class="photo__bar"><button type="button" data-img-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Mover a la izquierda">${icon("left")}</button>
            <button type="button" data-img-del="${i}" aria-label="Quitar foto">${icon("trash")}</button>
            <button type="button" data-img-move="${i}" data-dir="1" ${i === images.length - 1 ? "disabled" : ""} aria-label="Mover a la derecha">${icon("right")}</button></div>
        </div>`).join("")}
        <label class="drop" id="drop">${icon("plus")}Subir fotos<span class="hint">JPG, PNG o WebP<br>o arrástralas aquí</span><input type="file" id="files" accept="image/jpeg,image/png,image/webp" multiple></label>
      </div>
    </section>

    <section class="acard"><h2>Tallas y precios</h2>
      <p class="hint">Agrega una fila por cada talla u opción. Si el producto tiene un solo precio, deja una fila con el nombre vacío (talla única).</p>
      <label class="field" style="max-width:320px"><span>¿Cómo se llama la opción?</span><input id="variant_label" list="vlabels" value="${esc(prod.variant_label)}"><datalist id="vlabels"><option>Talla</option><option>Tamaño</option><option>Aroma</option><option>Presentación</option><option>Opción</option></datalist></label>
      <div class="vhead"><span>${esc(prod.variant_label || "Talla")}</span><span>Precio (COP)</span><span>Precio oferta (opcional)</span><span>Disponible</span><span></span></div>
      <div id="vrows">${variants.map((v, i) => `
        <div class="vrow">
          <input class="input" data-v="${i}" data-k="size_label" value="${esc(v.size_label)}" placeholder="Ej. S, M, L — vacío = única" aria-label="${esc(prod.variant_label)}">
          <div class="money" data-l="Precio"><input class="input" data-v="${i}" data-k="price" inputmode="numeric" value="${fmtCOP(v.price)}" placeholder="50.000" aria-label="Precio"></div>
          <div class="money" data-l="Oferta"><input class="input" data-v="${i}" data-k="sale_price" inputmode="numeric" value="${fmtCOP(v.sale_price)}" placeholder="—" aria-label="Precio de oferta"></div>
          <label class="stock"><input type="checkbox" data-v="${i}" data-k="in_stock" ${v.in_stock ? "checked" : ""}>Hay stock</label>
          <div class="acts"><button type="button" class="abtn abtn--ghost abtn--icon" data-vmove="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Subir">${icon("up")}</button><button type="button" class="abtn abtn--ghost abtn--icon" data-vmove="${i}" data-dir="1" ${i === variants.length - 1 ? "disabled" : ""} aria-label="Bajar">${icon("down")}</button><button type="button" class="abtn abtn--ghost abtn--icon" data-vdel="${i}" ${variants.length === 1 ? "disabled" : ""} aria-label="Quitar fila">${icon("trash")}</button></div>
        </div>`).join("")}</div>
      <button type="button" class="abtn" id="addV" style="margin-top:12px">${icon("plus")}Agregar talla</button>
    </section>

    ${id ? `<section class="acard"><h2>Zona de peligro</h2><p class="hint">Eliminar borra el producto, sus fotos y tallas para siempre.</p><button type="button" class="abtn abtn--danger" id="delP" style="margin-top:12px">${icon("trash")}Eliminar producto</button></section>` : ""}

    <div class="savebar"><div class="savebar__in"><span class="hint" id="state">${dirty ? "Tienes cambios sin guardar." : ""}</span>
      <a class="abtn" href="/admin/productos/">Cancelar</a>
      <button class="abtn abtn--primary" id="save" ${saving ? "disabled" : ""}>${saving ? `${spinner} Guardando…` : `${icon("check")}Guardar`}</button></div></div>`;
  wire();
}

const touch = () => { dirty = true; const s = $("#state"); if (s) s.textContent = "Tienes cambios sin guardar."; };

function wire() {
  ["name", "description", "dimensions", "variant_label"].forEach((k) => ($("#" + k).oninput = (e) => { prod[k] = e.target.value; touch(); }));
  $("#variant_label").onchange = render;
  $("#category_id").onchange = (e) => { prod.category_id = e.target.value || null; touch(); };
  ["is_active", "is_featured"].forEach((k) => ($("#" + k).onchange = (e) => { prod[k] = e.target.checked; touch(); }));

  app.querySelectorAll("[data-v]").forEach((el) => {
    const v = variants[+el.dataset.v], k = el.dataset.k;
    if (k === "in_stock") el.onchange = () => { v.in_stock = el.checked; touch(); };
    else if (k === "size_label") el.oninput = () => { v.size_label = el.value; touch(); };
    else { el.oninput = () => { v[k] = parseCOP(el.value); touch(); }; el.onblur = () => (el.value = fmtCOP(v[k])); }
  });
  $("#addV").onclick = () => { variants.push(newVariant()); touch(); render(); app.querySelector(`[data-v="${variants.length - 1}"]`).focus(); };
  app.querySelectorAll("[data-vdel]").forEach((b) => (b.onclick = () => { variants.splice(+b.dataset.vdel, 1); touch(); render(); }));
  app.querySelectorAll("[data-vmove]").forEach((b) => (b.onclick = () => { swap(variants, +b.dataset.vmove, +b.dataset.dir); touch(); render(); }));

  app.querySelectorAll("[data-img-move]").forEach((b) => (b.onclick = () => { swap(images, +b.dataset.imgMove, +b.dataset.dir); touch(); render(); }));
  app.querySelectorAll("[data-img-del]").forEach((b) => (b.onclick = () => { const [im] = images.splice(+b.dataset.imgDel, 1); if (im.id) removedImages.push(im); touch(); render(); }));
  $("#files").onchange = (e) => addFiles(e.target.files);
  const drop = $("#drop");
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); };

  $("#save").onclick = save;
  const del = $("#delP"); if (del) del.onclick = remove;
}
const swap = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };

// Vista previa inmediata; se comprime en el navegador y se sube solo al pulsar Guardar.
async function addFiles(fileList) {
  for (const file of fileList) {
    const im = { url: URL.createObjectURL(file), busy: true }; images.push(im); render();
    try { im.blob = await compressImage(file); URL.revokeObjectURL(im.url); im.url = URL.createObjectURL(im.blob); touch(); }
    catch (e) { images.splice(images.indexOf(im), 1); toast(e.message, "err"); }
    im.busy = false; render();
  }
}

function validate() {
  if (!prod.name.trim()) return "Escribe el nombre del producto.";
  if (images.some((i) => i.busy)) return "Espera a que terminen de optimizarse las fotos.";
  const labels = variants.map((v) => v.size_label.trim().toLowerCase());
  if (new Set(labels).size !== labels.length) return "Hay tallas repetidas. Cada fila debe tener un nombre distinto.";
  if (variants.length > 1 && labels.includes("")) return "Si hay varias tallas, todas deben tener nombre.";
  const bad = variants.find((v) => v.sale_price != null && (v.price == null || v.sale_price >= v.price));
  if (bad) return `El precio de oferta de «${bad.size_label || "talla única"}» debe ser menor que el precio normal.`;
  return null;
}

async function save() {
  const problem = validate(); if (problem) return toast(problem, "err");
  saving = true; render();
  try {
    const row = { name: prod.name.trim(), description: prod.description.trim(), dimensions: prod.dimensions?.trim() || null, category_id: prod.category_id, variant_label: prod.variant_label.trim() || "Talla", is_active: prod.is_active, is_featured: prod.is_featured };
    let pid = id;
    if (!pid) {
      // Los nuevos aparecen primero en la tienda.
      const { data: first } = await supabase.from("products").select("display_order").order("display_order").limit(1);
      const ins = await supabase.from("products").insert({ ...row, slug: await uniqueSlug("products", row.name), display_order: (first?.[0]?.display_order ?? 10) - 10 }).select().single();
      if (ins.error) throw ins.error;
      pid = ins.data.id; prod = { ...prod, ...ins.data };
    } else {
      const up = await supabase.from("products").update(row).eq("id", pid);
      if (up.error) throw up.error;
    }

    // 1) Subir fotos nuevas, 2) guardar filas y orden, 3) recién ahí borrar las quitadas (nunca se pierde una foto por un error a mitad de camino).
    for (const im of images.filter((i) => i.blob)) { im.url = await uploadImage(im.blob, pid); delete im.blob; im.id = crypto.randomUUID(); }
    if (images.length) {
      const r = await supabase.from("product_images").upsert(images.map((im, i) => ({ id: im.id, product_id: pid, image_url: im.url, display_order: i })));
      if (r.error) throw r.error;
    }
    const goneImgs = original.imageIds.filter((x) => !images.some((im) => im.id === x));
    if (goneImgs.length) { const r = await supabase.from("product_images").delete().in("id", goneImgs); if (r.error) throw r.error; await removeStored(removedImages.map((i) => i.url)).catch(() => {}); }

    const vr = await supabase.from("product_variants").upsert(variants.map((v, i) => ({ id: v.id, product_id: pid, size_label: v.size_label.trim(), price: v.price, sale_price: v.sale_price, in_stock: v.in_stock, display_order: i })));
    if (vr.error) throw vr.error;
    const goneVars = original.variantIds.filter((x) => !variants.some((v) => v.id === x));
    if (goneVars.length) { const r = await supabase.from("product_variants").delete().in("id", goneVars); if (r.error) throw r.error; }

    original.imageIds = images.map((i) => i.id); original.variantIds = variants.map((v) => v.id); removedImages = [];
    dirty = false; toast("Producto guardado. Ya se ve en la tienda.");
    if (!id) { location.replace(`/admin/productos/editar/?id=${pid}&creado=1`); return; }
  } catch (e) { toast("No se pudo guardar: " + errMsg(e), "err"); }
  saving = false; render();
}

async function remove() {
  const ok = await confirmDialog({ title: `¿Eliminar «${prod.name}»?`, text: "Se borrarán también sus fotos y tallas. Esta acción no se puede deshacer." });
  if (!ok) return;
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return toast(errMsg(error), "err");
  await removeStored(images.map((i) => i.url)).catch(() => {});
  dirty = false; location.replace("/admin/productos/");
}

addEventListener("beforeunload", (e) => { if (dirty) e.preventDefault(); });
await load();
if (new URLSearchParams(location.search).has("creado")) toast("Producto creado. Ya se ve en la tienda.");
