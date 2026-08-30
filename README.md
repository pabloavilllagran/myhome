# pablovillagran.cl

Vlog personal de Pablo Villagrán: tips de lo que voy aprendiendo de IA y notas de estilo de vida.
Un solo archivo HTML, sin frameworks ni build step.

## Estructura
- `index.html` — todo el sitio (HTML + CSS + JS inline)
- `foto.jpg` — foto del encabezado

## Cómo publicar
Todo el contenido vive en dos listas al final de `index.html`, dentro del `<script>`:

- `TIPS` — cada entrada es `{ fecha, tag, titulo, texto }`. Lo más nuevo va primero, fecha en `AAAA-MM-DD`.
- `VIDEOS` — cada entrada es `{ id, titulo, texto, fecha }`, donde `id` es el ID de YouTube
  (en `youtube.com/watch?v=ABC123` el id es `ABC123`).

La numeración, las fechas legibles y el contador del encabezado se calculan solos.
Los videos cargan con miniatura y solo insertan el iframe al hacer clic.

## Deploy
Netlify, sitio estático sin comando de build: arrastrar la carpeta o conectar el repo.
