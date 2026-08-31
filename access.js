(function () {
  const header = document.querySelector(".top");
  const toggle = document.querySelector(".nav-toggle");
  if (header && toggle) {
    toggle.addEventListener("click", function () {
      const open = header.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    });
    header.querySelectorAll("nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        header.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Abrir menú");
      });
    });
  }

  if (!document.body.hasAttribute("data-require-access")) return;

  const KEY = "aerovolt_access";
  const CODES = {
    AEROVOLT: { role: "visitante", label: "Visitante" },
    "HMO-COMMAND": { role: "operador", label: "Operador" }
  };

  function current() {
    try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); }
    catch (e) { return null; }
  }

  function apply(session) {
    document.body.classList.toggle("locked", !session);
    if (session) document.body.classList.add("role-" + session.role);
  }

  function grant(code) {
    const hit = CODES[String(code || "").trim().toUpperCase()];
    if (!hit) return false;
    sessionStorage.setItem(KEY, JSON.stringify({ role: hit.role, label: hit.label, at: Date.now() }));
    apply(current());
    return true;
  }

  const gate = document.createElement("div");
  gate.id = "access-gate";
  gate.innerHTML = `<div class="gate-card"><p class="kicker">Aerovolt</p><h1>Command</h1><p class="subbrand">Acceso operador · fase TEST</p><form id="access-form"><label for="access-code">Código</label><input id="access-code" autocomplete="off" /><button class="btn primary" type="submit">Entrar</button></form><p id="access-err" hidden>Código no válido.</p><p class="gate-note">Código operador: HMO-COMMAND</p></div>`;
  document.body.appendChild(gate);
  document.getElementById("access-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const ok = grant(document.getElementById("access-code").value);
    document.getElementById("access-err").hidden = !!ok;
  });
  apply(current());
})();
