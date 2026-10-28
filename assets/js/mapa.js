/* =========================================================
   Mapa público de vecinos afectados + lista sincronizada.
   ========================================================= */
(function () {
  "use strict";
  var mapa = EM.crearMapa("mapa", 14);
  var capa = L.layerGroup().addTo(mapa);
  var lista = document.getElementById("lista");
  var verAtendidos = document.getElementById("verAtendidos");
  var filtro = "todos";
  var marcadores = {};
  var datos;
  function cargar() { datos = EM.ordenar(EM.todos().filter(EM.esPublico)); }
  cargar();

  function visibles() {
    return datos.filter(function (r) {
      if (!verAtendidos.checked && r.estado === "atendido") return false;
      return filtro === "todos" || r.nivel === filtro;
    });
  }

  function contar() {
    var abiertos = datos.filter(function (r) { return verAtendidos.checked || r.estado !== "atendido"; });
    document.getElementById("cTodos").textContent = abiertos.length;
    document.getElementById("cUrg").textContent = abiertos.filter(function (r) { return r.nivel === "urgente"; }).length;
    document.getElementById("cLeve").textContent = abiertos.filter(function (r) { return r.nivel === "leve"; }).length;
  }

  // centrar: mover el mapa al punto (desde la lista). Al tocar el punto en el mapa no se mueve:
  // ahí Leaflet corre el mapa lo justo para que el globito entre entero.
  function enfocar(id, abrir, centrar) {
    var m = marcadores[id]; if (!m) return;
    if (centrar) mapa.setView(m.getLatLng(), 16, { animate: false });
    if (abrir) m.openPopup();
    Array.prototype.forEach.call(lista.querySelectorAll(".is-focus"), function (c) { c.classList.remove("is-focus"); });
    var card = lista.querySelector('[data-card="' + id + '"]');
    if (card) card.classList.add("is-focus");
  }

  function pintar() {
    capa.clearLayers();
    marcadores = {};
    var vs = visibles();
    var opc = EM.opcionesGlobo(mapa);
    vs.slice().reverse().forEach(function (r) {   // urgentes al final = quedan arriba en el mapa
      marcadores[r.id] = L.marker([r.lat, r.lng], { icon: EM.icono(r), title: r.nombre + " — " + EM.NIVEL[r.nivel].label })
        .bindPopup(EM.globo(r), opc)
        .on("click", function () { enfocar(r.id, false); })
        .addTo(capa);
    });
    lista.innerHTML = vs.length
      ? vs.map(function (r) { return EM.tarjeta(r, { acciones: "publico", verEnMapa: true }); }).join("")
      : '<div class="em-empty"><i class="fa-solid fa-face-smile"></i><br>No hay vecinos en esta categoría.</div>';
    contar();
  }

  Array.prototype.forEach.call(document.querySelectorAll(".em-filter"), function (b) {
    b.addEventListener("click", function () {
      filtro = b.getAttribute("data-f");
      Array.prototype.forEach.call(document.querySelectorAll(".em-filter"), function (x) {
        x.classList.toggle("is-active", x === b);
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      pintar();
    });
  });
  verAtendidos.addEventListener("change", pintar);

  // "¿Creés que este aviso es falso?" funciona tanto en la lista como dentro del globito del mapa.
  document.addEventListener("click", function (e) {
    var f = e.target.closest("[data-falso]"); if (!f) return;
    if (!confirm("¿Querés avisarle al Municipio que este aviso podría ser falso?\n\nSólo hacelo si estás seguro. Ellos lo van a revisar.")) return;
    EM.marcarFalso(f.getAttribute("data-falso"));
    mapa.closePopup();
    cargar(); pintar();
    EM.toast("Gracias. El Municipio lo va a revisar.");
  });

  // "Ver todo" del globito: baja a la tarjeta completa de la lista.
  document.getElementById("mapa").addEventListener("click", function (e) {
    var v = e.target.closest("[data-ver-lista]"); if (!v) return;
    var id = v.getAttribute("data-ver-lista");
    mapa.closePopup();
    enfocar(id, false);
    var card = lista.querySelector('[data-card="' + id + '"]');
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  lista.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ver]"); if (!b) return;
    document.getElementById("mapa").scrollIntoView({ behavior: "smooth", block: "center" });
    enfocar(b.getAttribute("data-ver"), true, true);
  });

  pintar();

  // Viene desde "Ver mi aviso en el mapa": #LT-0123
  var id = decodeURIComponent(location.hash.slice(1));
  if (id && marcadores[id]) setTimeout(function () { enfocar(id, true, true); }, 300);
})();
