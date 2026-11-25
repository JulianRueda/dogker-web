import { supabase, $, esc, icon, spinner, toast, errMsg, requireSession } from "../common.js";
import { CONTENT } from "../../content-defaults.js";

await requireSession("textos");
const app = $("#app");
let rows = [], changed = new Set(), saving = false;

async function load() {
  const { data, error } = await supabase.from("site_content").select("section_key, label, content_value, section, display_order");
  if (error) return toast(errMsg(error), "err");
  const db = Object.fromEntries(data.map((r) => [r.section_key, r]));
  // Los textos que aún no están en la base se muestran con su valor original y se crean al guardar.
  rows = CONTENT.map(([section, key, label, value], i) => {
    const r = db[key];
    return r ? Object.assign(r, { label: r.label || label, section: r.section || section, display_order: r.display_order ?? i }) : { section_key: key, label, content_value: value, section, display_order: i };
  });
  rows.push(...data.filter((r) => !rows.includes(r)));
  render();
}

const long = (r) => r.content_value.length > 90 || r.content_value.includes("\n") || /^page_|_bullets$/.test(r.section_key);
function render() {
  const sections = [...new Set(rows.map((r) => r.section))];
  app.innerHTML = `<div class="ahead"><div><h1>Textos de la página</h1><p class="muted">Edita los textos y pulsa «Guardar cambios». Si dejas un campo vacío se usa el texto original.</p></div></div>
    ${sections.map((s, si) => `<details class="acard tsec" ${si < 2 ? "open" : ""}><summary>${esc(s)}</summary>
      ${rows.filter((r) => r.section === s).map((r) => { const i = rows.indexOf(r); return `<label class="field"><span>${esc(r.label)}</span>
        ${long(r) ? `<textarea data-i="${i}" rows="${Math.min(8, Math.max(3, r.content_value.split("\n").length + 1))}" class="${changed.has(i) ? "changed" : ""}">${esc(r.content_value)}</textarea>` : `<input data-i="${i}" value="${esc(r.content_value)}" class="${changed.has(i) ? "changed" : ""}">`}
      </label>`; }).join("")}</details>`).join("")}
    <div class="savebar"><div class="savebar__in"><span class="hint" id="state">${changed.size ? `${changed.size} cambio${changed.size === 1 ? "" : "s"} sin guardar` : "Todo guardado"}</span>
      <button class="abtn abtn--primary" id="save" ${saving || !changed.size ? "disabled" : ""}>${saving ? `${spinner} Guardando…` : `${icon("check")}Guardar cambios`}</button></div></div>`;
  app.querySelectorAll("[data-i]").forEach((el) => (el.oninput = () => {
    const i = +el.dataset.i; rows[i].content_value = el.value; changed.add(i); el.classList.add("changed");
    $("#state").textContent = `${changed.size} cambio${changed.size === 1 ? "" : "s"} sin guardar`; $("#save").disabled = false;
  }));
  $("#save").onclick = save;
}

async function save() {
  saving = true; render();
  const payload = [...changed].map((i) => { const { section_key, label, content_value, section, display_order } = rows[i]; return { section_key, label, content_value, section, display_order }; });
  const { error } = await supabase.from("site_content").upsert(payload, { onConflict: "section_key" });
  saving = false;
  if (error) { toast("No se pudo guardar: " + errMsg(error), "err"); return render(); }
  changed.clear(); render(); toast("Textos guardados. Ya se ven en la página.");
}

addEventListener("beforeunload", (e) => { if (changed.size) e.preventDefault(); });
load();
