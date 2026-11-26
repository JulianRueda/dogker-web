import { DK, supabase, $, esc, icon, spinner, toast, errMsg, confirmDialog, requireSession, compressImage, uploadImage, removeStored, uniqueSlug } from "../common.js";

await requireSession("categorias");
const app = $("#app");
let cats = [], counts = {}, editing = null; // editing: { id?, name, parent_id, image_url, blob? }

const byOrder = (a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at);
const tops = () => cats.filter((c) => !c.parent_id).sort(byOrder);
const kids = (id) => cats.filter((c) => c.parent_id === id).sort(byOrder);

async function load() {
  const [c, p] = await Promise.all([supabase.from("categories").select("*"), supabase.from("products").select("category_id")]);
  if (c.error || p.error) return toast(errMsg(c.error || p.error), "err");
  cats = c.data; counts = {};
  p.data.forEach((r) => (counts[r.category_id] = (counts[r.category_id] || 0) + 1));
  render();
}

function row(c, child, siblings) {
  const i = siblings.indexOf(c); const n = counts[c.id] || 0;
  return `<div class="crow ${child ? "child" : ""}">
    ${child ? "" : c.image_url ? `<img src="${esc(DK.pic(c.image_url, 1))}" alt="">` : `<span class="noimg"></span>`}
    <div><b>${esc(c.name)}</b><div class="hint">${child ? `${n} producto${n === 1 ? "" : "s"}` : `En el menú · ${kids(c.id).length} subcategorías`}</div></div>
    <div class="prow__act">
      <button class="abtn abtn--ghost abtn--icon" data-move="${c.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Subir">${icon("up")}</button>
      <button class="abtn abtn--ghost abtn--icon" data-move="${c.id}" data-dir="1" ${i === siblings.length - 1 ? "disabled" : ""} aria-label="Bajar">${icon("down")}</button>
      <button class="abtn abtn--ghost abtn--icon" data-edit="${c.id}" aria-label="Editar">${icon("edit")}</button>
      <button class="abtn abtn--ghost abtn--icon" data-del="${c.id}" aria-label="Eliminar">${icon("trash")}</button>
    </div></div>`;
}

function form() {
  const e = editing; const isTop = !e.parent_id;
  return `<section class="acard" id="form"><h2>${e.id ? "Editar categoría" : "Nueva categoría"}</h2>
    <div class="grid2">
      <label class="field"><span>Nombre *</span><input id="cname" value="${esc(e.name)}" maxlength="60"></label>
      <label class="field"><span>Ubicación</span><select id="cparent"><option value="">En el menú principal</option>${tops().filter((t) => t.id !== e.id).map((t) => `<option value="${t.id}" ${e.parent_id === t.id ? "selected" : ""}>Dentro de «${esc(t.name)}»</option>`).join("")}</select>
        <small>Las del menú principal agrupan subcategorías (colecciones).</small></label>
    </div>
    ${isTop ? `<div class="field"><span>Foto redonda (inicio)</span><div style="display:flex;gap:12px;align-items:center">
      ${e.image_url ? `<img src="${esc(DK.pic(e.image_url, 1))}" alt="" style="width:72px;height:72px;border-radius:99px;object-fit:cover">` : ""}
      <label class="abtn">${icon("img")}${e.image_url ? "Cambiar foto" : "Subir foto"}<input type="file" id="cimg" accept="image/jpeg,image/png,image/webp" hidden></label></div></div>` : ""}
    <div class="adialog__row"><button class="abtn" id="ccancel">Cancelar</button><button class="abtn abtn--primary" id="csave">${icon("check")}Guardar categoría</button></div>
  </section>`;
}

