import { supabase, $, esc, spinner, toast } from "../common.js";

const app = $("#app");
const next = new URLSearchParams(location.search).get("next");
const goNext = () => location.replace(next?.startsWith("/admin/") ? next : "/admin/productos/");
app.className = "acenter";

function card(title, sub, body) {
  app.innerHTML = `<div class="acard"><img src="/assets/logo-dogker.png" alt="Dögker" width="120" height="51" style="margin-bottom:16px"><h1 style="font-size:1.8rem">${title}</h1><p class="muted" style="margin:6px 0 0">${sub}</p>${body}</div>`;
  document.body.classList.remove("booting");
}
const busy = (btn, on, label) => { btn.disabled = on; btn.innerHTML = on ? `${spinner} Un momento…` : label; };

function loginForm() {
  card("Panel de administración", "Ingresa con tu correo y contraseña.", `
    <form id="f" novalidate>
      <label class="field"><span>Correo</span><input type="email" id="email" autocomplete="username" required></label>
      <label class="field"><span>Contraseña</span><input type="password" id="pass" autocomplete="current-password" required></label>
      <p class="err" id="err" role="alert"></p>
      <button class="abtn abtn--primary" style="width:100%;min-height:48px" id="go">Ingresar</button>
      <button type="button" class="abtn abtn--ghost" style="width:100%;margin-top:8px" id="forgot">¿Olvidaste tu contraseña?</button>
    </form>`);
  $("#f").onsubmit = async (e) => {
    e.preventDefault(); const btn = $("#go"); $("#err").textContent = "";
    const email = $("#email").value.trim(), password = $("#pass").value;
    if (!email || !password) return ($("#err").textContent = "Escribe tu correo y tu contraseña.");
    busy(btn, true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { busy(btn, false, "Ingresar"); $("#err").textContent = /invalid/i.test(error.message) ? "Correo o contraseña incorrectos." : error.message; return; }
    goNext();
  };
  $("#forgot").onclick = async () => {
    const email = $("#email").value.trim();
    if (!email) return ($("#err").textContent = "Escribe tu correo arriba y vuelve a pulsar «¿Olvidaste tu contraseña?».");
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + "/admin/login/" });
    error ? toast(error.message, "err") : toast(`Si ${email} tiene cuenta, te llegará un correo para crear una contraseña nueva.`);
  };
}

function newPasswordForm() {
  card("Crea tu nueva contraseña", "Mínimo 8 caracteres.", `
    <form id="f"><label class="field"><span>Nueva contraseña</span><input type="password" id="pass" autocomplete="new-password" minlength="8" required></label>
    <p class="err" id="err" role="alert"></p><button class="abtn abtn--primary" style="width:100%;min-height:48px" id="go">Guardar contraseña</button></form>`);
  $("#f").onsubmit = async (e) => {
    e.preventDefault(); const password = $("#pass").value;
    if (password.length < 8) return ($("#err").textContent = "Usa al menos 8 caracteres.");
    busy($("#go"), true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { busy($("#go"), false, "Guardar contraseña"); $("#err").textContent = esc(error.message); return; }
    toast("Contraseña actualizada."); setTimeout(goNext, 800);
  };
}

if (!supabase) card("Falta configurar Supabase", "Crea el archivo .env a partir de .env.example.", "");
else {
  let recovering = false;
  supabase.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") { recovering = true; newPasswordForm(); } });
  const { data: { session } } = await supabase.auth.getSession();
  if (recovering || /type=recovery/.test(location.hash)) newPasswordForm();
  else if (session) goNext();
  else loginForm();
}
