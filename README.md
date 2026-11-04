# Emergencia Hídrica — Fenómeno El Niño · Las Toscas

Maqueta (HTML + CSS + JS puro, sin build) para que los vecinos de Las Toscas avisen si el agua afecta su casa y para que el Municipio y los vecinos vean en un mapa quién necesita ayuda.

Publicado en GitHub Pages: https://grossomaximiliano.github.io/MUNI_NINIO/

## Pantallas

- `index.html` — portada con tres opciones grandes: **Estoy afectado**, **Avisar hablando** y **Ver vecinos afectados**.
- `reportar.html` — formulario de 3 pasos: gravedad (leve / urgente), ubicación (GPS o tocar el mapa, calle y aclaración), datos de contacto y permiso para mostrarlos.
- `hablar.html` — aviso por voz, estilo WhatsApp: la asistente manda audios y el vecino contesta con el micrófono (o escribiendo).
- `mapa.html` — mapa público (Leaflet + OpenStreetMap) con filtros y lista; botones para llamar y cómo llegar.
- `panel.html` — panel municipal (ingreso simulado): prioridades, verificar, en camino, atendido, descartar falsos y exportar CSV.

## Asistente de voz

Usa el mismo proxy de IA que MuniPoc (`https://server.brl-vcmp.com`, rutas `/ia/chat`, `/ia/speech` y `/ia/transcribe`). La clave queda en el servidor, que sólo acepta pedidos desde `grossomaximiliano.github.io`. El prompt y la configuración están en `assets/js/voz-prompt.js`.

En otro origen (por ejemplo `localhost`) o si el proxy no responde, se usa un guión local con las mismas preguntas, la voz del navegador y su reconocimiento de voz. Para forzar la IA en otro origen permitido: `hablar.html?ia=1`.

### Costo por charla

Cada respuesta del vecino pasa por tres IAs (transcripción, chat y voz), así que la charla está pensada para cerrar en 3 respuestas:

1. Qué pasa y en qué calle (lo pregunta el saludo). Si no dice la calle, puede tocar **Mandar mi ubicación**: la asistente contesta con un audio fijo ("Gracias, ya tengo tu ubicación") y sigue.
2. Nombre y teléfono, en una sola pregunta.
3. Última pregunta: cuántas personas están con el vecino y cuántos son niños, para que el Municipio sepa qué llevar (ropa, pañales, comida). Si dice sólo el total, se pregunta una vez cuántos son niños. No se pregunta qué necesitan: cada vecino ayuda como quiera.

Los niños se ven en la tarjeta del mapa, en el panel (debajo de "Personas afectadas") y en el CSV. El formulario escrito también los pide.

Con eso el aviso se manda solo, sin resumen ni confirmación: el saludo ya avisa que el aviso se ve en el mapa.

- Mensajes de 25 palabras como máximo: un reconocimiento corto ("Entiendo.", "Perfecto, Rosa.") y la próxima pregunta. Si la situación es urgente, suma una frase de calma.
- Si un dato no sirve, la asistente dice qué está mal y cómo decirlo. Teléfono válido: de 6 a 13 dígitos (fijo local, con 15, con característica o con 0/549). Si queda corto: "Ese número me quedó corto, entendí sólo cuatro números. Decímelo con la característica, por ejemplo 3482 y seis números."
- El teléfono válido se confirma leído en grupos ("Te anoto el 3482, 45 67 89") en el mismo mensaje de la pregunta siguiente, así no suma turnos. Se pide hasta tres veces; si el vecino no tiene, se le pide una vez el de un familiar o vecino.
- Si la IA intenta cerrar con un teléfono inválido, la página lo frena una vez y lo vuelve a pedir explicando el motivo.
- El guión local entiende números dichos de a pares ("treinta y cuatro ochenta y dos").
- El saludo, el cierre y el "gracias" por la ubicación son audios pregrabados (`assets/audio/`), así que no se generan cada vez. Si se cambian esos textos en `voz-prompt.js`, hay que regenerar los audios.
- Cada audio del vecino dura 30 segundos como máximo.
- Desde la 3.ª respuesta se le pide a la IA que cierre con lo que tenga. Pasada la 9.ª (deja lugar para corregir datos), la charla se corta y se ofrece llamar al 103 o usar el formulario.
- El proxy hoy ignora `max_tokens` y `reasoning` enviados desde la página. El modelo de chat razona unos 300 tokens por respuesta; si se quiere bajar ese costo, hay que desactivar el razonamiento en el servidor.

## Contra avisos falsos

- Los avisos nuevos aparecen como *Sin verificar* hasta que el Municipio llama y los verifica.
- Los vecinos pueden marcar un aviso como posiblemente falso (una vez por navegador). Con 3 marcas, un aviso sin verificar sale del mapa público.
- El panel puede descartar avisos falsos.
- Un mismo teléfono no puede tener dos avisos abiertos: se actualiza el anterior.

## Datos

Los reportes de ejemplo están en `assets/js/datos.js` (nombres y teléfonos ficticios). Lo que se carga queda en el `localStorage` del navegador. "Reiniciar datos de la demo", al pie del panel, lo borra.

## Probar en local

```bash
python -m http.server 5513
```

Abrir http://localhost:5513/
