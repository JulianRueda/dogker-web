/* Dögker — tienda: catálogo, fichas, Mi pedido y salida a WhatsApp. Datos y textos vienen de Supabase. */
import "./logic.js";
import { supabase } from "./src/supabase.js";
import { DEFAULTS } from "./content-defaults.js";

const DK = window.DK;
const { slugify, cop, splitName, cleanDesc, swatchOf, matches, deliveryEstimate, waMessage } = DK;

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => (s ?? "").toString().replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const icon = (id, cls = "ic") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const main = $("#main");
let P = [], BY = {}, GROUPS = {}, DEPTS = [];

/* ---------- textos editables (con respaldo al texto original) ---------- */
let TXT = { ...DEFAULTS };
const t = (k) => TXT[k] || DEFAULTS[k] || "";
const lines = (k) => t(k).split("\n").map((s) => s.trim()).filter(Boolean);
function paintStatic() {
  document.querySelectorAll("[data-c]").forEach((el) => (el.textContent = t(el.dataset.c)));
  $("#footWa").href = `https://wa.me/${t("whatsapp_number")}`;
  const ig = $("#footIg"); ig.href = `https://www.instagram.com/${t("instagram_user")}/`; ig.textContent = "@" + t("instagram_user");
  DK.WA_NUMBER = t("whatsapp_number");
}
paintStatic();

const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* modo privado: el pedido vive solo en memoria */ } },
};
let cart = store.get("dogker-pedido", []);
let dest = store.get("dogker-destino", "Bogotá");

const byOrder = (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0);

// Fila de Supabase -> forma que usa la tienda.
function toProduct(row, catById) {
  const col = catById[row.category_id];
  const top = col && col.parent_id ? catById[col.parent_id] : col;
  const variants = [...(row.product_variants || [])].sort(byOrder).map((v) => ({
    size: v.size_label || "", price: v.sale_price ?? v.price, old: v.sale_price != null ? v.price : null, inStock: v.in_stock,
  }));
  const images = [...(row.product_images || [])].sort(byOrder).map((i) => i.image_url);
  const { base, variant } = splitName(row.name);
  return {
    id: row.slug, nombre: row.name, descripcion: row.description || "", dim: row.dimensions || null,
    imagen: images[0] || "/assets/logo-dogker.png", imagenes: images, variants, vLabel: row.variant_label || "Talla", featured: row.is_featured,
    _col: col?.name || "Otros", _dept: top ? DEPTS.find((d) => d.slug === top.slug) : null, _base: base, _variant: variant,
    _estado: variants.some((v) => v.inStock) ? "habilitado" : "agotado",
  };
}