function render() {
  app.innerHTML = `<div class="ahead"><div><h1>Categorías</h1><p class="muted">Organizan el menú de la tienda y los filtros del catálogo.</p></div>
    <button class="abtn abtn--primary" id="new">${icon("plus")}Nueva categoría</button></div>
    ${editing ? form() : ""}
    <section class="acard">${tops().map((t) => row(t, false, tops()) + kids(t.id).map((k) => row(k, true, kids(t.id))).join("")).join("") || '<div class="empty-a">Aún no hay categorías.</div>'}</section>`;
  $("#new").onclick = () => { editing = { name: "", parent_id: null, image_url: null }; render(); $("#cname").focus(); };
  app.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => { editing = { ...cats.find((c) => c.id === b.dataset.edit) }; render(); scrollTo(0, 0); }));
  app.querySelectorAll("[data-move]").forEach((b) => (b.onclick = () => move(b.dataset.move, +b.dataset.dir)));
  app.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => del(cats.find((c) => c.id === b.dataset.del))));
  if (!editing) return;
  $("#cname").oninput = (e) => (editing.name = e.target.value);
  $("#cparent").onchange = (e) => { editing.parent_id = e.target.value || null; render(); };
  const f = $("#cimg"); if (f) f.onchange = async () => {
    try { editing.blob = await compressImage(f.files[0]); editing.image_url = URL.createObjectURL(editing.blob); render(); } catch (e) { toast(e.message, "err"); }
  };
  $("#ccancel").onclick = () => { editing = null; render(); };
  $("#csave").onclick = save;
}

async function save() {
  const e = editing; const name = e.name.trim();
  if (!name) return toast("Escribe el nombre de la categoría.", "err");
  if (e.id && e.parent_id && kids(e.id).length) return toast("Esta categoría tiene subcategorías; no puede quedar dentro de otra.", "err");
  const btn = $("#csave"); btn.disabled = true; btn.innerHTML = `${spinner} Guardando…`;
  try {
    const prev = cats.find((c) => c.id === e.id);
    let image_url = e.parent_id ? null : e.image_url;
    if (e.blob) image_url = await uploadImage(e.blob, "categorias");
    const row = { name, parent_id: e.parent_id, image_url };
    const siblings = cats.filter((c) => c.parent_id === e.parent_id);
    const r = e.id ? await supabase.from("categories").update(row).eq("id", e.id)
      : await supabase.from("categories").insert({ ...row, slug: await uniqueSlug("categories", name), display_order: Math.max(0, ...siblings.map((c) => c.display_order)) + 10 });
    if (r.error) throw r.error;
    if (prev?.image_url && prev.image_url !== image_url) await removeStored([prev.image_url]).catch(() => {});
    editing = null; toast("Categoría guardada."); await load();
  } catch (err) { toast("No se pudo guardar: " + errMsg(err), "err"); btn.disabled = false; btn.innerHTML = "Guardar categoría"; }
}

async function move(cid, dir) {
  const c = cats.find((x) => x.id === cid); const sib = cats.filter((x) => x.parent_id === c.parent_id).sort(byOrder);
  const o = sib[sib.indexOf(c) + dir]; if (!o) return;
  const [oc, oo] = c.display_order === o.display_order ? [o.display_order + dir, o.display_order] : [o.display_order, c.display_order];
  const [a, b] = await Promise.all([supabase.from("categories").update({ display_order: oc }).eq("id", c.id), supabase.from("categories").update({ display_order: oo }).eq("id", o.id)]);
  if (a.error || b.error) return toast(errMsg(a.error || b.error), "err");
  c.display_order = oc; o.display_order = oo; render();
}

async function del(c) {
  if (kids(c.id).length) return toast("Primero mueve o elimina sus subcategorías.", "err");
  const n = counts[c.id] || 0;
  const ok = await confirmDialog({ title: `¿Eliminar «${c.name}»?`, text: n ? `${n} producto${n === 1 ? "" : "s"} quedará${n === 1 ? "" : "n"} sin categoría (no se borran). Esta acción no se puede deshacer.` : "Esta acción no se puede deshacer." });
  if (!ok) return;
  const { error } = await supabase.from("categories").delete().eq("id", c.id);
  if (error) return toast(errMsg(error), "err");
  await removeStored([c.image_url]).catch(() => {});
  toast("Categoría eliminada."); load();
}

load();
