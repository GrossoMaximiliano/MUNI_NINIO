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
  var colaDicha = 0;

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

  function alTerminar(m) {
    if (sonando === m) sonando = null;
    m.estado = null;
    pintar();
    setFase(terminado ? "fin" : "turno");
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
    u.onend = u.onerror = function () { if (sonando === m) alTerminar(m); };
    sonando = m; m.estado = "sonando";
    pintar(); setFase("sonando");
    speechSynthesis.speak(u);
  }

  function reproducir(m) {
    if (m === sonando) { detener(); pintar(); setFase(terminado ? "fin" : "turno"); return; }
    terminarGrabacion(true);
    detener();
    if (!usarIA) { hablarLocal(m); return; }
    m.estado = "cargando"; pintar(); setFase("sonando");
    (m.audioUrl ? Promise.resolve(m.audioUrl) : sintetizar(m.voz || m.texto)).then(function (url) {
      m.audioUrl = url;
      audio.src = url;
      sonando = m; m.estado = "sonando";
      pintar();
      return audio.play();
    }).catch(function (e) {
      if (e && e.name === "NotAllowedError") { m.estado = null; sonando = null; pintar(); setFase("inicio"); return; }
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
  function decir(texto, extras, reporte) {
    var cola = "";
    if (!reporte) { cola = colaDicha < 2 ? V.cola : "Tocá el botón rojo para contestar."; colaDicha++; }
    var m = { rol: "ia", texto: texto, voz: texto + (cola ? " " + cola : ""), extras: extras || {}, hora: hora() };
    historial.push(m);
    if (reporte) {
      terminado = true;
      historial.push({ rol: "fin", reporte: reporte });
    }
    pintar();
    reproducir(m);
  }

  // Interpreta la respuesta (de la IA o del guión): etiquetas [UBICACION] y [911], y el bloque <REPORTE>.
  function procesar(raw) {
    var txt = String(raw || "");
    var rep = null;
    var mR = txt.match(/<REPORTE>([\s\S]*?)<\/REPORTE>/i);
    if (mR) { try { rep = JSON.parse(mR[1]); } catch (e) { rep = null; } }
    txt = txt.replace(/<REPORTE>[\s\S]*?(<\/REPORTE>|$)/i, "");
    var extras = { ubicacion: /\[UBICACION\]/i.test(txt), emergencia: /\[911\]/.test(txt) };
    txt = txt.replace(/\[(UBICACION|911)\]/gi, "").replace(/\*\*(.+?)\*\*/g, "$1").replace(/\s+\n/g, "\n").trim();
    decir(txt || "Listo.", extras, rep ? crearReporte(rep) : null);
  }

  function crearReporte(d) {
    var lugar = pos || { lat: E.centro[0] + (Math.random() - .5) * .012, lng: E.centro[1] + (Math.random() - .5) * .012 };
    var validos = E.necesidades.map(function (n) { return n.id; });
    return EM.agregar({
      nivel: d.nivel === "urgente" ? "urgente" : "leve",
      nombre: String(d.nombre || "Vecino/a").slice(0, 60),
      tel: String(d.tel || "").slice(0, 30),
      dir: String(d.dir || "Sin dirección (ubicación por GPS)").slice(0, 120),
      ref: String(d.ref || "").slice(0, 120),
      lat: lugar.lat, lng: lugar.lng,
      personas: parseInt(d.personas, 10) || null,
      necesita: (d.necesita || []).filter(function (x) { return validos.indexOf(x) >= 0; }),
      comentario: String(d.comentario || "").slice(0, 300),
      publico: d.publico !== false,
      porVoz: true
    });
  }

  /* ---------- Cerebro: IA del proxy o guión local ---------- */
  var TIMEOUT_MS = 45000;
  function llamarIA() {
    var mensajes = [{ role: "system", content: V.prompt }].concat(historial.filter(function (m) {
      return (m.rol === "ia" || m.rol === "yo") && !m.ubicacion && m.texto;
    }).slice(-24).map(function (m) {
      return { role: m.rol === "yo" ? "user" : "assistant", content: m.texto };
    }));
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
    setFase("procesando"); pintar();
    var p = usarIA ? llamarIA().catch(function (e) {
      if (window.console) console.warn("Asistente: el proxy de IA no respondió, sigo con el guión local.", e);
      usarIA = false;
      return guion(texto);
    }) : new Promise(function (ok) { setTimeout(function () { ok(guion(texto)); }, 700); });
    p.then(procesar);
  }

  // Guión local: las mismas preguntas que la IA, en orden fijo.
  var G = { paso: 0, d: { necesita: [] } };
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
  function necesidades(t) {
    var n = norm(t), r = [];
    if (/buscar|sacarnos|saquen de|evacu|salir|traslad|llev/.test(n)) r.push("evacuacion");
    if (/(sacar|saquen|saque|sacarnos) el agua|bomb|achic|desagot/.test(n)) r.push("bombeo");
    if (/colchon|ropa|frazada|cama/.test(n)) r.push("colchones");
    if (/comida|aliment|agua potable|mercader/.test(n)) r.push("alimentos");
    if (/remedio|medic|insulina/.test(n)) r.push("medicamentos");
    if (/arena|bolsa/.test(n)) r.push("arena");
    return r;
  }
  function esNo(t) { var n = norm(t); return /\bno\b/.test(n) && !/\bsi\b|\bdale\b|\bbueno\b/.test(n); }

  function guion(t) {
    var d = G.d;
    switch (G.paso) {
      case 0:
        d.nivel = /inund|urgent|much|sube|subiendo|ayuda|salir|rodilla|cintura|peligro|atrapad|evacu/.test(norm(t)) ? "urgente" : "leve";
        d.comentario = t;
        G.paso = 1;
        return (d.nivel === "urgente"
          ? "Entendido, lo anoto como urgente. Si hay peligro para alguien, llamá ya al 911. [911] Cortá la luz desde la llave general. "
          : "Entendido. Si entra agua a la casa, cortá la luz desde la llave general. ") +
          "¿En qué calle y número está tu casa? Decime también algo para encontrarla, como el color del portón. [UBICACION]";
      case 1:
        d.dir = t; G.paso = 2;
        return "Gracias. ¿Cómo te llamás?";
      case 2:
        d.nombre = t.replace(/^(hola,?\s*)?(me llamo|soy|mi nombre es)\s+/i, "").replace(/[.!]$/, "");
        G.paso = 3;
        return "Gracias, " + d.nombre.split(" ")[0] + ". ¿A qué número de teléfono te podemos llamar?";
      case 3:
        var tel = telefono(t);
        if (tel.length < 6) return "No te entendí bien el número. ¿Me lo repetís despacito?";
        d.tel = tel; G.paso = 4;
        return "Perfecto. ¿Cuántas personas hay en la casa, y qué necesitan? Por ejemplo: sacar el agua, colchones, comida, remedios o que los vayan a buscar.";
      case 4:
        d.personas = cantidad(t);
        d.necesita = necesidades(t);
        G.paso = 5;
        return "Último: tu nombre, teléfono y dirección se van a ver en el mapa para que el Municipio y los vecinos te puedan ayudar. Un aviso falso le saca ayuda a quien la necesita. ¿Estás de acuerdo?";
      case 5:
        d.publico = !esNo(t); G.paso = 6;
        return "Te confirmo: aviso " + d.nivel + ", en " + d.dir + ", a nombre de " + d.nombre + ", teléfono " + d.tel.split("").join(" ") + ". ¿Está todo bien?";
      default:
        if (esNo(t)) { G.paso = 1; return "Perdón. Empecemos de nuevo con la dirección: ¿en qué calle y número está tu casa? [UBICACION]"; }
        return "Listo, ya mandamos tu aviso. El Municipio te va a llamar para confirmar." +
          "\n<REPORTE>" + JSON.stringify({ nivel: d.nivel, dir: d.dir, ref: "", nombre: d.nombre, tel: d.tel, personas: d.personas, necesita: d.necesita, comentario: d.comentario, publico: d.publico }) + "</REPORTE>";
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
  var MAX_SEG = 60;

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
    reloj.textContent = "0:00";
    g.reloj = setInterval(function () {
      var seg = Math.floor((Date.now() - g.inicio) / 1000);
      reloj.textContent = tiempo(seg);
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
        historial.push({ rol: "yo", ubicacion: true, hora: hora() });
        pintar();
        pista.innerHTML = '<i class="fa-solid fa-circle-check"></i> ¡Ubicación recibida! Igual decime la calle tocando el botón <span class="em-k em-k--mic"><i class="fa-solid fa-microphone"></i></span> rojo';
      }, function () {
        u.disabled = false;
        u.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i>Mandar mi ubicación';
        EM.toast("No pudimos ubicarte. Decime la calle hablando.");
      }, { enableHighAccuracy: true, timeout: 10000 });
    }
  });

  /* ---------- Inicio ---------- */
  if (!modoVoz()) mostrarTeclado(true);
  historial.push({ rol: "ia", texto: V.saludo, voz: V.saludo + " " + V.cola, extras: {}, hora: hora() });
  colaDicha = 1;
  setFase("inicio");
  pintar();
})();
