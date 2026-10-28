/* =========================================================
   Asistente de 3 pasos para avisar que una casa está afectada.
   ========================================================= */
(function () {
  "use strict";
  var E = window.EMERG;
  var form = document.getElementById("reporte");
  var pasos = Array.prototype.slice.call(document.querySelectorAll(".em-step"));
  var barras = document.querySelectorAll(".em-progress span");
  var pasoLabel = document.getElementById("pasoLabel");
  var pos = null;     // { lat, lng } elegido por GPS o tocando el mapa
  var mapa, pin;

  // Si desde este navegador ya hay un aviso abierto, se avisa antes de cargar otro (evita duplicados y abusos).
  var previo = EM.miAvisoAbierto();
  if (previo) {
    form.hidden = true;
    document.getElementById("cabecera").hidden = true;
    document.getElementById("yaEnviado").hidden = false;
    document.getElementById("yaNro").textContent = previo.id;
    document.getElementById("yaVer").href = "mapa.html#" + previo.id;
    document.getElementById("yaOtro").addEventListener("click", function () {
      document.getElementById("yaEnviado").hidden = true;
      form.hidden = false;
      document.getElementById("cabecera").hidden = false;
    });
  }

  document.getElementById("needs").innerHTML = E.necesidades.map(function (n) {
    return '<label class="em-need"><input type="checkbox" name="necesita" value="' + n.id + '"><i class="fa-solid ' + n.icon + '"></i>' + EM.esc(n.label) + '</label>';
  }).join("");

  function err(el, on) {
    if (!el) return;
    el.classList.toggle(el.classList.contains("em-error") ? "is-visible" : "has-error", on);
  }

  function ir(n) {
    pasos.forEach(function (p) { p.hidden = p.getAttribute("data-paso") !== String(n); });
    Array.prototype.forEach.call(barras, function (b, i) { b.classList.toggle("is-done", i < n); });
    pasoLabel.textContent = "Paso " + n + " de 3";
    window.scrollTo({ top: 0, behavior: "smooth" });
    var actual = pasos[n - 1];
    actual.focus({ preventScroll: true });
    if (n === 2) iniciarMapa();
  }

  function validar(n) {
    var ok = true;
    if (n >= 2) {
      var nivel = form.querySelector('input[name="nivel"]:checked');
      err(document.getElementById("errNivel"), !nivel);
      if (!nivel) return ir(1), false;
    }
    if (n >= 3) {
      var d = !document.getElementById("dir").value.trim();
      err(document.getElementById("fDir"), d);
      ok = !d;
    }
    return ok;
  }

  Array.prototype.forEach.call(document.querySelectorAll("[data-sig]"), function (btn) {
    btn.addEventListener("click", function () {
      var n = parseInt(btn.getAttribute("data-sig"), 10);
      if (validar(n)) ir(n);
    });
  });
  // Al elegir el nivel se avanza solo: un toque menos para quien no está acostumbrado.
  Array.prototype.forEach.call(form.querySelectorAll('input[name="nivel"]'), function (r) {
    r.addEventListener("change", function () {
      err(document.getElementById("errNivel"), false);
      setTimeout(function () { ir(2); }, 350);
    });
  });
  ["dir", "nombre", "tel"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", function () {
      err(document.getElementById("f" + id.charAt(0).toUpperCase() + id.slice(1)), false);
    });
  });

  /* ---------- Ubicación ---------- */
  var locStatus = document.getElementById("locStatus");
  function marcar(lat, lng, origen) {
    pos = { lat: lat, lng: lng };
    if (pin) pin.setLatLng(pos);
    else pin = L.marker(pos, { draggable: true, icon: L.divIcon({ className: "", html: '<div class="em-pin em-pin--nuevo"></div>', iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(mapa)
      .on("dragend", function (e) { var p = e.target.getLatLng(); marcar(p.lat, p.lng, "mapa"); });
    locStatus.classList.add("is-ok");
    locStatus.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>' +
      (origen === "gps" ? "¡Te encontramos! Si no es exacto, mové el punto azul." : "Ubicación marcada. Podés arrastrar el punto si hace falta.") + '</span>';
  }
  function iniciarMapa() {
    if (mapa) { mapa.invalidateSize(); return; }
    mapa = EM.crearMapa("pickMap", 14);
    mapa.on("click", function (e) { marcar(e.latlng.lat, e.latlng.lng, "mapa"); });
  }
  document.getElementById("btnGeo").addEventListener("click", function () {
    var btn = this;
    if (!navigator.geolocation) { EM.toast("Tu teléfono no permite ubicarte. Tocá el mapa."); return; }
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Buscando…';
    navigator.geolocation.getCurrentPosition(function (p) {
      var lat = p.coords.latitude, lng = p.coords.longitude;
      // Si el GPS da un punto lejos de Las Toscas (por ej. al probar la demo desde otra ciudad), se usa el centro.
      if (Math.abs(lat - E.centro[0]) > .15 || Math.abs(lng - E.centro[1]) > .15) {
        lat = E.centro[0] + (Math.random() - .5) * .01; lng = E.centro[1] + (Math.random() - .5) * .01;
        EM.toast("Estás fuera de Las Toscas: usamos un punto de ejemplo.");
      }
      mapa.setView([lat, lng], 16);
      marcar(lat, lng, "gps");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>Usar mi ubicación actual';
    }, function () {
      EM.toast("No pudimos ubicarte. Tocá el mapa donde está tu casa.");
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>Usar mi ubicación actual';
    }, { enableHighAccuracy: true, timeout: 10000 });
  });

  /* ---------- Envío ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validar(3)) return ir(2);
    var nombre = document.getElementById("nombre").value.trim();
    var tel = document.getElementById("tel").value.trim();
    var acepto = document.getElementById("acepto").checked;
    err(document.getElementById("fNombre"), !nombre);
    err(document.getElementById("fTel"), tel.replace(/\D/g, "").length < 6);
    err(document.getElementById("fConsent"), !acepto);
    err(document.getElementById("errConsent"), !acepto);
    var primerError = form.querySelector('[data-paso="3"] .has-error input');
    if (primerError) { primerError.focus(); return; }
    if (!acepto) return;

    // Sin punto en el mapa, se ubica cerca del centro para que igual aparezca (en la vida real se geocodifica la dirección).
    if (!pos) pos = { lat: E.centro[0] + (Math.random() - .5) * .012, lng: E.centro[1] + (Math.random() - .5) * .012 };
    var r = EM.agregar({
      nivel: form.querySelector('input[name="nivel"]:checked').value,
      nombre: nombre,
      tel: tel,
      dir: document.getElementById("dir").value.trim(),
      ref: document.getElementById("ref").value.trim(),
      lat: pos.lat, lng: pos.lng,
      personas: parseInt(document.getElementById("personas").value, 10) || null,
      necesita: Array.prototype.map.call(form.querySelectorAll('input[name="necesita"]:checked'), function (c) { return c.value; }),
      comentario: document.getElementById("comentario").value.trim()
    });

    form.hidden = true;
    document.getElementById("cabecera").hidden = true;
    document.getElementById("nro").textContent = r.id;
    document.getElementById("listoTxt").textContent = r.actualizado
      ? "Ese teléfono ya tenía un aviso abierto: lo actualizamos con estos datos. El número sigue siendo"
      : "Tu número de aviso es";
    document.getElementById("alerta911").hidden = r.nivel !== "urgente";
    document.getElementById("verMapa").href = "mapa.html#" + r.id;
    var listo = document.getElementById("listo");
    listo.hidden = false;
    window.scrollTo({ top: 0 });
    listo.focus({ preventScroll: true });
  });
})();
