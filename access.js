(function () {
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
    document.body.classList.remove("locked", "role-visitante", "role-operador");
    if (!session) {
      document.body.classList.add("locked");
      return;
    }
    document.body.classList.add("role-" + session.role);
    const who = document.getElementById("access-who");
    if (who) who.textContent = session.label;
  }

  function grant(code) {
    const hit = CODES[code.trim().toUpperCase()];
    if (!hit) return false;
    const session = { role: hit.role, label: hit.label, at: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(session));
    apply(session);
    return true;
  }

  function revoke() {
    sessionStorage.removeItem(KEY);
    apply(null);
  }

  const gate = document.createElement("div");
  gate.id = "access-gate";
  gate.innerHTML = `
    <div class="gate-card">
      <p class="kicker">Aerovolt</p>
      <h1>Aerovolt</h1>
      <p class="subbrand">Agentes virtuales HMO</p>
      <p class="lead">Control de acceso · fase TEST. El sitio público no abre Command ni HMO sin código.</p>
      <form id="access-form">
        <label for="access-code">Código</label>
        <input id="access-code" autocomplete="off" spellcheck="false" />
        <button class="btn primary" type="submit">Entrar</button>
      </form>
      <p id="access-err" hidden>Código no válido.</p>
      <p class="gate-note">Esto no es un login de servidor. Es un cerrojo en el navegador. Cambia los códigos en access.js.</p>
    </div>`;
  document.body.appendChild(gate);

  const bar = document.createElement("div");
  bar.id = "access-bar";
  bar.innerHTML = `<span>Acceso: <strong id="access-who">—</strong></span>
    <button type="button" class="btn ghost" id="access-out">Salir</button>`;
  document.body.appendChild(bar);

  document.getElementById("access-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const ok = grant(document.getElementById("access-code").value);
    const err = document.getElementById("access-err");
    err.hidden = !!ok;
  });
  document.getElementById("access-out").addEventListener("click", revoke);

  apply(current());
})();
