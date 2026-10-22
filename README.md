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

## Contador de visitas

El HTML incluye un contador compartido, resumen por países y mapa desplegable de Natural Earth. Sus parámetros están en `CONFIG.visitas`. La galería y los textos siguen funcionando sin conexión; las estadísticas necesitan internet.

`api/visitas.mjs` registra las visitas desde Vercel y consulta los totales en un esquema exclusivo de Supabase. La clave `MYHOME_VISITS_SECRET` se configura como secreto de producción en Vercel y en la tabla privada de configuración; nunca se guarda en el HTML ni en Git. La clave publicable del código solo permite consultar totales y enviar registros firmados: las tablas no tienen acceso directo desde el navegador.

Se cuenta una visita por navegador y conexión al día, con hora de Melinka. No se guardan IP, nombres ni ciudades. Se conserva una huella diaria firmada para evitar duplicados; las huellas de días anteriores se limpian al recibir nuevas visitas. Robots conocidos, visitas de desarrollo, preferencias de no seguimiento y navegadores automatizados no se suman. El filtro de robots es básico; las cifras son orientativas, no una medición de personas únicas.

El mapa está incorporado en el HTML, sin librerías ni peticiones a servicios de mapas. Los países pequeños pueden no aparecer a esta escala, pero sus visitas sí figuran en la lista.

Pruebas: `node --test scripts/test-visitas.mjs`. La definición SQL sin secretos está en `docs/visitas.sql`; ya fue aplicada al esquema `myhome_stats` del proyecto Supabase `pablo-ai-lab`.

## Deploy

El dominio `pablovillagran.cl` se publica actualmente en Vercel desde la rama `main` de `pabloavilllagran/myhome`, sin frameworks ni proceso de compilación para el HTML. Cada push activa el deploy. La función del contador se publica junto al sitio.
