/* =========================================================
   Almacenamiento de la demo: reportes de ejemplo + los nuevos
   que se cargan en este navegador (localStorage). También arma
   la cabecera y el pie compartidos y el tamaño de letra.
   ========================================================= */
(function () {
  "use strict";
  var E = window.EMERG;
  var KEY_NUEVOS = "lt-em-reportes-v2";
  var KEY_CAMBIOS = "lt-em-cambios-v2";   // { id: { estado, verificado, falsos } } hechos sobre cualquier reporte
  var KEY_MARCADOS = "lt-em-marcados-v2"; // ids que este navegador ya marcó como falsos
  var KEY_MIOS = "lt-em-mios-v2";         // ids enviados desde este navegador
  var FALSOS_PARA_OCULTAR = 3;            // con estas marcas, un aviso sin verificar sale del mapa público
  var root = document.documentElement;
  root.classList.remove("no-js");

  function ls(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(key);
      if (val === null) localStorage.removeItem(key);
      else localStorage.setItem(key, val);
    } catch (e) { return null; }
  }
  function leerJSON(key, def) {
    try { return JSON.parse(ls(key)) || def; } catch (e) { return def; }
  }

  // Las fechas de ejemplo se calculan una vez por sesión para que no "envejezcan".
  var base = Date.now();
  var ejemplos = E.ejemplos.map(function (r) {
    var c = Object.assign({}, r);
    c.fecha = base - r.hace * 60000;
    delete c.hace;
    return c;
  });

  function todos() {
    var cambios = leerJSON(KEY_CAMBIOS, {});
    return ejemplos.concat(leerJSON(KEY_NUEVOS, [])).map(function (r) {
      var c = Object.assign({ falsos: 0, verificado: false, publico: true, ref: "" }, r, cambios[r.id] || {});
      c.cerrado = c.estado === "atendido" || c.estado === "descartado";
      return c;
    });
  }

  // Lo que ve cualquier vecino: sin descartados, sin privados y sin los que varios marcaron como falsos.
  function esPublico(r) {
    return r.publico && r.estado !== "descartado" && (r.verificado || r.falsos < FALSOS_PARA_OCULTAR);
  }

  function proximoId() {
    var max = todos().reduce(function (m, r) { return Math.max(m, parseInt(r.id.slice(3), 10) || 0); }, 0);
    return "LT-" + String(max + 1).padStart(4, "0");
  }

  function soloDigitos(t) { return String(t || "").replace(/\D/g, ""); }

  // Un mismo teléfono no puede tener dos avisos abiertos: si ya existe, se actualiza el anterior.
  function agregar(r) {
    var nuevos = leerJSON(KEY_NUEVOS, []);
    var tel = soloDigitos(r.tel);
    var previo = todos().filter(function (x) { return !x.cerrado && soloDigitos(x.tel) === tel; })[0];
    var mios = leerJSON(KEY_MIOS, []);
    if (previo) {
      var i = nuevos.map(function (x) { return x.id; }).indexOf(previo.id);
      var act = Object.assign({}, previo, r, { id: previo.id, fecha: Date.now(), estado: previo.estado, actualizado: true });
      delete act.cerrado;
      if (i >= 0) nuevos[i] = act; else nuevos.push(act); // un ejemplo actualizado pasa a guardarse como nuevo
      ls(KEY_NUEVOS, JSON.stringify(nuevos));
      if (mios.indexOf(act.id) < 0) { mios.push(act.id); ls(KEY_MIOS, JSON.stringify(mios)); }
      return act;
    }
    r.id = proximoId();
    r.fecha = Date.now();
    r.estado = "pendiente";
    r.nuevo = true;
    if (r.publico === undefined) r.publico = true;
    nuevos.push(r);
    ls(KEY_NUEVOS, JSON.stringify(nuevos));
    mios.push(r.id); ls(KEY_MIOS, JSON.stringify(mios));
    return r;
  }

  // Último aviso abierto enviado desde este navegador (para no cargar el mismo dos veces).
  function miAvisoAbierto() {
    var mios = leerJSON(KEY_MIOS, []);
    return todos().filter(function (r) { return mios.indexOf(r.id) >= 0 && !r.cerrado; }).pop() || null;
  }

  function cambiar(id, datos) {
    var cambios = leerJSON(KEY_CAMBIOS, {});
    cambios[id] = Object.assign(cambios[id] || {}, datos);
    ls(KEY_CAMBIOS, JSON.stringify(cambios));
  }
  function cambiarEstado(id, estado) { cambiar(id, { estado: estado }); }

  function yaMarcado(id) { return leerJSON(KEY_MARCADOS, []).indexOf(id) >= 0; }
  function marcarFalso(id) {
    if (yaMarcado(id)) return false;
    var r = todos().filter(function (x) { return x.id === id; })[0];
    if (!r) return false;
    cambiar(id, { falsos: (r.falsos || 0) + 1 });
    var m = leerJSON(KEY_MARCADOS, []); m.push(id); ls(KEY_MARCADOS, JSON.stringify(m));
    return true;
  }

  function reiniciar() { [KEY_NUEVOS, KEY_CAMBIOS, KEY_MARCADOS, KEY_MIOS].forEach(function (k) { ls(k, null); }); }

  // Urgentes pendientes primero; dentro de cada grupo, lo más reciente arriba.
  function ordenar(lista) {
    function peso(r) { return (r.estado === "descartado" ? 8 : 0) + (r.estado === "atendido" ? 4 : 0) + (r.nivel === "urgente" ? 0 : 2) + (r.estado === "en-camino" ? 1 : 0); }
    return lista.slice().sort(function (a, b) { return peso(a) - peso(b) || b.fecha - a.fecha; });
  }

  /* ---------- Utilidades de presentación ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hace(ts) {
    var min = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (min < 1) return "recién";
    if (min < 60) return "hace " + min + " min";
    var h = Math.round(min / 60);
    if (h < 24) return "hace " + h + (h === 1 ? " hora" : " horas");
    var d = Math.round(h / 24);
    return "hace " + d + (d === 1 ? " día" : " días");
  }
  function telHref(t) { return "tel:" + String(t).replace(/[^\d+]/g, ""); }
  function necesidad(id) { return E.necesidades.filter(function (n) { return n.id === id; })[0]; }
  var NIVEL = {
    urgente: { label: "Urgente", icon: "fa-triangle-exclamation" },
    leve: { label: "Leve", icon: "fa-droplet" }
  };
  var ESTADO = {
    "pendiente": { label: "Esperando ayuda", icon: "fa-hourglass-half" },
    "en-camino": { label: "Ayuda en camino", icon: "fa-truck" },
    "atendido": { label: "Atendido", icon: "fa-circle-check" },
    "descartado": { label: "Descartado (falso)", icon: "fa-ban" }
  };

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("toast"); if (!t) return;
    t.querySelector("span").textContent = msg;
    t.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("is-visible"); }, 2800);
  }

  /* ---------- Cabecera, pie y accesibilidad ---------- */
  var cab = document.getElementById("em-header");
  if (cab) {
    var volver = cab.getAttribute("data-volver");
    cab.outerHTML =
      '<a class="skip-link" href="#main">Saltar al contenido</a>' +
      '<header class="em-header"><div class="em-wrap em-header__in">' +
        (volver
          ? '<a class="em-back" href="' + volver + '"><i class="fa-solid fa-arrow-left"></i><span>Volver</span></a>'
          : '') +
        '<a class="em-brand" href="index.html" aria-label="Emergencia El Niño — Inicio">' +
          '<img src="assets/img/escudo-256.png" alt="" width="44" height="44">' +
          '<span><small>Municipalidad de</small><b>Las Toscas</b></span>' +
        '</a>' +
        '<div class="em-tools">' +
          '<button type="button" data-font="-1" aria-label="Letra más chica" title="Letra más chica">A-</button>' +
          '<button type="button" data-font="1" aria-label="Letra más grande" title="Letra más grande">A+</button>' +
          '<button type="button" id="themeToggle" aria-pressed="false" aria-label="Activar modo oscuro" title="Modo oscuro"><i class="fa-solid fa-moon"></i></button>' +
        '</div>' +
      '</div></header>';
  }
  var pie = document.getElementById("em-footer");
  if (pie) {
    pie.outerHTML =
      '<footer class="em-footer">' +
        '<div class="em-wrap">' +
          '<p class="em-footer__title"><i class="fa-solid fa-phone"></i> Teléfonos de emergencia — tocá para llamar</p>' +
          '<div class="em-phones">' +
            E.telefonos.map(function (t) {
              return '<a href="tel:' + t.num + '"><i class="fa-solid ' + t.icon + '"></i><span>' + t.label + '</span><b>' + t.num + '</b></a>';
            }).join("") +
          '</div>' +
          '<p class="em-footer__muni">Municipalidad de Las Toscas · <a href="' + E.muni.telefonoHref + '">' + E.muni.telefono + '</a> · <a href="https://grossomaximiliano.github.io/MUNI_LAND/">Sitio principal</a></p>' +
          '<p class="em-footer__demo">Maqueta de presentación · Datos de ejemplo</p>' +
        '</div>' +
      '</footer>' +
      '<div class="toast" id="toast" role="status" aria-live="polite"><i class="fa-solid fa-circle-check"></i><span></span></div>';
  }

  // Tamaño de letra propio del mini-sitio (arranca más grande que el sitio principal).
  var size = parseInt(ls("lt-em-font"), 10) || 18;
  function aplicarLetra() { root.style.setProperty("--fs-base", size + "px"); }
  aplicarLetra();
  Array.prototype.forEach.call(document.querySelectorAll("[data-font]"), function (b) {
    b.addEventListener("click", function () {
      size = Math.min(24, Math.max(16, size + parseInt(b.getAttribute("data-font"), 10) * 2));
      aplicarLetra(); ls("lt-em-font", size);
      window.dispatchEvent(new Event("resize"));
    });
  });

  // Modo oscuro compartido con el sitio principal (misma clave "lt-theme").
  var themeBtn = document.getElementById("themeToggle");
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  function setDark(on) {
    root.classList.toggle("dark-mode", on);
    if (themeMeta) themeMeta.setAttribute("content", on ? "#061423" : "#0b2a4a");
    if (themeBtn) {
      themeBtn.setAttribute("aria-pressed", on ? "true" : "false");
      themeBtn.setAttribute("aria-label", on ? "Desactivar modo oscuro" : "Activar modo oscuro");
      themeBtn.innerHTML = '<i class="fa-solid ' + (on ? "fa-sun" : "fa-moon") + '"></i>';
    }
  }
  setDark(root.classList.contains("dark-mode"));
  if (themeBtn) themeBtn.addEventListener("click", function () {
    var on = !root.classList.contains("dark-mode");
    setDark(on); ls("lt-theme", on ? "dark" : "light");
  });

  /* ---------- Mapa y tarjetas (requieren Leaflet en la página) ---------- */
  function crearMapa(el, zoom) {
    var map = L.map(el, { scrollWheelZoom: false, tap: true }).setView(E.centro, zoom || 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
    map.on("focus", function () { map.scrollWheelZoom.enable(); });
    map.on("blur", function () { map.scrollWheelZoom.disable(); });
    return map;
  }
  function icono(r) {
    var cls = "em-pin em-pin--" + (r.cerrado ? "atendido" : r.nivel);
    var s = r.cerrado ? 18 : r.nivel === "urgente" ? 30 : 22;
    return L.divIcon({ className: "", html: '<div class="' + cls + '"></div>', iconSize: [s, s], iconAnchor: [s / 2, s / 2], popupAnchor: [0, -s / 2] });
  }

  // opts.acciones: "publico" (llamar + cómo llegar + marcar falso) o "panel" (verificar y cambiar estado)
  function tarjeta(r, opts) {
    opts = opts || {};
    var n = NIVEL[r.nivel], e = ESTADO[r.estado] || ESTADO.pendiente;
    var necesita = (r.necesita || []).map(function (id) {
      var x = necesidad(id); return x ? "<span>" + esc(x.label) + "</span>" : "";
    }).join("");
    var mapsUrl = "https://www.google.com/maps/dir/?api=1&destination=" + r.lat + "," + r.lng;
    var acciones = "";
    if (opts.acciones === "publico") {
      acciones =
        '<div class="em-card__actions">' +
          '<a class="em-btn em-btn--ok em-btn--sm" href="' + telHref(r.tel) + '"><i class="fa-solid fa-phone"></i>Llamar</a>' +
          '<a class="em-btn em-btn--outline em-btn--sm" href="' + mapsUrl + '" target="_blank" rel="noopener"><i class="fa-solid fa-route"></i>Cómo llegar</a>' +
        '</div>' +
        (r.verificado ? '' : yaMarcado(r.id)
          ? '<p class="em-card__flag is-done"><i class="fa-solid fa-check"></i>Gracias, el Municipio lo va a revisar.</p>'
          : '<button class="em-card__flag" type="button" data-falso="' + r.id + '"><i class="fa-regular fa-flag"></i>¿Creés que este aviso es falso?</button>');
    } else if (opts.acciones === "panel") {
      var b = function (estado, cls, icon, txt) {
        return '<button class="em-btn em-btn--' + cls + ' em-btn--sm" type="button" data-estado="' + estado + '" data-id="' + r.id + '"><i class="fa-solid ' + icon + '"></i>' + txt + '</button>';
      };
      acciones = r.estado === "descartado"
        ? '<div class="em-card__actions em-card__actions--1">' + b("pendiente", "outline", "fa-rotate-left", "Restaurar aviso") + '</div>'
        : '<div class="em-card__actions">' +
            '<a class="em-btn em-btn--outline em-btn--sm" href="' + telHref(r.tel) + '"><i class="fa-solid fa-phone"></i>Llamar</a>' +
            (r.verificado
              ? '<button class="em-btn em-btn--outline em-btn--sm" type="button" disabled><i class="fa-solid fa-shield-halved"></i>Verificado</button>'
              : '<button class="em-btn em-btn--primary em-btn--sm" type="button" data-verificar="' + r.id + '"><i class="fa-solid fa-shield-halved"></i>Verificar</button>') +
            (r.estado === "pendiente" ? b("en-camino", "primary", "fa-truck", "En camino") : b("pendiente", "outline", "fa-rotate-left", "Pendiente")) +
            (r.estado !== "atendido" ? b("atendido", "ok", "fa-check", "Atendido") : '<button class="em-btn em-btn--outline em-btn--sm" type="button" disabled><i class="fa-solid fa-check"></i>Listo</button>') +
            (r.verificado ? '' : '<button class="em-card__discard" type="button" data-estado="descartado" data-id="' + r.id + '"><i class="fa-solid fa-ban"></i>Descartar: es falso</button>') +
          '</div>';
    }
    var alerta = opts.acciones === "panel" && r.falsos && !r.verificado && r.estado !== "descartado"
      ? '<p class="em-card__warn"><i class="fa-solid fa-flag"></i>' + r.falsos + (r.falsos === 1 ? " vecino marcó" : " vecinos marcaron") + ' este aviso como falso' + (r.falsos >= FALSOS_PARA_OCULTAR ? " · oculto del mapa público" : "") + '</p>'
      : "";
    var cls = r.estado === "descartado" ? "descartado" : r.estado === "atendido" ? "atendido" : r.nivel;
    return '<article class="em-card em-card--' + cls + '" data-card="' + r.id + '">' +
      '<div class="em-card__top">' +
        '<span class="em-tag em-tag--' + r.nivel + '"><i class="fa-solid ' + n.icon + '"></i>' + n.label + '</span>' +
        '<span class="em-tag em-tag--estado em-tag--' + r.estado + '"><i class="fa-solid ' + e.icon + '"></i>' + e.label + '</span>' +
        (r.verificado
          ? '<span class="em-tag em-tag--verif"><i class="fa-solid fa-shield-halved"></i>Verificado</span>'
          : '<span class="em-tag em-tag--sinverif">Sin verificar</span>') +
        (r.publico ? '' : '<span class="em-tag em-tag--estado"><i class="fa-solid fa-lock"></i>Privado</span>') +
        (r.porVoz ? '<span class="em-tag em-tag--estado"><i class="fa-solid fa-microphone"></i>Por voz</span>' : '') +
      '</div>' +
      alerta +
      '<div class="em-card__name">' + esc(r.nombre) + '</div>' +
      '<p class="em-card__where"><i class="fa-solid fa-location-dot"></i>' + esc(r.dir) + (r.ref ? ' <span class="em-card__ref">(' + esc(r.ref) + ')</span>' : '') + '</p>' +
      '<p class="em-card__where"><i class="fa-solid fa-phone"></i><a href="' + telHref(r.tel) + '">' + esc(r.tel) + '</a>' +
        (r.personas ? ' · <i class="fa-solid fa-people-roof"></i>' + r.personas + (r.personas == 1 ? " persona" : " personas") : "") + '</p>' +
      (necesita ? '<div class="em-card__needs">' + necesita + '</div>' : '') +
      (r.comentario ? '<p class="em-card__comment">“' + esc(r.comentario) + '”</p>' : '') +
      '<p class="em-card__meta">' + r.id + ' · ' + hace(r.fecha) +
        (opts.verEnMapa ? ' · <button class="em-card__see" type="button" data-ver="' + r.id + '">Ver en el mapa</button>' : '') + '</p>' +
      acciones +
    '</article>';
  }

  window.EM = {
    todos: todos, agregar: agregar, cambiar: cambiar, cambiarEstado: cambiarEstado, reiniciar: reiniciar, ordenar: ordenar,
    esPublico: esPublico, marcarFalso: marcarFalso, miAvisoAbierto: miAvisoAbierto,
    esc: esc, hace: hace, telHref: telHref, necesidad: necesidad, NIVEL: NIVEL, ESTADO: ESTADO, toast: toast,
    crearMapa: crearMapa, icono: icono, tarjeta: tarjeta
  };
})();
