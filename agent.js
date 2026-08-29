(function () {
  const CATALOGO = {
    nota_precios:
      "Chatbot IA PyME / Starter: regular $2,500 MXN/mes. Promo 3 días: contratación $1,800 MXN = anticipo $720 + saldo $1,080 ($500 + $500 + $80). Los $500 no son la mensualidad permanente.",
    paquetes: [
      { id: "starter_pyme", nombre: "Chatbot IA PyME / Starter", estado: "disponible", precio_etiqueta: "Regular $2,500 MXN/mes · promo $1,800", cta: "starter" },
      { id: "demo_plataforma", nombre: "Demostración de plataforma", estado: "disponible", precio_etiqueta: "Sin cargo de plataforma · se agenda", cta: "demo" },
      { id: "solicitud_alcance", nombre: "Solicitud de alcance", estado: "disponible", precio_etiqueta: "Cotización autorizada", cta: "cotizacion" },
      { id: "om_inicial", nombre: "O&M fotovoltaico — levantamiento", estado: "en_implementacion", precio_etiqueta: "No cotizable en automático", cta: "om" }
    ],
    capacidades: [
      { id: "ia", nombre: "IA y automatización", estado: "disponible", nota: "HMO y Command preparan; no cobran solos." },
      { id: "omni", nombre: "Omnicanal", estado: "en_implementacion", nota: "Meta preparado. Sin prueba en vivo." },
      { id: "voz", nombre: "Voz con IA", estado: "en_implementacion", nota: "Vapi sin llamada comprobada." },
      { id: "monitoreo", nombre: "O&M", estado: "disponible", nota: "Expediente declarado." },
      { id: "drones", nombre: "Drones", estado: "futura", nota: "Sin aeronave conectada." },
      { id: "scada", nombre: "SCADA", estado: "futura", nota: "Sin fuente conectada." },
      { id: "satelite", nombre: "Satélite", estado: "en_implementacion", nota: "Solo visualización." }
    ]
  };

  const PLAN =
    "Precio regular: $2,500 MXN/mes.\nPromoción 3 días: contratación $1,800 MXN.\nPagas ahora: $720 (40%).\nPendiente: $1,080 en $500 + $500 + $80.\nEso suma $1,800. Los $500 son abonos al saldo de esta promo, no una mensualidad indefinida.";

  const caps = document.getElementById("caps");
  const packs = document.getElementById("packs");
  const nota = document.getElementById("precio-nota");
  if (nota) nota.textContent = CATALOGO.nota_precios;
  if (caps) {
    caps.innerHTML = CATALOGO.capacidades.map((c) =>
      `<li><span class="estado ${c.estado}">${c.estado.replace(/_/g, " ")}</span><h3>${c.nombre}</h3><p>${c.nota}</p></li>`
    ).join("");
  }
  if (packs) {
    packs.innerHTML = CATALOGO.paquetes.map((p) =>
      `<li><span class="estado ${p.estado}">${p.estado.replace(/_/g, " ")}</span><h3>${p.nombre}</h3><p>${p.precio_etiqueta}</p><button type="button" class="btn ghost" data-open-agent="${p.cta}">Pedir a HMO</button></li>`
    ).join("");
  }

  const root = document.createElement("div");
  root.id = "av-agent";
  root.innerHTML = `<button type="button" class="av-toggle" aria-label="Abrir HMO">HMO</button><section class="av-panel" hidden><header><strong>HMO</strong><small>Agente comercial · fase TEST</small></header><div class="av-log" id="av-log"></div><div class="av-actions" id="av-actions"></div><form id="av-form"><input id="av-input" autocomplete="off" placeholder="Escribe a HMO…" /><button type="submit">Enviar</button></form></section>`;
  document.body.appendChild(root);

  const logEl = root.querySelector("#av-log");
  const actionsEl = root.querySelector("#av-actions");
  const panel = root.querySelector(".av-panel");
  const state = { step: "hola", nombre: "", contacto: "" };

  function bubble(role, text) {
    const p = document.createElement("p");
    p.className = "av-msg " + role;
    p.textContent = text;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function actions(list) {
    actionsEl.innerHTML = "";
    list.forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = a.label;
      if (a.pay) b.className = "av-pay";
      b.addEventListener("click", () => { bubble("user", a.label); think(a.id); });
      actionsEl.appendChild(b);
    });
  }

  function saveLead(tipo) {
    const folio = "lead_" + Date.now();
    const row = { folio: folio, tipo: tipo, nombre: state.nombre, contacto: state.contacto, at: new Date().toISOString(), persistencia: "localStorage TEST" };
    const all = JSON.parse(localStorage.getItem("aerovolt_leads") || "[]");
    all.unshift(row);
    localStorage.setItem("aerovolt_leads", JSON.stringify(all.slice(0, 50)));
    return folio;
  }

  function think(key) {
    const t = String(key || "").toLowerCase();
    const menu = [
      { id: "starter", label: "Ver plan Starter" },
      { id: "demo", label: "Agendar demo" },
      { id: "cotizacion", label: "Pedir cotización" },
      { id: "pagar_anticipo", label: "Pagar anticipo $720 MXN", pay: true }
    ];
    if (t === "hola" || t.includes("hablar")) {
      return void (bubble("agent", "Soy HMO. Puedo mostrarte el Starter PyME, agendar demo o registrar el anticipo de $720 MXN. Stripe aún no cobra en GitHub Pages."), actions(menu));
    }
    if (t === "starter" || t.includes("precio") || t.includes("1800") || t.includes("2500")) {
      state.step = "starter";
      return void (bubble("agent", PLAN + "\n¿Lo contratamos? Dime nombre y un correo o teléfono."), actions(menu));
    }
    if (t === "demo") {
      state.step = "demo";
      return void (bubble("agent", "Registro una demo de Command. Nombre y contacto, por favor."), actions(menu));
    }
    if (t === "cotizacion" || t === "om") {
      state.step = "cotizacion";
      return void (bubble("agent", "Dejo solicitud de alcance. O&M de campo no se vende en automático. Nombre y contacto."), actions(menu));
    }
    if (t === "pagar_anticipo" || t.includes("pagar") || t.includes("720")) {
      state.step = "pago";
      if (!state.nombre || !state.contacto) {
        return void (bubble("agent", "Antes del anticipo $720 necesito nombre y contacto. El cobro Stripe no se ejecuta en esta página; queda registrado como pendiente HITL."), actions(menu));
      }
      const folio = saveLead("anticipo_starter_720");
      return void (bubble("agent", "Contratación registrada. Folio " + folio + ". Pagas ahora $720. Saldo $1,080 en $500+$500+$80. Total promo $1,800. No es mensualidad de $500 para siempre. Regular: $2,500 MXN/mes. Stripe Checkout no está abierto aquí (GitHub Pages)."), actions(menu));
    }
    if (!state.nombre && t && !t.includes("@") && t.length > 2 && !/demo|starter|cotiz|pagar|hola/.test(t)) {
      state.nombre = key;
      return void (bubble("agent", "Quedó " + state.nombre + ". Ahora un correo o teléfono."), actions(menu));
    }
    if (!state.contacto && (t.includes("@") || /\d{7,}/.test(t))) {
      state.contacto = key;
      if (state.step === "pago") return think("pagar_anticipo");
      const folio = saveLead(state.step || "solicitud");
      return void (bubble("agent", "Registrado. Folio " + folio + ". HMO guardó esto en este navegador (TEST). Un humano de Aerovolt da seguimiento."), actions(menu));
    }
    bubble("agent", "Dime si quieres Starter, demo, cotización o pagar el anticipo de $720.");
    actions(menu);
  }

  root.querySelector(".av-toggle").addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden && !logEl.childElementCount) think("hola");
  });
  root.querySelector("#av-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = root.querySelector("#av-input");
    const text = input.value.trim();
    if (!text) return;
    bubble("user", text);
    input.value = "";
    think(text);
  });
  document.querySelectorAll("[data-open-agent]").forEach((el) => {
    el.addEventListener("click", () => {
      panel.hidden = false;
      bubble("user", el.textContent.trim());
      think(el.getAttribute("data-open-agent"));
    });
  });
})();
