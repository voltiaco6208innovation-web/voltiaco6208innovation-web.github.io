(function () {
  const CATALOGO = {
    nota_precios:
      "En la configuración de Aerovolt no hay tarifas numéricas publicadas. HMO no inventa montos. Toda contratación económica se registra como solicitud o cotización hasta autorización humana.",
    paquetes: [
      { id: "demo_plataforma", nombre: "Demostración de plataforma", estado: "disponible", precio_etiqueta: "Sin tarifa publicada · se agenda demostración", cta: "demo" },
      { id: "solicitud_alcance", nombre: "Solicitud de alcance y cotización", estado: "disponible", precio_etiqueta: "Cotización autorizada · sin precio en catálogo", cta: "cotizacion" },
      { id: "om_inicial", nombre: "O&M fotovoltaico — levantamiento + reporte", estado: "en_implementacion", precio_etiqueta: "No cotizable en automático", cta: "cotizacion" },
      { id: "om_recurrente", nombre: "O&M recurrente — plataforma + historial", estado: "en_implementacion", precio_etiqueta: "Servicio recurrente no tarifado en catálogo", cta: "cotizacion" }
    ],
    capacidades: [
      { id: "ia", nombre: "IA y automatización", estado: "disponible", nota: "Orquestación y bitácora locales. HMO y Command preparan; no cobran solos." },
      { id: "omni", nombre: "Atención omnicanal", estado: "en_implementacion", nota: "Webhook Meta preparado. Sin prueba en vivo." },
      { id: "voz", nombre: "Voz con IA (Vapi)", estado: "en_implementacion", nota: "Conector preparado. Sin llamada comprobada." },
      { id: "monitoreo", nombre: "Monitoreo y logística O&M", estado: "disponible", nota: "Expediente local de activos e inspecciones declaradas." },
      { id: "drones", nombre: "Drones e inspección", estado: "futura", nota: "Sin aeronave ni API de vuelo conectada." },
      { id: "scada", nombre: "SCADA", estado: "futura", nota: "Sin fuente SCADA conectada." },
      { id: "satelite", nombre: "Información satelital", estado: "en_implementacion", nota: "Capa visual. Sin feed en vivo." }
    ]
  };

  const caps = document.getElementById("caps");
  const packs = document.getElementById("packs");
  const nota = document.getElementById("precio-nota");
  if (nota) nota.textContent = CATALOGO.nota_precios;
  if (caps) {
    caps.innerHTML = CATALOGO.capacidades.map((c) =>
      `<li><span class="estado ${c.estado}">${c.estado.replace("_", " ")}</span><h3>${c.nombre}</h3><p>${c.nota}</p></li>`
    ).join("");
  }
  if (packs) {
    packs.innerHTML = CATALOGO.paquetes.map((p) =>
      `<li><span class="estado ${p.estado}">${p.estado.replace("_", " ")}</span><h3>${p.nombre}</h3><p>${p.precio_etiqueta}</p><button type="button" class="btn ghost" data-open-agent="${p.cta}">Pedir a HMO</button></li>`
    ).join("");
  }

  const root = document.createElement("div");
  root.id = "av-agent";
  root.innerHTML = `
    <button type="button" class="av-toggle" aria-label="Abrir HMO">HMO</button>
    <section class="av-panel" hidden>
      <header><strong>HMO</strong><small>Agentes virtuales HMO · vende solo lo configurado · fase TEST</small></header>
      <div class="av-log" id="av-log"></div>
      <div class="av-actions" id="av-actions"></div>
      <form id="av-form"><input id="av-input" autocomplete="off" placeholder="Escribe a HMO…" /><button type="submit">Enviar</button></form>
    </section>`;
  document.body.appendChild(root);

  const logEl = root.querySelector("#av-log");
  const actionsEl = root.querySelector("#av-actions");
  const panel = root.querySelector(".av-panel");
  const toggle = root.querySelector(".av-toggle");
  const form = root.querySelector("#av-form");
  const input = root.querySelector("#av-input");

  function bubble(role, text) {
    const p = document.createElement("p");
    p.className = "av-msg " + role;
    p.textContent = text;
    logEl.appendChild(p);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function reply(text, actions) {
    bubble("agent", text);
    actionsEl.innerHTML = "";
    (actions || []).forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = a.label;
      b.addEventListener("click", () => {
        bubble("user", a.label);
        think(a.id);
      });
      actionsEl.appendChild(b);
    });
  }

  function think(key, message) {
    const t = ((message || key || "") + "").toLowerCase();
    const actions = [
      { id: "demo", label: "Agendar demo" },
      { id: "cotizacion", label: "Pedir cotización" },
      { id: "om", label: "Hablar de O&M" }
    ];
    if (t.includes("hmo") || t === "hola") {
      return reply("Soy HMO, agente virtual de Aerovolt.IA. Puedo agendar una demo de Command o tomar una solicitud de alcance. No publico tarifas ni cobro solo.", actions);
    }
    if (t.includes("demo")) {
      return reply("HMO puede registrar una solicitud de demostración de Command. En TEST un humano confirma horario. No hay tarifa publicada.", actions);
    }
    if (t.includes("cotiz") || t.includes("precio") || t.includes("cuanto") || t.includes("cuesta")) {
      return reply(CATALOGO.nota_precios, actions);
    }
    if (t.includes("om") || t.includes("o&m") || t.includes("planta") || t.includes("solar")) {
      return reply("O&M está en implementación: expediente sí; campo, dron y SCADA no conectados. HMO deja la solicitud de alcance.", actions);
    }
    if (t.includes("vapi") || t.includes("voz") || t.includes("llamar")) {
      return reply("Vapi está preparado en configuración. HMO aún no hace llamadas comprobadas.", actions);
    }
    if (t.includes("stripe") || t.includes("pagar") || t.includes("cobro")) {
      return reply("Stripe checkout no está habilitado. HMO deja el cobro en cola hasta autorización humana.", actions);
    }
    return reply("HMO · Aerovolt.IA · fase TEST. Demo, alcance u O&M. Sin montos inventados ni operación en vivo declarada.", actions);
  }

  toggle.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden && !logEl.childElementCount) think("hola");
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    bubble("user", text);
    input.value = "";
    think(text, text);
  });
  document.querySelectorAll("[data-open-agent]").forEach((el) => {
    el.addEventListener("click", () => {
      panel.hidden = false;
      const k = el.getAttribute("data-open-agent");
      bubble("user", el.textContent.trim());
      think(k, k);
    });
  });
})();