async function boot() {
  wireChrome(); renderCartCount();
  try {
    if (!supabase) throw new Error("Falta configurar VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env");
    const [cats, prods, txt] = await Promise.all([
      supabase.from("categories").select("*"),
      supabase.from("products").select("*, product_images(image_url, display_order), product_variants(*)").eq("is_active", true).order("display_order"),
      supabase.from("site_content").select("section_key, content_value"),
    ]);
    if (!txt.error) { for (const r of txt.data) if (r.content_value?.trim()) TXT[r.section_key] = r.content_value; paintStatic(); }
    if (cats.error || prods.error) throw cats.error || prods.error;
    const catList = cats.data.sort(byOrder); const catById = Object.fromEntries(catList.map((c) => [c.id, c]));
    DEPTS = catList.filter((c) => !c.parent_id).map((d) => ({ slug: d.slug, name: d.name, image: d.image_url, cols: catList.filter((c) => c.parent_id === d.id).map((c) => c.name) }));
    P = prods.data.map((r) => toProduct(r, catById));
    P.forEach((p) => { BY[p.id] = p; (GROUPS[p._col + "|" + p._base] ||= []).push(p); });
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="wrap section"><div class="empty"><h2>No pudimos cargar el catálogo</h2><p class="muted">La información está temporalmente desactualizada. Intenta de nuevo en un momento o escríbenos por WhatsApp.</p><button class="btn btn--primary" onclick="location.reload()">Reintentar</button></div></div>`;
    return;
  }
  $("#mainNav").innerHTML = DEPTS.map((d) => `<a href="#/c/${d.slug}">${esc(d.name)}</a>`).join("") + `<a href="#/c/todo">Ver todo</a>`;
  $("#footCats").innerHTML = DEPTS.map((d) => `<li><a href="#/c/${d.slug}">${esc(d.name)}</a></li>`).join("");
  route();
}

/* ---------- precios ---------- */
const findVariant = (p, size) => p.variants.find((v) => v.size === size) || null;
const priceFor = (p, size) => (findVariant(p, size) || p.variants.find((v) => v.inStock) || p.variants[0])?.price ?? null;
const showSizes = (p) => p.variants.length > 1 || (p.variants.length === 1 && p.variants[0].size);
function priceLabel(p) {
  const priced = p.variants.filter((v) => v.price != null);
  if (!priced.length) return "Consultar precio";
  const min = priced.reduce((a, b) => (b.price < a.price ? b : a));
  const desde = new Set(priced.map((v) => v.price)).size > 1;
  return `${min.old && !desde ? `<span class="old">${cop(min.old)}</span>` : ""}${desde ? "Desde " : ""}${cop(min.price)}`;
}

/* ---------- helpers ---------- */
const groupOf = (p) => GROUPS[p._col + "|" + p._base] || [p];
function card(p) {
  const g = groupOf(p); const agot = p._estado === "agotado";
  const opts = g.length > 1
    ? `<span class="swatches">${g.slice(0, 5).map((x) => `<i style="background:${swatchOf(x._variant) || "#ddd"}"></i>`).join("")}</span> ${g.length} opciones`
    : esc(p.dim || (p.variants.length > 1 ? `Varias opciones de ${p.vLabel.toLowerCase()}` : "Talla única"));
  const quick = p.variants.length > 1 || g.length > 1;
  return `<article class="card">
    <a class="card__media" href="#/p/${p.id}" tabindex="-1" aria-hidden="true"><img loading="lazy" src="${esc(p.imagen)}" alt="" width="540" height="600" ${agot ? 'style="opacity:.5"' : ""}>
      ${agot ? '<span class="badge badge--ink">Agotado temporalmente</span>' : ""}</a>
    <div><div class="card__cat">${esc(p._col)}</div>
      <a class="card__name" href="#/p/${p.id}">${esc(g.length > 1 ? p._base : p.nombre)}</a>
      <div class="card__meta">${opts}</div></div>
    <div class="card__row"><span class="price">${priceLabel(p)}</span>
      ${agot ? `<a class="chip" style="position:relative;z-index:1" href="${consultUrl(p)}" target="_blank" rel="noopener">${icon("wa")}Consultar</a>`
        : `<button class="add" data-add="${p.id}" ${quick ? 'data-pick="1"' : ""} aria-label="${quick ? "Elegir opciones de" : "Agregar a Mi pedido"} ${esc(p.nombre)}">${icon(quick ? "arrow" : "plus")}</button>`}</div>
  </article>`;
}
const consultUrl = (p) => `https://wa.me/${DK.WA_NUMBER}?text=${encodeURIComponent("Hola Dögker, quiero consultar disponibilidad de: " + p.nombre)}`;
const groupsFirst = (list) => { const seen = new Set(); return list.filter((p) => { const k = p._col + "|" + p._base; if (seen.has(k)) return false; seen.add(k); return true; }); };

/* ---------- router ---------- */
function route() {
  const h = location.hash.slice(1) || "/";
  const [path, qs] = h.split("?"); const params = new URLSearchParams(qs || "");
  const seg = path.split("/").filter(Boolean);
  document.querySelectorAll(".nav a").forEach((a) => { if (a.getAttribute("href") === "#/" + seg.slice(0, 2).join("/")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  $("#mainNav").classList.remove("open");
  if (seg[0] === "c") renderCatalog(seg[1] || "todo", params);
  else if (seg[0] === "p" && BY[seg[1]]) renderProduct(BY[seg[1]]);
  else if (seg[0] === "buscar") renderCatalog("todo", params);
  else if (seg[0] === "info") renderInfo(seg[1]);
  else renderHome();
  const y = store.get("dogker-scroll", {})[location.hash] || 0;
  requestAnimationFrame(() => window.scrollTo(0, seg[0] === "p" ? 0 : y));
  document.documentElement.style.setProperty("--hh", $(".header").offsetHeight + "px");
}
addEventListener("hashchange", () => P.length && route());
let scrollT; addEventListener("scroll", () => { clearTimeout(scrollT); scrollT = setTimeout(() => { const s = store.get("dogker-scroll", {}); s[location.hash] = scrollY; store.set("dogker-scroll", s); }, 150); }, { passive: true });

/* ---------- pages ---------- */
function renderHome() {
  document.title = "Dögker · Productos premium para tu mascota";
  const feat = P.filter((p) => p.featured);
  const hero = BY[t("hero_product_ref")] || feat[0] || P[0];
  const arena = BY[t("arena_product_ref")];
  const paseo = groupsFirst(P.filter((p) => p._dept?.slug === "paseo")).slice(0, 4);
  const d = deliveryEstimate(new Date());
  main.innerHTML = `
  <section class="hero"><div class="wrap hero__in">
    <div class="reveal" style="display:grid;gap:24px;align-content:center">
      <span class="eyebrow">${esc(t("hero_eyebrow"))}</span>
      <h1>${esc(t("hero_title"))}</h1>
      <p>${esc(t("hero_subtitle"))}</p>
      <div class="hero__cta"><a class="btn btn--primary" href="${esc(t("hero_cta_primary_link"))}">${esc(t("hero_cta_primary_text"))}</a><a class="btn btn--secondary" href="${esc(t("hero_cta_secondary_link"))}">${esc(t("hero_cta_secondary_text"))}</a></div>
    </div>
    ${hero ? `<figure class="reveal" style="margin:0"><a class="hero__art" href="#/p/${hero.id}"><img src="${esc(hero.imagen)}" alt="${esc(hero.nombre)}" width="1080" height="1080" fetchpriority="high"></a>
      <figcaption class="hero__cap"><span>${esc(hero.nombre)}${hero.dim ? " · " + esc(hero.dim) : ""}</span><b>${priceLabel(hero)}</b></figcaption></figure>` : ""}
    </div></section>

  <section class="section section--tight wrap"><div class="section__head"><h2>${esc(t("categories_title"))}</h2><a class="more" href="#/c/todo">Ver todo${icon("arrow")}</a></div>
    <div class="cats">${DEPTS.map((x) => `<a href="#/c/${x.slug}"><div class="disc">${x.image ? `<img loading="lazy" src="${esc(x.image)}" alt="">` : ""}</div>${esc(x.name)}</a>`).join("")}</div></section>

  ${feat.length ? `<section class="section wrap" style="padding-top:40px"><div class="section__head"><div><div class="eyebrow">${esc(t("featured_eyebrow"))}</div><h2>${esc(t("featured_title"))}</h2></div>
    <a class="btn btn--secondary" href="${esc(t("featured_button_link"))}">${esc(t("featured_button_text"))}</a></div>
    <div class="grid">${feat.map(card).join("")}</div></section>` : ""}

  ${arena ? `<section class="arena"><div class="wrap arena__in">
    <a class="arena__img" href="#/p/${arena.id}"><img loading="lazy" src="${esc(arena.imagen)}" alt="${esc(arena.nombre)}"></a>
    <div><span class="badge badge--ivory">${esc(t("arena_badge"))}</span>
      <h2 style="margin-top:16px">${esc(arena.nombre)}</h2>
      <ul>${lines("arena_bullets").map((b) => `<li>${icon("check")}${esc(b)}</li>`).join("")}</ul>
      <div style="display:flex;gap:20px;align-items:center;flex-wrap:wrap"><span class="price">${priceLabel(arena)}</span><a class="btn btn--ivory" href="#/p/${arena.id}">${esc(t("arena_cta"))}</a></div>
      <p class="small" style="opacity:.85;margin-top:16px">${esc(t("arena_note"))}</p></div></div></section>` : ""}

  ${paseo.length ? `<section class="section wrap"><div class="section__head"><h2>${esc(t("paseo_title"))}</h2><a class="more" href="#/c/paseo">Ver paseo${icon("arrow")}</a></div>
    <div class="grid">${paseo.map(card).join("")}</div></section>` : ""}

  <section class="section wrap" id="como-pedir"><div class="section__head"><h2>${esc(t("steps_title"))}</h2></div>
    <div class="steps">
      ${[1, 2, 3].map((n) => `<div class="step"><b>${n}</b><h3>${esc(t(`step${n}_title`))}</h3><p class="muted">${esc(t(`step${n}_text`))}</p></div>`).join("")}
    </div>
    ${deliveryBlock(d)}
  </section>`;
}

function deliveryBlock(d) {
  return `<div class="delivery">
    <div class="d1"><h3 style="font-size:24px;display:flex;gap:10px;align-items:center">${icon("clock")}Bogotá y Soacha · lunes a sábado</h3>
      <table><tr><td><b>Confirmado hasta las 10 a. m.</b></td><td>Entre 11 a. m. y 1 p. m. de ese día</td></tr>
        <tr><td><b>Entre 10 a. m. y 1 p. m.</b></td><td>Entre 1 p. m. y 4 p. m. de ese día</td></tr>
        <tr><td><b>Desde la 1 p. m.</b></td><td>Entre 11 a. m. y 1 p. m. del siguiente día de reparto</td></tr></table>
      <p class="small muted">Si confirmamos tu pedido ahora, llegaría <b>${d.when}</b> entre ${d.window}. Los horarios cuentan desde la confirmación por WhatsApp (hora de Bogotá). ${d.note || "Domingos y festivos coordinamos contigo."}</p></div>
    <div class="d2"><h3 style="font-size:24px;display:flex;gap:10px;align-items:center">${icon("truck")}Envíos nacionales</h3>
      <p><span class="big">2–3 días</span><br><span class="muted small">calendario a ciudades principales</span></p>
      <p><span class="big">4–6 días</span><br><span class="muted small">calendario a ciudades aledañas</span></p>
      <p class="small muted">Sujeto a la coordinación de la entrega.</p></div></div>`;
}

function renderCatalog(slug, params) {
  const dept = DEPTS.find((d) => d.slug === slug);
  const q = params.get("q") || ""; const col = params.get("col") || ""; const orden = params.get("orden") || "destacados";
  let list = P.filter((p) => !dept || p._dept?.slug === slug);
  const cols = dept ? dept.cols.filter((c) => list.some((p) => p._col === c)) : [...new Set(P.map((p) => p._col))];
  if (col) list = list.filter((p) => slugify(p._col) === col);
  if (q) list = list.filter((p) => matches(p, q));
  const price = (p) => Math.min(...p.variants.map((v) => v.price ?? Infinity));
  if (orden === "menor") list = [...list].sort((a, b) => price(a) - price(b));
  if (orden === "mayor") list = [...list].sort((a, b) => (price(b) === Infinity ? -1 : price(b)) - (price(a) === Infinity ? -1 : price(a)));
  const items = groupsFirst(list);
  const title = q ? `Resultados para “${esc(q)}”` : dept ? esc(dept.name) : "Todo el catálogo";
  document.title = `${q ? "Buscar" : dept ? dept.name : "Catálogo"} · Dögker`;
  const link = (o) => { const p = new URLSearchParams({ ...(q && { q }), ...(o.col ?? col ? { col: o.col ?? col } : {}), ...((o.orden ?? orden) !== "destacados" && { orden: o.orden ?? orden }) }); return `#/${q && !dept ? "buscar" : "c/" + slug}${p.toString() ? "?" + p : ""}`; };
  main.innerHTML = `
  <div class="wrap"><nav class="crumbs" aria-label="Ruta"><a href="#/">Inicio</a>${icon("chev")}<span>${title}</span></nav>
    <div class="section__head" style="margin-bottom:20px"><div><h1 style="font-size:clamp(2.4rem,5vw,4rem)">${title}</h1>
      <p class="muted" style="margin:6px 0 0">${items.length} ${items.length === 1 ? "producto" : "productos"}</p></div>
      <button class="chip" data-share="${location.href}">${icon("share")}Compartir</button></div></div>
  <div class="toolbar"><div class="wrap">
    <div class="scroller" role="group" aria-label="Filtrar por colección">
      <a class="chip" href="${link({ col: "" })}" aria-current="${!col}">Todos</a>
      ${cols.map((c) => `<a class="chip" href="${link({ col: slugify(c) })}" aria-current="${col === slugify(c)}">${esc(c.replace(/^Peluches /, ""))}</a>`).join("")}
    </div>
    <label class="sr" for="orden">Ordenar</label>
    <select class="select" id="orden"><option value="destacados">Destacados</option><option value="menor">Menor precio</option><option value="mayor">Mayor precio</option></select>
  </div></div>
  <div class="wrap">${items.length ? `<div class="grid">${items.map(card).join("")}</div>`
    : `<div class="empty"><h2>No encontramos productos</h2><p class="muted">Prueba con otra palabra o escríbenos y te ayudamos a encontrarlo.</p><a class="btn btn--primary" href="https://wa.me/${DK.WA_NUMBER}" target="_blank" rel="noopener">${icon("wa")}Preguntar por WhatsApp</a></div>`}</div>`;
  const sel = $("#orden"); sel.value = orden; sel.onchange = () => (location.hash = link({ orden: sel.value }));
  if (q) $("#q").value = q;
}

function renderProduct(p) {
  const g = groupOf(p); const agot = p._estado === "agotado";
  let size = (p.variants.find((v) => v.inStock) || p.variants[0])?.size ?? ""; let qty = 1;
  document.title = `${p.nombre} · Dögker`;
  const d = deliveryEstimate(new Date());
  main.innerHTML = `
  <div class="wrap"><nav class="crumbs" aria-label="Ruta"><a href="#/">Inicio</a>${icon("chev")}${p._dept ? `<a href="#/c/${p._dept.slug}">${esc(p._dept.name)}</a>${icon("chev")}` : ""}<a href="#/c/${p._dept?.slug || "todo"}?col=${slugify(p._col)}">${esc(p._col)}</a></nav>
  <div class="pdp">
    <div class="pdp__gallery">
      <div class="pdp__main"><img id="mainImg" src="${esc(p.imagen)}" alt="${esc(p.nombre)}" width="1080" height="1080">
        <button class="pdp__zoom" id="zoomBtn">${icon("zoom")}Ampliar</button></div>
      ${p.imagenes.length > 1 ? `<div class="thumbs" role="group" aria-label="Fotos">${p.imagenes.map((src, i) => `<button aria-pressed="${i === 0}" data-img="${i}" aria-label="Foto ${i + 1}"><img src="${esc(src)}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}
    </div>
    <div>
      <span class="badge ${agot ? "badge--ink" : "badge--ivory"}">${agot ? "Agotado temporalmente" : esc(p._col)}</span>
      <h1 style="margin:12px 0 10px">${esc(g.length > 1 ? p._base : p.nombre)}</h1>
      <div class="pdp__price" id="price"></div>
      <p class="small muted" style="margin:4px 0 0">Ref. ${esc(p.id)}${p.dim ? " · " + esc(p.dim) : ""}</p>
      <p class="desc" style="margin-top:18px">${esc(cleanDesc(p.descripcion))}</p>
      ${g.length > 1 ? `<div class="opt"><div class="opt__label">Color: <b>${esc(p._variant)}</b></div><div class="opt__choices">${g.map((x) => `<a class="chip" href="#/p/${x.id}" aria-current="${x.id === p.id}">${swatchOf(x._variant) ? `<i style="width:14px;height:14px;border-radius:99px;background:${swatchOf(x._variant)}"></i>` : ""}${esc(x._variant)}</a>`).join("")}</div></div>` : ""}
      ${showSizes(p) ? `<div class="opt"><div class="opt__label">${esc(p.vLabel)}: <b id="sizeLbl">${esc(size)}</b></div><div class="opt__choices">${p.variants.map((s) => `<button class="chip" data-size="${esc(s.size)}" aria-pressed="${s.size === size}" ${s.inStock ? "" : 'disabled title="Agotado"'}>${esc(s.size)}${s.price != null ? " · " + cop(s.price) : ""}</button>`).join("")}</div></div>` : ""}
      ${agot ? `<a class="btn btn--primary btn--block" href="${consultUrl(p)}" target="_blank" rel="noopener">${icon("wa")}Consultar disponibilidad</a>`
        : `<div class="buy"><div class="stepper" aria-label="Cantidad"><button id="qMinus" aria-label="Quitar uno">${icon("minus")}</button><span id="qty" aria-live="polite">1</span><button id="qPlus" aria-label="Agregar uno">${icon("plus")}</button></div>
        <button class="btn btn--primary" id="addBtn">Agregar a Mi pedido</button></div>`}
      <div class="note">${icon("wa")}Confirmaremos disponibilidad y entrega contigo por WhatsApp.</div>
      <div class="box"><div class="row">${icon("clock")}<div><b>Bogotá y Soacha</b><br><span class="muted">Si confirmamos tu pedido ahora, llegaría ${d.when} entre ${d.window}.</span></div></div>
        <div class="row">${icon("truck")}<div><b>Resto del país</b><br><span class="muted">2–3 días calendario a ciudades principales · 4–6 a ciudades aledañas.</span></div></div>
        <span class="muted">Estimado: depende de la hora en que confirmemos tu pedido (hora de Bogotá).</span></div>
      <details style="margin-top:20px"><summary>Entregas y envíos</summary><p class="muted small">Coordinamos cada entrega por WhatsApp. El costo del envío depende de la zona y te lo confirmamos antes del pago.</p></details>
      <div class="share">Compartir:
        <a target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(p.nombre + " en Dögker: " + location.href)}">${icon("wa")}WhatsApp</a>
        <button data-share="${location.href}">${icon("share")}Copiar enlace</button></div>
    </div></div></div>
  <section class="section" style="background:var(--ivory-soft)"><div class="wrap"><div class="section__head"><h2>También te puede gustar</h2></div>
    <div class="grid">${groupsFirst(P.filter((x) => x._col === p._col && x._base !== p._base).concat(P.filter((x) => x._dept === p._dept && x._col !== p._col))).slice(0, 4).map(card).join("")}</div></div></section>`;

  let img = 0;
  const paint = () => {
    const v = findVariant(p, size) || p.variants[0]; const pr = v?.price ?? null;
    $("#price").innerHTML = pr != null ? `${cop(pr)}${v.old ? `<span class="old">${cop(v.old)}</span>` : ""}` : "Precio por confirmar";
    const b = $("#addBtn"); if (b) { b.textContent = `Agregar a Mi pedido${pr != null ? " · " + cop(pr * qty) : ""}`; b.disabled = v ? !v.inStock : false; }
  };
  paint();
  main.querySelectorAll("[data-size]").forEach((b) => b.onclick = () => { size = b.dataset.size; main.querySelectorAll("[data-size]").forEach((x) => x.setAttribute("aria-pressed", x === b)); $("#sizeLbl").textContent = size; paint(); });
  main.querySelectorAll("[data-img]").forEach((b) => b.onclick = () => { img = +b.dataset.img; $("#mainImg").src = p.imagenes[img]; main.querySelectorAll("[data-img]").forEach((x) => x.setAttribute("aria-pressed", x === b)); });
  if ($("#qPlus")) { $("#qPlus").onclick = () => { qty = Math.min(99, qty + 1); $("#qty").textContent = qty; paint(); }; $("#qMinus").onclick = () => { qty = Math.max(1, qty - 1); $("#qty").textContent = qty; paint(); }; $("#addBtn").onclick = () => addToCart(p, size, qty); }
  $("#zoomBtn").onclick = () => { $("#zoomImg").src = p.imagenes[img] || p.imagen; $("#zoomImg").alt = p.nombre; $("#zoom").showModal(); };
}

function renderInfo(page) {
  const paras = (k) => lines(k).map((l) => `<p>${esc(l)}</p>`).join("");
  const pages = {
    "como-pedir": ["Cómo pedir", paras("page_como_pedir")],
    entregas: ["Entregas y envíos", deliveryBlock(deliveryEstimate(new Date()))],
    politicas: ["Políticas comerciales", paras("page_politicas")],
  };
  const [title, html] = pages[page] || pages["como-pedir"];
  document.title = title + " · Dögker";
  main.innerHTML = `<div class="wrap section"><h1 style="font-size:clamp(2.4rem,5vw,4rem);margin-bottom:24px">${title}</h1>${html}</div>`;
}

/* ---------- Mi pedido ---------- */
const keyOf = (id, size) => [id, size || ""].join("|");
function addToCart(p, size, qty) {
  const k = keyOf(p.id, size); const ex = cart.find((l) => l.key === k);
  const price = priceFor(p, size);
  if (ex) ex.qty = Math.min(99, ex.qty + qty); else cart.push({ key: k, id: p.id, size: size || null, qty, price });
  saveCart(); showToast(p, qty);
}
function saveCart() { store.set("dogker-pedido", cart); renderCartCount(); if ($("#drawer").classList.contains("open")) renderDrawer(); }
function renderCartCount() { $("#cartCount").textContent = cart.reduce((s, l) => s + l.qty, 0); }
let toastT;
function showToast(p, qty) {
  const el = $("#toast");
  el.innerHTML = `<img src="${esc(p.imagen)}" alt=""><div><b style="display:flex;gap:6px;align-items:center">${icon("check")}Agregado a Mi pedido</b><span class="small" style="color:var(--ivory)">${esc(p.nombre)} · ${qty} u.</span></div><button id="toastOpen">Ver pedido</button>`;
  el.classList.add("show"); $("#toastOpen").onclick = openDrawer;
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 4000);
}
function openDrawer() { renderDrawer(); $("#backdrop").hidden = false; const d = $("#drawer"); d.classList.add("open"); d.setAttribute("aria-hidden", "false"); $("#closeDrawer").focus(); $("#toast").classList.remove("show"); }
function closeDrawer() { $("#backdrop").hidden = true; const d = $("#drawer"); d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); $("#cartBtn").focus(); }

// Una línea está agotada si el producto o la talla elegida ya no están disponibles.
const lineAgot = (p, l) => p._estado === "agotado" || (l.size ? findVariant(p, l.size)?.inStock === false : false);
function renderDrawer() {
  const rows = cart.map((l) => { const p = BY[l.id]; const now = p ? priceFor(p, l.size) : null; return { ...l, p, now, changed: p && now !== l.price, gone: !p || (l.size && !findVariant(p, l.size)), agot: p && lineAgot(p, l) }; });
  const issues = rows.filter((l) => l.changed || l.gone || l.agot);
  const valid = rows.filter((l) => !l.gone && !l.agot);
  $("#drawerCount").textContent = `${valid.reduce((s, l) => s + l.qty, 0)} u.`;
  if (!rows.length) { $("#drawerBody").innerHTML = `<div class="empty" style="margin-top:24px"><h3>Tu pedido está vacío</h3><p class="muted">Agrega productos y continúa por WhatsApp cuando estés listo.</p><button class="btn btn--primary" onclick="location.hash='#/c/todo';document.getElementById('closeDrawer').click()">Ver productos</button></div>`; $("#drawerFoot").innerHTML = ""; return; }
  $("#drawerBody").innerHTML = (issues.length ? `<div class="alert">${icon("alert")}<div><b>Actualizamos tu pedido</b><br>${issues.map((l) => l.gone ? `${esc(l.p?.nombre || l.id)}${l.size ? " (" + esc(l.size) + ")" : ""} ya no está disponible en la tienda.` : l.agot ? `${esc(l.p.nombre)} está agotado temporalmente y no se incluirá.` : `${esc(l.p.nombre)}: el precio cambió de ${cop(l.price) || "—"} a ${cop(l.now) || "por confirmar"}.`).join("<br>")}<br><button class="chip" id="ackBtn" style="margin-top:8px">Revisé los cambios</button></div></div>` : "")
    + rows.map((l, i) => `<div class="line ${l.gone || l.agot ? "na" : ""}">
      <img src="${esc(l.p?.imagen || "")}" alt="">
      <div><div class="line__top"><span>${esc(l.p?.nombre || l.id)}</span><button class="icon-btn" style="width:36px;height:36px" data-del="${i}" aria-label="Quitar ${esc(l.p?.nombre || "")}">${icon("trash")}</button></div>
        <div class="line__var">${[l.size && `${esc(l.p?.vLabel || "Talla")}: ${esc(l.size)}`, "Ref. " + esc(l.id)].filter(Boolean).join(" · ")}</div>
        <div class="line__bot">${l.gone || l.agot ? `<span class="badge badge--ink">${l.gone ? "No disponible" : "Agotado temporalmente"}</span>` : `<div class="stepper"><button data-dec="${i}" aria-label="Quitar uno">${icon("minus")}</button><span>${l.qty}</span><button data-inc="${i}" aria-label="Agregar uno">${icon("plus")}</button></div>`}
          <div style="text-align:right"><b>${l.now != null ? cop(l.now * l.qty) : "Por confirmar"}</b><br><span class="small muted">${l.changed && l.price != null ? `<span class="old">${cop(l.price)}</span>` : ""}${l.now != null ? cop(l.now) + " c/u" : ""}</span></div></div></div></div>`).join("");
  const msg = waMessage(valid.map((l) => ({ name: l.p.nombre, variant: l.size ? `${l.p.vLabel} ${l.size}` : "", ref: l.id, qty: l.qty, price: l.now })), dest);
  const blocked = rows.some((l) => l.changed);
  $("#drawerFoot").innerHTML = `
    <div class="dest" role="group" aria-label="Destino">Entrega en: ${["Bogotá", "Soacha", "Otra ciudad"].map((x) => `<button class="chip" data-dest="${x}" aria-pressed="${dest === x}">${x}</button>`).join("")}</div>
    <div class="sum"><span>Subtotal</span><span>${cop(msg.subtotal)}</span></div>
    <div class="sum muted"><span>Envío ${dest === "Otra ciudad" ? "nacional" : dest}</span><span>${dest === "Otra ciudad" ? "Se cotiza por WhatsApp" : "Según tarifa de zona"}</span></div>
    <div class="sum total"><span>Total estimado</span><span>${cop(msg.subtotal)} + envío</span></div>
    <div class="note small">${icon("wa")}Confirmaremos disponibilidad y entrega contigo por WhatsApp.</div>
    <a class="btn btn--primary btn--block" id="waBtn" href="${msg.url}" target="_blank" rel="noopener" ${blocked || !valid.length ? 'aria-disabled="true" style="opacity:.45;pointer-events:none"' : ""}>${icon("wa")}Continuar por WhatsApp</a>
    <p class="small muted" style="margin:0">${blocked ? "Revisa los cambios de precio para continuar." : `Se abrirá WhatsApp con tu pedido listo para enviar al ${esc(t("whatsapp_display"))}.`}</p>`;
  $("#drawerBody").querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { cart.splice(+b.dataset.del, 1); saveCart(); });
  $("#drawerBody").querySelectorAll("[data-inc]").forEach((b) => b.onclick = () => { cart[+b.dataset.inc].qty = Math.min(99, cart[+b.dataset.inc].qty + 1); saveCart(); });
  $("#drawerBody").querySelectorAll("[data-dec]").forEach((b) => b.onclick = () => { const l = cart[+b.dataset.dec]; l.qty > 1 ? l.qty-- : cart.splice(+b.dataset.dec, 1); saveCart(); });
  $("#drawerFoot").querySelectorAll("[data-dest]").forEach((b) => b.onclick = () => { dest = b.dataset.dest; store.set("dogker-destino", dest); renderDrawer(); });
  const ack = $("#ackBtn"); if (ack) ack.onclick = () => {
    cart = cart.filter((l) => { const p = BY[l.id]; return p && (!l.size || findVariant(p, l.size)) && !lineAgot(p, l); }).map((l) => ({ ...l, price: priceFor(BY[l.id], l.size) }));
    saveCart();
  };
}

/* ---------- chrome ---------- */
function wireChrome() {
  $("#cartBtn").onclick = openDrawer; $("#closeDrawer").onclick = closeDrawer; $("#backdrop").onclick = closeDrawer;
  addEventListener("keydown", (e) => { if (e.key === "Escape" && $("#drawer").classList.contains("open")) closeDrawer(); });
  $("#menuBtn").onclick = () => { const n = $("#mainNav"); const o = n.classList.toggle("open"); $("#menuBtn").setAttribute("aria-expanded", o); };
  $("#searchForm").onsubmit = (e) => { e.preventDefault(); const q = $("#q").value.trim(); if (q) location.hash = "#/buscar?q=" + encodeURIComponent(q); };
  $("#zoomClose").onclick = () => $("#zoom").close();
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-add]");
    if (a) { e.preventDefault(); const p = BY[a.dataset.add]; if (a.dataset.pick) location.hash = "#/p/" + p.id; else addToCart(p, p.variants[0]?.size || "", 1); return; }
    const s = e.target.closest("[data-share]");
    if (s) { const url = s.dataset.share; (navigator.share ? navigator.share({ title: document.title, url }) : navigator.clipboard?.writeText(url))?.catch?.(() => {}); }
  });
  addEventListener("storage", (e) => { if (e.key === "dogker-pedido") { cart = store.get("dogker-pedido", []); renderCartCount(); } });
}

boot();
