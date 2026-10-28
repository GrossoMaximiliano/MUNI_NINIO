/* =========================================================
   Panel municipal: priorizar, cambiar estado y exportar.
   ========================================================= */
(function () {
  "use strict";
  var E = window.EMERG;
  var KEY_SESION = "lt-em-panel";
  var login = document.getElementById("login");
  var panel = document.getElementById("panel");
  var lista = document.getElementById("lista");
  var fNivel = document.getElementById("fNivel");
  var fVerif = document.getElementById("fVerif");
  var fEstado = document.getElementById("fEstado");
  var mapa, capa, marcadores = {};

  function sesion(val) {
    try { if (val === undefined) return sessionStorage.getItem(KEY_SESION); sessionStorage.setItem(KEY_SESION, val); } catch (e) { return null; }
  }

  function entrar() {
    login.hidden = true;
    panel.hidden = false;
    sesion("1");
    if (!mapa) {
      mapa = EM.crearMapa("mapa", 14);
      capa = L.layerGroup().addTo(mapa);
    }
    pintar();
    setTimeout(function () { mapa.invalidateSize(); }, 50);
  }
  document.getElementById("entrar").addEventListener("click", entrar);
  if (sesion() === "1") entrar();

  function filtrados(todos) {
    return todos.filter(function (r) {
      if (fNivel.value && r.nivel !== fNivel.value) return false;
      if (fVerif.value === "si" && !r.verificado) return false;
      if (fVerif.value === "no" && r.verificado) return false;
      if (fVerif.value === "marcados" && !(r.falsos > 0)) return false;
      if (fEstado.value === "abiertos") return !r.cerrado;
      return !fEstado.value || r.estado === fEstado.value;
    });
  }

  function pintar() {
    var todos = EM.ordenar(EM.todos());
    var abiertos = todos.filter(function (r) { return !r.cerrado; });
    document.getElementById("kUrg").textContent = abiertos.filter(function (r) { return r.nivel === "urgente" && r.estado === "pendiente"; }).length;
    document.getElementById("kLeve").textContent = abiertos.filter(function (r) { return r.nivel === "leve" && r.estado === "pendiente"; }).length;
    document.getElementById("kSinVerif").textContent = abiertos.filter(function (r) { return !r.verificado; }).length;
    document.getElementById("kPers").textContent = abiertos.reduce(function (s, r) { return s + (r.personas || 1); }, 0);

    var vs = filtrados(todos);
    document.getElementById("cuenta").textContent = vs.length + (vs.length === 1 ? " reporte" : " reportes");
    lista.innerHTML = vs.length
      ? vs.map(function (r) { return EM.tarjeta(r, { acciones: "panel", verEnMapa: true }); }).join("")
      : '<div class="em-empty">No hay reportes con estos filtros.</div>';

    capa.clearLayers();
    marcadores = {};
    vs.slice().reverse().forEach(function (r) {
      marcadores[r.id] = L.marker([r.lat, r.lng], { icon: EM.icono(r), title: r.nombre })
        .bindPopup(EM.tarjeta(r), { maxWidth: 300 }).addTo(capa);
    });
  }

  [fNivel, fVerif, fEstado].forEach(function (s) { s.addEventListener("change", pintar); });

  lista.addEventListener("click", function (e) {
    var v0 = e.target.closest("[data-verificar]");
    if (v0) {
      EM.cambiar(v0.getAttribute("data-verificar"), { verificado: true });
      EM.toast(v0.getAttribute("data-verificar") + ": verificado por teléfono");
      pintar();
      return;
    }
    var b = e.target.closest("[data-estado]");
    if (b) {
      var estado = b.getAttribute("data-estado");
      if (estado === "descartado" && !confirm("¿Descartar este aviso como falso? Deja de verse en el mapa público.")) return;
      EM.cambiarEstado(b.getAttribute("data-id"), estado);
      EM.toast(b.getAttribute("data-id") + ": " + EM.ESTADO[estado].label);
      pintar();
      return;
    }
    var v = e.target.closest("[data-ver]");
    if (v && marcadores[v.getAttribute("data-ver")]) {
      var m = marcadores[v.getAttribute("data-ver")];
      if (window.innerWidth < 1000) document.getElementById("mapa").scrollIntoView({ behavior: "smooth", block: "center" });
      mapa.setView(m.getLatLng(), 16);
      m.openPopup();
    }
  });

  document.getElementById("csv").addEventListener("click", function () {
    var cols = ["id", "nivel", "estado", "verificado", "falsos", "nombre", "tel", "dir", "ref", "personas", "necesita", "comentario", "lat", "lng", "fecha"];
    function celda(v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; }
    var filas = filtrados(EM.ordenar(EM.todos())).map(function (r) {
      return cols.map(function (c) {
        if (c === "fecha") return celda(new Date(r.fecha).toLocaleString("es-AR"));
        if (c === "necesita") return celda((r.necesita || []).map(function (id) { var n = EM.necesidad(id); return n ? n.label : id; }).join(" / "));
        return celda(r[c]);
      }).join(";");
    });
    var blob = new Blob(["﻿" + [cols.join(";")].concat(filas).join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "afectados-el-nino-las-toscas.csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  document.getElementById("reset").addEventListener("click", function () {
    if (!confirm("¿Borrar los avisos cargados en esta compu y volver a los datos de ejemplo?")) return;
    EM.reiniciar();
    pintar();
    EM.toast("Demo reiniciada");
  });
})();
