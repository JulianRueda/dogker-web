/* Lógica pura de Dögker (sin DOM). La usan app.js, scripts/seed.mjs y tests/logic.test.cjs.
   Los parsers de descripción (tallas, presentaciones) solo se usan para migrar catalogo.json a Supabase. */
(function (root) {
  const DEPTS = [
    { slug: "peluches", name: "Peluches", cols: ["Peluches Dispensador", "Peluches Alargados", "Peluches Lisos", "Peluches Coloridos", "Peluches Pequeños", "Peluches Criaturas", "Otros peluches"] },
    { slug: "gatos", name: "Arena y gatos", cols: ["Arena", "Areneras", "Collares para Gato"] },
    { slug: "paseo", name: "Paseo", cols: ["Arneses", "Collares & Correas Perros", "Transportadores", "Portabolsas"] },
    { slug: "juguetes", name: "Juguetes", cols: ["Juguetes", "Juguetes en TPR", "Lazos"] },
    { slug: "cuidado", name: "Cuidado", cols: ["Cuidado del Peludito", "Cepillos"] },
    { slug: "comederos", name: "Comederos", cols: ["Comederos & Bebederos", "Premios & Alimentación"] },
  ];

  // Productos sin colección en el catálogo de WhatsApp: se asignan por palabra clave del id.
  const RULES = [
    [/^arena-/, "Arena"], [/arenera|pala-filtradora|litter-box/, "Areneras"], [/collar-para-gat/, "Collares para Gato"],
    [/alargad/, "Peluches Alargados"], [/hunter/, "Peluches Lisos"], [/^peluche/, "Otros peluches"],
    [/arnes/, "Arneses"], [/transportador/, "Transportadores"], [/portabolsas/, "Portabolsas"], [/correa|collar/, "Collares & Correas Perros"],
    [/comedero|bebedero/, "Comederos & Bebederos"], [/lazo/, "Lazos"], [/tpr/, "Juguetes en TPR"], [/juguete/, "Juguetes"],
    [/cepillo|desenredador/, "Cepillos"], [/panal|toalla/, "Cuidado del Peludito"], [/hueso|dispensador-de-alimentos/, "Premios & Alimentación"],
  ];

  const norm = (s) => (s || "").toString().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const slugify = (s) => norm(s).replace(/&/g, "y").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const cop = (n) => n == null ? null : "$ " + Math.round(n).toLocaleString("es-CO").replace(/,/g, ".");

  function collectionOf(p) {
    if (/^arena-/.test(p.id)) return "Arena";
    if (p.colecciones && p.colecciones.length) return p.colecciones[0];
    for (const [re, c] of RULES) if (re.test(p.id)) return c;
    return "Otros";
  }
  const deptOf = (col) => DEPTS.find((d) => d.cols.includes(col)) || null;

  // "Arnés Honey - Rojo" -> base "Arnés Honey", variante "Rojo"
  function splitName(name) {
    const i = name.lastIndexOf(" - ");
    return i > 0 ? { base: name.slice(0, i).trim(), variant: name.slice(i + 3).trim() } : { base: name.trim(), variant: null };
  }

  // "Tallas: XS, S, L y XL Precios: XS: $48.200 S: $57.800" -> [{size:'XS',price:48200},...]
  function parseSizes(desc) {
    const m = /Precios?:\s*([\s\S]*)$/.exec(desc || "");
    if (!m) return [];
    const out = []; const re = /([A-Za-zÁÉÍÓÚáéíóúñ0-9]{1,12})\s*:\s*\$\s?([\d.]+)/g; let r;
    while ((r = re.exec(m[1]))) out.push({ size: r[1], price: Number(r[2].replace(/\./g, "")) });
    return out;
  }
  // "Presentaciones: Manzana 🍎 Durazno 🍑 Contenido: 2,4 kg" -> ['Manzana','Durazno']
  function parsePresentations(desc) {
    const m = /Presentaciones?:\s*([\s\S]*?)(?:Contenido|Dimensiones|Color|Tallas|$)/.exec(desc || "");
    return m ? (m[1].match(/[A-ZÁÉÍÓÚ][a-záéíóúñ]+/g) || []) : [];
  }
  function dimensions(desc) { const m = /Dimensiones?:\s*([^\n]+?)(?=\s*$|\s+[A-Z][a-z]+:)/.exec(desc || ""); return m ? m[1].trim() : null; }
  function cleanDesc(desc) { return (desc || "").replace(/\s*(Color|Tallas|Precios?|Dimensiones?|Presentaciones?|Contenido):[\s\S]*$/, "").trim(); }

  const SWATCH = { rojo: "#C62128", negro: "#232323", negra: "#232323", verde: "#3E7F4A", azul: "#2459A8", durazno: "#F2A27C", rosado: "#F08DB4", rosada: "#F08DB4", "rosado claro": "#F7BCD2", "rosado oscuro": "#D94C86", gris: "#9A9A9A", amarillo: "#F2C230", morado: "#7B3FA0", camuflado: "#6B6A3E", beige: "#D9C7A7", fucsia: "#D6247F", turquesa: "#2BB5B0" };
  const swatchOf = (v) => SWATCH[norm(v)] || null;

  const SYN = { gato: ["gato", "arena", "arenera", "minino"], perro: ["perro", "arnes", "correa", "collar"], cama: ["cama"], juguete: ["juguete", "lazo", "peluche", "tpr"], arena: ["arena", "tofu", "arenera"], comida: ["comedero", "bebedero", "premio", "dispensador"], paseo: ["arnes", "correa", "collar", "transportador", "portabolsas"] };
  function matches(p, q) {
    const hay = norm([p.nombre, p._col, p.descripcion].join(" "));
    return norm(q).split(/\s+/).filter(Boolean).every((t) => {
      const stem = t.replace(/(es|s)$/, "");
      const alts = SYN[stem] || [stem];
      return alts.some((a) => hay.includes(a));
    });
  }

  // Estimado de entrega en Bogotá/Soacha si el equipo confirma en el momento `date` (hora America/Bogota).
  function deliveryEstimate(date) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(date).map((x) => [x.type, x.value]));
    const day = parts.weekday; const mins = (Number(parts.hour) % 24) * 60 + Number(parts.minute);
    if (day === "Sun") return { when: "el lunes", window: "11 a. m. y 1 p. m.", note: "Domingos y festivos coordinamos la entrega contigo por WhatsApp." };
    if (mins < 600) return { when: "hoy", window: "11 a. m. y 1 p. m." };
    if (mins < 780) return { when: "hoy", window: "1 p. m. y 4 p. m." };
    return { when: day === "Sat" ? "el lunes" : "mañana", window: "11 a. m. y 1 p. m." };
  }

  function waMessage(lines, dest) {
    let sub = 0; const out = ["¡Hola Dögker! Quiero hacer este pedido 🐾", ""];
    lines.forEach((l, i) => {
      const t = l.price != null ? l.price * l.qty : null; if (t != null) sub += t;
      out.push(`${i + 1}. ${l.name}${l.variant ? " — " + l.variant : ""}`);
      out.push(`   Ref: ${l.ref} · ${l.qty} × ${l.price != null ? cop(l.price) : "precio por confirmar"}${t != null ? " = " + cop(t) : ""}`);
    });
    out.push("", `Subtotal: ${cop(sub)}`, `Entrega: ${dest}`, "Envío: por confirmar según la zona", "", "Entiendo que es una solicitud pendiente de confirmación de disponibilidad y entrega.");
    // api.WA_NUMBER se lee al llamar: la tienda lo reemplaza por el número editado en el panel.
    return { text: out.join("\n"), url: `https://wa.me/${api.WA_NUMBER}?text=${encodeURIComponent(out.join("\n"))}`, subtotal: sub };
  }

  // Fotos propias del sitio (/imagenes/…) existen en WebP 1080 y miniatura 540; las subidas al bucket se usan tal cual.
  const pic = (url, small) => (/^\/imagenes\/[^?#]+\.(jpe?g|png|webp)$/i.test(url || "") ? url.replace(/\.(jpe?g|png|webp)$/i, small ? "-540.webp" : ".webp") : url);

  const api = { pic, WA_NUMBER: "573125575932", DEPTS, norm, slugify, cop, collectionOf, deptOf, splitName, parseSizes, parsePresentations, dimensions, cleanDesc, swatchOf, matches, deliveryEstimate, waMessage };
  root.DK = api; // window.DK en el navegador, globalThis.DK en Node (tests y seed)
})(globalThis);
