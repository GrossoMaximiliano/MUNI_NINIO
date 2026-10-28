/* =========================================================
   Avisar hablando: conversación tipo WhatsApp con la asistente.
   La asistente manda audios (texto a voz) y el vecino contesta
   grabando con el micrófono (o escribiendo, si prefiere).

   Con IA (sitio publicado): usa el proxy de MuniPoc
     /ia/chat, /ia/speech y /ia/transcribe.
   Sin IA (localhost u otro origen, o si el proxy no responde):
     guión local con la voz y el reconocimiento del navegador.
   ========================================================= */
(function () {
  "use strict";
  var V = window.EM_VOZ, E = window.EMERG;
  var $ = function (id) { return document.getElementById(id); };
  var msgsEl = $("msgs"), pista = $("pista"), mic = $("mic"), micLabel = $("micLabel");
  var reloj = $("reloj"), cancelar = $("cancelar"), filaMic = $("filaMic");
  var formTexto = $("formTexto"), inputTexto = $("texto"), cambiarModo = $("cambiarModo");

  var usarIA = V.origenes.indexOf(location.hostname) >= 0 || /[?&]ia=1\b/.test(location.search);
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var puedeGrabar = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder && window.AudioContext);
  function modoVoz() { return usarIA && puedeGrabar ? "ia" : SR ? "sr" : null; }

  var historial = [];   // { rol: "ia" | "yo" | "fin", texto, voz, extras, hora, audioUrl, estado, dur, deVoz, transcribiendo, reporte }
  var fase = "inicio";  // inicio | sonando | turno | grabando | procesando | fin
  var escribiendo = false;
  var pos = null;
  var terminado = false;

  /* ---------- Utilidades ---------- */
  function hora() { var d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function tiempo(seg) { seg = Math.max(0, Math.round(seg || 0)); return Math.floor(seg / 60) + ":" + String(seg % 60).padStart(2, "0"); }

  /* ---------- Pistas y estado del botón ---------- */
  var PISTAS = {
    inicio: '<i class="fa-solid fa-hand-point-up"></i> Tocá el botón azul <span class="em-k em-k--play"><i class="fa-solid fa-play"></i></span> para escuchar el mensaje',
    sonando: '<i class="fa-solid fa-volume-high"></i> Escuchá el mensaje…',
    turno: 'Ahora tocá el botón <span class="em-k em-k--mic"><i class="fa-solid fa-microphone"></i></span> rojo y contestá hablando',
    grabando: '<span class="em-recdot"></span> Te estoy escuchando. Cuando termines, tocá <span class="em-k em-k--send"><i class="fa-solid fa-paper-plane"></i></span> verde para enviar',
    procesando: '<i class="fa-solid fa-spinner fa-spin"></i> Un momento, por favor…',
    fin: ""
  };
  function setFase(f) {
    fase = f;
    var txt = PISTAS[f];
    if (f === "turno" && escribiendo) txt = '<i class="fa-solid fa-keyboard"></i> Escribí tu respuesta abajo y tocá enviar';
    if (f === "turno" && !modoVoz() && !escribiendo) txt = '<i class="fa-solid fa-keyboard"></i> Tu teléfono no permite grabar audio. Escribí tu respuesta abajo.';
    pista.innerHTML = txt;
    pista.hidden = !txt;
    mic.classList.toggle("is-pulse", f === "turno");
    mic.classList.toggle("is-rec", f === "grabando");
    mic.disabled = f === "procesando" || f === "fin";
    mic.innerHTML = f === "grabando" ? '<i class="fa-solid fa-paper-plane"></i>' : '<i class="fa-solid fa-microphone"></i>';
    mic.setAttribute("aria-label", f === "grabando" ? "Enviar audio" : "Tocá para hablar");
    micLabel.textContent = f === "grabando" ? "Tocá para enviar" : "Tocá para hablar";
    cancelar.hidden = f !== "grabando";
    reloj.hidden = f !== "grabando";
    $("barra").classList.toggle("is-fin", f === "fin" || terminado);
    $("estadoAsistente").textContent = f === "procesando" ? "escribiendo…" : f === "sonando" ? "hablando…" : "en línea";
  }

  /* ---------- Mensajes ---------- */
  function htmlMsg(m, i) {
    if (m.rol === "fin") return htmlFin(m.reporte);
    if (m.rol === "yo") {
      var cuerpo = m.transcribiendo
        ? '<p class="em-msg__text em-msg__muted"><i class="fa-solid fa-spinner fa-spin"></i> Escuchando tu audio…</p>'
        : (m.ubicacion ? '<p class="em-msg__text"><i class="fa-solid fa-location-dot"></i> Te mandé mi ubicación</p>'
          : '<p class="em-msg__text">' + (m.deVoz ? "“" + EM.esc(m.texto) + "”" : EM.esc(m.texto)) + '</p>');
      return '<div class="em-msg em-msg--yo"><div class="em-msg__bubble">' +
        (m.deVoz ? '<div class="em-msg__voice"><i class="fa-solid fa-microphone"></i> Audio' + (m.dur ? " · " + tiempo(m.dur) : "") + '</div>' : "") +
        cuerpo + '<span class="em-msg__time">' + m.hora + ' <i class="fa-solid fa-check-double"></i></span></div></div>';
    }
    var est = m.estado;
    var icono = est === "sonando" ? "fa-pause" : est === "cargando" ? "fa-spinner fa-spin" : "fa-play";
    var extras = "";
    if (m.extras && m.extras.ubicacion && !pos) extras += '<button class="em-btn em-btn--primary em-btn--sm em-msg__action" type="button" data-ubic><i class="fa-solid fa-location-crosshairs"></i>Mandar mi ubicación</button>';
    if (m.extras && m.extras.emergencia) extras += '<a class="em-btn em-btn--urg em-btn--sm em-msg__action" href="tel:911"><i class="fa-solid fa-phone-volume"></i>Llamar al 911</a>';
    if (m.extras && m.extras.cortado) extras += '<a class="em-btn em-btn--ok em-btn--sm em-msg__action" href="tel:103"><i class="fa-solid fa-phone"></i>Llamar a Defensa Civil (103)</a>' +
      '<a class="em-btn em-btn--outline em-btn--sm em-msg__action" href="reportar.html"><i class="fa-solid fa-pen"></i>Usar el formulario</a>';
    return '<div class="em-msg em-msg--ia" data-i="' + i + '"><div class="em-msg__bubble">' +
      '<div class="em-audio' + (est ? " is-" + est : "") + (i === ultimaIA() && fase === "inicio" ? " is-hint" : "") + '">' +
        '<button class="em-audio__play" type="button" data-play="' + i + '" aria-label="' + (est === "sonando" ? "Pausar" : "Escuchar mensaje") + '"><i class="fa-solid ' + icono + '"></i></button>' +
        '<div class="em-audio__track"><span class="em-audio__bar"></span></div>' +
        '<span class="em-audio__dur">' + (m.dur ? tiempo(m.dur) : '<i class="fa-solid fa-volume-high"></i>') + '</span>' +
      '</div>' +
      '<p class="em-msg__text">' + EM.esc(m.texto) + '</p>' + extras +
      '<span class="em-msg__time">' + m.hora + '</span></div></div>';
  }

  function htmlFin(r) {
    return '<div class="em-msg em-msg--fin"><div class="em-chat__done">' +
      '<div class="em-done__icon"><i class="fa-solid fa-check"></i></div>' +
      '<h2>¡Aviso enviado!</h2>' +
      '<p>' + (r.actualizado ? "Actualizamos tu aviso anterior. Número:" : "Tu número de aviso es") + '</p>' +
      '<div class="em-done__nro">' + r.id + '</div>' +
      '<p class="muted">El Municipio te va a llamar al <b>' + EM.esc(r.tel) + '</b> para confirmar.</p>' +
      (r.nivel === "urgente" ? '<a class="em-btn em-btn--urg em-btn--block" href="tel:911"><i class="fa-solid fa-phone-volume"></i>Si hay peligro, llamá al 911</a>' : "") +
      '<a class="em-btn em-btn--primary em-btn--block" href="mapa.html#' + r.id + '"><i class="fa-solid fa-map-location-dot"></i>Ver mi aviso en el mapa</a>' +
      '<a class="em-btn em-btn--outline em-btn--block" href="index.html"><i class="fa-solid fa-house"></i>Volver al inicio</a>' +
    '</div></div>';
  }

  function ultimaIA() { for (var i = historial.length - 1; i >= 0; i--) if (historial[i].rol === "ia") return i; return -1; }

  function pintar() {
    msgsEl.innerHTML = historial.map(htmlMsg).join("") +
      (fase === "procesando" && !historial.some(function (m) { return m.transcribiendo; })
        ? '<div class="em-msg em-msg--ia"><div class="em-msg__bubble em-typing" aria-label="La asistente está escribiendo"><span></span><span></span><span></span></div></div>' : "");
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  /* ---------- Audio de la asistente ---------- */
  var audio = new Audio();
  var sonando = null;

  // El TTS del proxy devuelve PCM 16 bits mono crudo: se le agrega cabecera WAV (igual que MuniPoc).
  function pcmAWav(pcm, rate) {
    var h = new DataView(new ArrayBuffer(44));
    function txt(o, s) { for (var i = 0; i < s.length; i++) h.setUint8(o + i, s.charCodeAt(i)); }
    txt(0, "RIFF"); h.setUint32(4, 36 + pcm.byteLength, true); txt(8, "WAVE");
    txt(12, "fmt "); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
    h.setUint32(24, rate, true); h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true);
    txt(36, "data"); h.setUint32(40, pcm.byteLength, true);
    return new Blob([h.buffer, pcm], { type: "audio/wav" });
  }

  function sintetizar(texto) {
    return fetch(V.apiBase + "/ia/speech", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ input: texto })
    }).then(function (r) {
      if (!r.ok) throw new Error("TTS " + r.status);
      var tipo = r.headers.get("Content-Type") || "";
      var rate = parseInt((tipo.match(/rate=(\d+)/) || [])[1], 10) || 24000;
      return r.arrayBuffer().then(function (buf) {
        return URL.createObjectURL(/wav|mpeg|mp3|ogg/.test(tipo) ? new Blob([buf], { type: tipo }) : pcmAWav(buf, rate));
      });
    });
  }

  function vozLocal() {
    var vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
    return vs.filter(function (v) { return /^es-AR/i.test(v.lang); })[0] ||
      vs.filter(function (v) { return /^es-(US|419|MX)/i.test(v.lang); })[0] ||
      vs.filter(function (v) { return /^es/i.test(v.lang); })[0] || null;
  }
  if (window.speechSynthesis) speechSynthesis.getVoices(); // precarga la lista de voces

  // Un audio nunca corta al anterior: los mensajes nuevos esperan en esta cola.
  var pendientes = [];
  var actual = null;     // mensaje que se está cargando o sonando
  var esperando = false; // hay una respuesta de la IA en camino

  function alTerminar(m) {
    if (sonando === m) sonando = null;
    if (actual === m) actual = null;
    m.estado = null;
    pintar();
    if (pendientes.length) { reproducir(pendientes.shift()); return; }
    setFase(terminado ? "fin" : esperando ? "procesando" : "turno");
  }

  function detener() {
    audio.pause();
    if (window.speechSynthesis) speechSynthesis.cancel();
    if (sonando) { sonando.estado = null; sonando = null; }
  }

  function hablarLocal(m) {
    if (!window.speechSynthesis) { alTerminar(m); return; }
    var u = new SpeechSynthesisUtterance(m.voz || m.texto);
    var v = vozLocal();
    if (v) u.voice = v;
    u.lang = v ? v.lang : "es-AR";
    u.rate = .95;
    // Algunos navegadores no avisan cuando termina la voz: tiempo máximo según el largo del texto.
    var tope = setTimeout(function () { if (sonando === m) { speechSynthesis.cancel(); alTerminar(m); } }, 2000 + u.text.split(/\s+/).length * 500);
    u.onend = u.onerror = function () { clearTimeout(tope); if (sonando === m) alTerminar(m); };
    sonando = m; m.estado = "sonando";
    pintar(); setFase("sonando");
    speechSynthesis.speak(u);
  }

  function reproducir(m) {
    if (m === sonando) { detener(); actual = null; pintar(); setFase(terminado ? "fin" : esperando ? "procesando" : "turno"); return; }
    terminarGrabacion(true);
    detener();
    actual = m;
    // Audio pregrabado o voz del navegador: no gastan IA. Sólo se genera voz para respuestas nuevas.
    if (m.local || (!usarIA && !m.audioUrl)) { hablarLocal(m); return; }
    m.estado = "cargando"; pintar(); setFase("sonando");
    (m.audioUrl ? Promise.resolve(m.audioUrl) : sintetizar(m.voz || m.texto)).then(function (url) {
      m.audioUrl = url;
      audio.src = url;
      sonando = m; m.estado = "sonando";
      pintar();
      return audio.play();
    }).catch(function (e) {
      if (e && e.name === "NotAllowedError") { m.estado = null; sonando = null; actual = null; pintar(); setFase("inicio"); return; }
      hablarLocal(m); // si el proxy no responde, lee la voz del navegador
    });
  }

  audio.addEventListener("loadedmetadata", function () {
    if (sonando && isFinite(audio.duration)) { sonando.dur = audio.duration; var d = msgsEl.querySelector('[data-i="' + historial.indexOf(sonando) + '"] .em-audio__dur'); if (d) d.textContent = tiempo(audio.duration); }
  });
  audio.addEventListener("timeupdate", function () {
    if (!sonando || !audio.duration) return;
    var bar = msgsEl.querySelector('[data-i="' + historial.indexOf(sonando) + '"] .em-audio__bar');
    if (bar) bar.style.width = (audio.currentTime / audio.duration * 100) + "%";
  });
  audio.addEventListener("ended", function () { if (sonando) alTerminar(sonando); });

  /* ---------- Mensajes de la asistente ---------- */
  // opts.audioUrl: audio pregrabado (no se genera). opts.local: leer con la voz del navegador (gratis).
  function decir(texto, extras, reporte, opts) {
    opts = opts || {};
    var m = { rol: "ia", texto: texto, extras: extras || {}, hora: hora(), audioUrl: opts.audioUrl, local: opts.local };
    historial.push(m);
    if (reporte) {
      terminado = true;
      historial.push({ rol: "fin", reporte: reporte });
      $("barra").classList.add("is-fin");
    }
    pintar();
    if (actual) pendientes.push(m); else reproducir(m);
  }

  // Interpreta la respuesta (de la IA o del guión): etiquetas [UBICACION] y [911], y el bloque <REPORTE>.
  function procesar(raw) {
    esperando = false;
    if (raw == null) { if (!actual) setFase(terminado ? "fin" : "turno"); pintar(); return; } // el guión no tenía nada que agregar
    var txt = String(raw || "");
    var rep = null;
    var mR = txt.match(/<REPORTE>([\s\S]*?)<\/REPORTE>/i);
    if (mR) { try { rep = JSON.parse(mR[1]); } catch (e) { rep = null; } }
    txt = txt.replace(/<REPORTE>[\s\S]*?(<\/REPORTE>|$)/i, "");
    var extras = { ubicacion: /\[UBICACION\]/i.test(txt), emergencia: /\[911\]/.test(txt) };
    txt = txt.replace(/\[(UBICACION|911)\]/gi, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\s+\n/g, "\n").trim();
    // El cierre siempre es el audio pregrabado: no se paga voz por la despedida.
    if (rep) decir(V.cierre, extras, crearReporte(rep), { audioUrl: V.cierreAudio });
    else decir(txt || "¿Me lo repetís?", extras);
  }

  function crearReporte(d) {
    var lugar = pos || { lat: E.centro[0] + (Math.random() - .5) * .012, lng: E.centro[1] + (Math.random() - .5) * .012 };
    return EM.agregar({
      nivel: d.nivel === "urgente" ? "urgente" : "leve",
      nombre: String(d.nombre || "Vecino/a").slice(0, 60),
      tel: String(d.tel || "").slice(0, 30),
      dir: String(d.dir || "Sin dirección (ubicación por GPS)").slice(0, 120),
      ref: String(d.ref || "").slice(0, 120),
      lat: lugar.lat, lng: lugar.lng,
      personas: parseInt(d.personas, 10) || null,
      comentario: String(d.comentario || "").slice(0, 300),
      publico: d.publico !== false,
      porVoz: true
    });
  }

  /* ---------- Cerebro: IA del proxy o guión local ---------- */
  var TIMEOUT_MS = 45000;
  function turnosVecino() { return historial.filter(function (m) { return m.rol === "yo" && !m.ubicacion; }).length; }

  function llamarIA() {
    var mensajes = [{ role: "system", content: V.prompt }].concat(historial.filter(function (m) {
      return (m.rol === "ia" || m.rol === "yo") && !m.local && m.texto;
    }).map(function (m) {
      return { role: m.rol === "yo" ? "user" : "assistant", content: m.texto };
    }));
    if (turnosVecino() >= V.avisoTurnos) mensajes.push({ role: "system", content: V.apurar });
    var ctrl = new AbortController();
    var corte = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    return fetch(V.apiBase + "/ia/chat", {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: mensajes })
    }).then(function (r) {
      clearTimeout(corte);
      if (!r.ok) throw new Error("chat " + r.status);
      return r.json();
    }).then(function (j) {
      var c = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      if (!c) throw new Error("vacío");
      return c;
    });
  }

  function responder(texto) {
    // Tope duro de la charla: se corta sin gastar más IA y se ofrecen otros caminos.
    if (turnosVecino() > V.maxTurnos) {
      decir("No pudimos completar el aviso por audio. Llamá a Defensa Civil al 103 o usá el formulario escrito.",
        { cortado: true }, null, { local: true });
      terminado = true;
      setFase("fin");
      return;
    }
    esperando = true;
    if (!actual) setFase("procesando");
    pintar();
    var p = usarIA ? llamarIA().catch(function (e) {
      if (window.console) console.warn("Asistente: el proxy de IA no respondió, sigo con el guión local.", e);
      usarIA = false;
      return guion(texto);
    }) : new Promise(function (ok) { setTimeout(function () { ok(guion(texto)); }, 700); });
    p.then(procesar);
  }

  // Guión local: las mismas preguntas cortas que la IA, en orden fijo.
  var G = { paso: 0, d: {} };
  var DIGITOS = { cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
  var NUMEROS = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  function norm(s) { return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function telefono(t) {
    return norm(t).split(/[^a-z0-9]+/).map(function (w) { return /^\d+$/.test(w) ? w : (w in DIGITOS ? DIGITOS[w] : ""); }).join("");
  }
  function cantidad(t) {
    var n = norm(t), m = n.match(/\b(\d{1,2})\b/);
    if (m) return parseInt(m[1], 10);
    var w = n.split(/[^a-z]+/).filter(function (x) { return x in NUMEROS; })[0];
    if (w) return NUMEROS[w];
    return /\b(sola|solo)\b/.test(n) ? 1 : null;
  }
  function esNo(t) { var n = norm(t); return /\bno\b/.test(n) && !/\bsi\b|\bdale\b|\bbueno\b|\bmanda/.test(n); }
  // "Me llamo Rosa Medina, 3482 456789" → "Rosa Medina"
  function nombreDe(t) {
    return String(t).replace(/[\d\-–.,]+/g, " ")
      .replace(/\b(hola|me llamo|soy|mi nombre es|mi telefono es|mi teléfono es|el telefono es|el teléfono es|telefono|teléfono|celular|y|cero|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/gi, " ")
      .replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
  }

  // Sin confirmación final: con los tres datos se manda el aviso (el saludo ya avisa que se ve en el mapa).
  function guion(t) {
    var d = G.d;
    var B = "¿Tu nombre y un teléfono para llamarte?";
    if (t === V.ubicacionMensaje) {
      if (G.paso !== 1) return null; // ya tenía la dirección: sólo queda el "gracias"
      d.dir = "Ubicación por GPS"; G.paso = 2;
      return B;
    }
    switch (G.paso) {
      case 0: // qué pasa y, si la dijo, la calle
        d.nivel = /inund|urgent|sube|subiendo|salir|rodilla|cintura|peligro|atrapad|evacu/.test(norm(t)) ? "urgente" : "leve";
        d.comentario = t;
        var peligro = d.nivel === "urgente" ? "Si hay peligro, llamá ya al 911. [911] " : "";
        if (/\b(calle|avenida|av|pasaje|ruta|camino|esquina|barrio|frente|al lado)\b/.test(norm(t))) { d.dir = t; G.paso = 2; return peligro + B; }
        G.paso = 1;
        return peligro + "¿En qué calle está tu casa? [UBICACION]";
      case 1:
        d.dir = t; G.paso = 2;
        return B;
      case 2:
        var tel = telefono(t), nom = nombreDe(t);
        if (nom && !d.nombre) d.nombre = nom;
        G.pedidosTel = (G.pedidosTel || 1) + 1;
        if (tel.length < 6 && G.pedidosTel <= 2) return "¿Un teléfono para llamarte? Puede ser de un familiar o vecino.";
        if (tel.length >= 6) d.tel = tel;
        G.paso = 3;
        return "¿Cuántas personas viven ahí?";
      default:
        d.personas = cantidad(t);
        return "<REPORTE>" + JSON.stringify({ nivel: d.nivel, dir: d.dir, ref: "", nombre: d.nombre, tel: d.tel || "", personas: d.personas, comentario: d.comentario, publico: true }) + "</REPORTE>";
    }
  }

  /* ---------- Respuesta del vecino ---------- */
  function enviarTexto(texto, deVoz, dur) {
    texto = String(texto || "").trim();
    if (!texto || terminado) return;
    historial.push({ rol: "yo", texto: texto, deVoz: deVoz, dur: dur, hora: hora() });
    responder(texto);
  }

  /* Grabación con MediaRecorder + transcripción en el proxy (modo IA) */
  var grab = null;
  var MAX_SEG = V.maxGrabacion;

  function aWav(blob) {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var rate = 16000;
    return blob.arrayBuffer().then(function (buf) { return ctx.decodeAudioData(buf); }).then(function (a) {
      ctx.close();
      var off = new OfflineAudioContext(1, Math.max(1, Math.ceil(a.duration * rate)), rate);
      var src = off.createBufferSource();
      src.buffer = a; src.connect(off.destination); src.start();
      return off.startRendering();
    }).then(function (r) {
      var d = r.getChannelData(0), pcm = new Int16Array(d.length);
      for (var i = 0; i < d.length; i++) { var s = Math.max(-1, Math.min(1, d[i])); pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }
      return pcmAWav(pcm.buffer, rate);
    });
  }
  function aBase64(blob) {
    return new Promise(function (ok, mal) {
      var fr = new FileReader();
      fr.onload = function () { ok(String(fr.result).split(",")[1]); };
      fr.onerror = mal;
      fr.readAsDataURL(blob);
    });
  }
  function transcribir(blob) {
    return aWav(blob).then(aBase64).then(function (b64) {
      return fetch(V.apiBase + "/ia/transcribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: b64, format: "wav" }) });
    }).then(function (r) {
      if (!r.ok) throw new Error("STT " + r.status);
      return r.json();
    }).then(function (j) { return String(j.text || "").trim(); });
  }

  function iniciarGrabacion() {
    if (grab || terminado) return;
    detener();
    var modo = modoVoz();
    if (!modo) { mostrarTeclado(true); return; }
    if (modo === "sr") return iniciarSR();
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var rec = new MediaRecorder(stream);
      var g = grab = { rec: rec, stream: stream, partes: [], inicio: Date.now(), cancelada: false };
      rec.addEventListener("dataavailable", function (e) { if (e.data && e.data.size) g.partes.push(e.data); });
      rec.addEventListener("stop", function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        clearInterval(g.reloj); grab = null;
        if (g.cancelada) { setFase("turno"); return; }
        var dur = (Date.now() - g.inicio) / 1000;
        if (dur < 1) { EM.toast("El audio es muy corto. Tocá el micrófono y hablá."); setFase("turno"); return; }
        var m = { rol: "yo", texto: "", deVoz: true, dur: dur, hora: hora(), transcribiendo: true };
        historial.push(m);
        setFase("procesando"); pintar();
        transcribir(new Blob(g.partes, { type: rec.mimeType || "audio/webm" })).then(function (texto) {
          if (!texto) throw new Error("vacío");
          m.texto = texto; m.transcribiendo = false;
          responder(texto);
        }).catch(function () {
          historial.splice(historial.indexOf(m), 1);
          pintar(); setFase("turno");
          EM.toast("No se entendió el audio. Probá de nuevo, hablando cerca del teléfono.");
        });
      });
      rec.start();
      empezarReloj(g);
    }).catch(function () {
      EM.toast("No se pudo usar el micrófono. Revisá los permisos o escribí tu respuesta.");
      mostrarTeclado(true);
    });
  }

  /* Reconocimiento de voz del navegador (modo local) */
  function iniciarSR() {
    var rec = new SR();
    rec.lang = "es-AR"; rec.continuous = true; rec.interimResults = true;
    var g = grab = { sr: rec, texto: "", inicio: Date.now(), cancelada: false };
    rec.onresult = function (e) {
      var t = "";
      for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      g.texto = t;
    };
    rec.onerror = function (e) {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { g.cancelada = true; EM.toast("No se pudo usar el micrófono. Escribí tu respuesta."); mostrarTeclado(true); }
    };
    rec.onend = function () {
      clearInterval(g.reloj); grab = null;
      if (g.cancelada) { if (!escribiendo) setFase("turno"); return; }
      if (!g.texto.trim()) { EM.toast("No te escuché bien. Tocá el micrófono y probá de nuevo."); setFase("turno"); return; }
      enviarTexto(g.texto, true, (Date.now() - g.inicio) / 1000);
    };
    try { rec.start(); } catch (e) { grab = null; mostrarTeclado(true); return; }
    empezarReloj(g);
  }

  function empezarReloj(g) {
    setFase("grabando");
    reloj.textContent = "0:00 / " + tiempo(MAX_SEG);
    g.reloj = setInterval(function () {
      var seg = Math.floor((Date.now() - g.inicio) / 1000);
      reloj.textContent = tiempo(seg) + " / " + tiempo(MAX_SEG);
      if (seg >= MAX_SEG) terminarGrabacion(false);
    }, 250);
  }

  function terminarGrabacion(cancelar) {
    if (!grab) return;
    grab.cancelada = cancelar;
    if (grab.sr) grab.sr.stop();
    else if (grab.rec.state !== "inactive") grab.rec.stop();
  }

  /* ---------- Teclado (alternativa) ---------- */
  function mostrarTeclado(on) {
    escribiendo = on;
    formTexto.hidden = !on;
    filaMic.hidden = on;
    cambiarModo.innerHTML = on
      ? '<i class="fa-solid fa-microphone"></i><span>Prefiero hablar</span>'
      : '<i class="fa-solid fa-keyboard"></i><span>Prefiero escribir</span>';
    cambiarModo.hidden = on && !modoVoz();
    if (fase === "turno" || fase === "inicio") setFase(fase);
    if (on) inputTexto.focus();
  }
  cambiarModo.addEventListener("click", function () { terminarGrabacion(true); mostrarTeclado(!escribiendo); });
  formTexto.addEventListener("submit", function (e) {
    e.preventDefault();
    if (fase === "procesando" || terminado) return;
    detener();
    var t = inputTexto.value; inputTexto.value = "";
    enviarTexto(t, false);
  });

  /* ---------- Eventos ---------- */
  mic.addEventListener("click", function () { grab ? terminarGrabacion(false) : iniciarGrabacion(); });
  cancelar.addEventListener("click", function () { terminarGrabacion(true); });

  msgsEl.addEventListener("click", function (e) {
    var p = e.target.closest("[data-play]");
    if (p) { reproducir(historial[+p.getAttribute("data-play")]); return; }
    var u = e.target.closest("[data-ubic]");
    if (u) {
      if (!navigator.geolocation) { EM.toast("Tu teléfono no permite mandar la ubicación. Decime la calle."); return; }
      u.disabled = true;
      u.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>Buscando…';
      navigator.geolocation.getCurrentPosition(function (g) {
        var lat = g.coords.latitude, lng = g.coords.longitude;
        if (Math.abs(lat - E.centro[0]) > .15 || Math.abs(lng - E.centro[1]) > .15) {
          lat = E.centro[0] + (Math.random() - .5) * .01; lng = E.centro[1] + (Math.random() - .5) * .01;
          EM.toast("Estás fuera de Las Toscas: usamos un punto de ejemplo.");
        }
        pos = { lat: lat, lng: lng };
        // "Gracias" pregrabado (sin IA) y la asistente sigue con la próxima pregunta: la ubicación ya es la dirección.
        historial.push({ rol: "yo", ubicacion: true, texto: V.ubicacionMensaje, hora: hora() });
        decir(V.ubicacion, {}, null, { audioUrl: V.ubicacionAudio });
        if (!esperando && !terminado) responder(V.ubicacionMensaje);
      }, function () {
        u.disabled = false;
        u.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>Mandar mi ubicación';
        EM.toast("No pudimos ubicarte. Decime la calle hablando.");
      }, { enableHighAccuracy: true, timeout: 10000 });
    }
  });

  /* ---------- Inicio ---------- */
  if (!modoVoz()) mostrarTeclado(true);
  historial.push({ rol: "ia", texto: V.saludo, audioUrl: V.saludoAudio, extras: {}, hora: hora() });
  setFase("inicio");
  pintar();
})();
