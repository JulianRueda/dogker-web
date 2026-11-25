import { supabase, $, esc, icon, toast, errMsg, confirmDialog, requireSession, removeStored, DK } from "../common.js";

await requireSession("productos");
const app = $("#app");
let list = [], cats = [], q = "", catF = "";

const byOrder = (a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at);

async function load() {
  const [p, c] = await Promise.all([
    supabase.from("products").select("id, slug, name, is_active, is_featured, display_order, created_at, category_id, product_images(image_url, display_order), product_variants(price, sale_price, in_stock)"),
    supabase.from("categories").select("id, name, parent_id, display_order"),
  ]);
  if (p.error || c.error) return toast(errMsg(p.error || c.error), "err");
  list = p.data.sort(byOrder); cats = c.data;
  render();
}

const catName = (id) => cats.find((c) => c.id === id)?.name || "Sin categoría";
function priceText(p) {
  const v = p.product_variants.map((x) => x.sale_price ?? x.price).filter((x) => x != null);
  if (!v.length) return "Sin precio";
  const min = Math.min(...v); return (new Set(v).size > 1 ? "Desde " : "") + DK.cop(min);
}
const firstImg = (p) => [...p.product_images].sort((a, b) => a.display_order - b.display_order)[0]?.image_url;

function render() {
  const filtered = list.filter((p) => (!q || DK.norm(p.name + " " + p.slug).includes(DK.norm(q))) && (!catF || p.category_id === catF || cats.find((c) => c.id === p.category_id)?.parent_id === catF));
  const canSort = !q && !catF;
  const tops = cats.filter((c) => !c.parent_id).sort((a, b) => a.display_order - b.display_order);
  app.innerHTML = `
    <div class="ahead"><div><h1>Productos</h1><p class="muted">${list.length} productos · ${list.filter((p) => !p.is_active).length} ocultos</p></div>
      <a class="abtn abtn--primary" href="/admin/productos/editar/">${icon("plus")}Nuevo producto</a></div>
    <div class="afilters">
      <input class="input" type="search" id="q" placeholder="Buscar por nombre o Ref." value="${esc(q)}" aria-label="Buscar">
      <select class="input" id="cat" aria-label="Filtrar por categoría"><option value="">Todas las categorías</option>
        ${tops.map((t) => `<option value="${t.id}" ${catF === t.id ? "selected" : ""}>${esc(t.name)}</option>${cats.filter((c) => c.parent_id === t.id).sort((a, b) => a.display_order - b.display_order).map((c) => `<option value="${c.id}" ${catF === c.id ? "selected" : ""}>  · ${esc(c.name)}</option>`).join("")}`).join("")}
      </select>
    </div>
    ${canSort ? `<p class="hint" style="margin:-6px 0 12px">Usa las flechas ${icon("up")}${icon("down")} para cambiar el orden en que aparecen en la tienda.</p>` : `<p class="hint" style="margin:-6px 0 12px">Quita la búsqueda y el filtro para poder reordenar.</p>`}
    <div class="plist">${filtered.length ? filtered.map((p) => {
      const agot = p.product_variants.length && p.product_variants.every((v) => !v.in_stock);
      const sale = p.product_variants.some((v) => v.sale_price != null);
      const img = firstImg(p); const i = list.indexOf(p);
      return `<div class="prow ${p.is_active ? "" : "off"}">
        ${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="noimg">${icon("img")}</span>`}
        <div><a class="prow__name" href="/admin/productos/editar/?id=${p.id}">${esc(p.name)}</a>
          <div class="prow__meta"><span>${esc(catName(p.category_id))}</span><b>${priceText(p)}</b>
            ${p.is_active ? "" : '<span class="tag tag--muted">Oculto</span>'}${agot ? '<span class="tag tag--ink">Agotado</span>' : ""}${sale ? '<span class="tag">Oferta</span>' : ""}${p.is_featured ? '<span class="tag">Destacado</span>' : ""}</div></div>
        <div class="prow__act">
          ${canSort ? `<button class="abtn abtn--ghost abtn--icon" data-move="${i}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Subir">${icon("up")}</button><button class="abtn abtn--ghost abtn--icon" data-move="${i}" data-dir="1" ${i === list.length - 1 ? "disabled" : ""} aria-label="Bajar">${icon("down")}</button>` : ""}
          <button class="abtn abtn--ghost abtn--icon ${p.is_featured ? "on" : ""}" data-feat="${p.id}" title="${p.is_featured ? "Quitar de destacados" : "Destacar en el inicio"}" aria-pressed="${p.is_featured}">${icon("star")}</button>
          <label class="switch" style="padding:0 6px" title="Visible en la tienda"><input type="checkbox" data-active="${p.id}" ${p.is_active ? "checked" : ""}><span class="hint">Visible</span></label>
          <a class="abtn abtn--ghost abtn--icon" href="/admin/productos/editar/?id=${p.id}" aria-label="Editar">${icon("edit")}</a>
          <button class="abtn abtn--ghost abtn--icon" data-del="${p.id}" aria-label="Eliminar">${icon("trash")}</button>
        </div></div>`;
    }).join("") : `<div class="empty-a">No hay productos que coincidan.</div>`}</div>`;

  const qi = $("#q"); qi.oninput = () => { q = qi.value; render(); const n = $("#q"); n.focus(); n.setSelectionRange(q.length, q.length); };
  $("#cat").onchange = (e) => { catF = e.target.value; render(); };
  app.querySelectorAll("[data-active]").forEach((el) => (el.onchange = () => patch(el.dataset.active, { is_active: el.checked }, el.checked ? "Producto visible en la tienda." : "Producto oculto de la tienda.")));
  app.querySelectorAll("[data-feat]").forEach((el) => (el.onclick = () => { const p = list.find((x) => x.id === el.dataset.feat); patch(p.id, { is_featured: !p.is_featured }, p.is_featured ? "Quitado de destacados." : "Ahora aparece en Destacados del inicio."); }));
  app.querySelectorAll("[data-move]").forEach((el) => (el.onclick = () => move(+el.dataset.move, +el.dataset.dir)));
  app.querySelectorAll("[data-del]").forEach((el) => (el.onclick = () => del(list.find((x) => x.id === el.dataset.del))));
}

async function patch(id, values, okMsg) {
  const { error } = await supabase.from("products").update(values).eq("id", id);
  if (error) { toast(errMsg(error), "err"); return load(); }
  Object.assign(list.find((p) => p.id === id), values); render(); toast(okMsg);
}

async function move(i, dir) {
  const a = list[i], b = list[i + dir]; if (!b) return;
  // Si tienen el mismo número de orden, basta con mover uno; si no, se intercambian.
  const [oa, ob] = a.display_order === b.display_order ? [b.display_order + dir, b.display_order] : [b.display_order, a.display_order];
  const [r1, r2] = await Promise.all([
    supabase.from("products").update({ display_order: oa }).eq("id", a.id),
    supabase.from("products").update({ display_order: ob }).eq("id", b.id),
  ]);
  if (r1.error || r2.error) return toast(errMsg(r1.error || r2.error), "err");
  a.display_order = oa; b.display_order = ob; list.sort(byOrder); render();
}

async function del(p) {
  const ok = await confirmDialog({ title: `¿Eliminar «${p.name}»?`, text: "Se borrarán también sus fotos y tallas. Esta acción no se puede deshacer. Si solo quieres ocultarlo, desmarca «Visible»." });
  if (!ok) return;
  const { error } = await supabase.from("products").delete().eq("id", p.id);
  if (error) return toast(errMsg(error), "err");
  await removeStored(p.product_images.map((i) => i.image_url)).catch(() => {}); // fotos huérfanas: no bloquean el borrado
  list = list.filter((x) => x !== p); render(); toast("Producto eliminado.");
}

load();
