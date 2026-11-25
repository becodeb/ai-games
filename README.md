# STEAMLAB — Taller de juegos con IA

Aplicacion web para un taller escolar donde los chicos escriben el *prompt*, un profe lo ejecuta en la IA
(Gemini / ChatGPT / Claude) y pega el codigo resultante. El juego aparece en la pantalla del alumno en tiempo real.

## Que incluye

| Ruta | Quien la usa | Que hace |
| --- | --- | --- |
| `/` | Alumno | Crear un juego nuevo o continuar uno existente |
| `/nuevo` | Alumno | El prompt en grande, con huecos para completar |
| `/proyecto/:id` | Alumno | Linea de tiempo: prompt → juego → prompt de mejoras → juego |
| `/dashboard` | Profesor | Todos los proyectos, con los pendientes destacados arriba |
| `/dashboard/:id` | Profesor | Prompt a la izquierda, codigo de la IA a la derecha, preview en vivo |
| `/galeria` | Publico | Pensada para celular (llaveros NFC): portada y un juego por pantalla, deslizando; "Ver todos" abre la grilla |
| `/jugar/:iterationId` | Publico | El juego a pantalla completa, con flechas y botones tactiles en el celu |
| `/nueva-imagen` | Alumno | Titulo + un pedido de imagen en texto libre, con referencias adjuntas |
| `/imagen/:id` | Alumno | Linea de tiempo: pedido → 4 imagenes → correccion → 4 imagenes |
| `/dashboard-imagenes` | Profesor | Todos los pedidos de imagen, con los pendientes destacados |
| `/dashboard-imagenes/:id` | Profesor | Prompt a la izquierda, las 4 imagenes a subir a la derecha |
| `/galeria-imagenes` | Publico | Grid con las imagenes terminadas |

## Stack

- **Backend:** Node.js 22 + Express + Socket.io
- **Base de datos:** SQLite (better-sqlite3), con WAL activado
- **Frontend:** React 18 + Vite + React Router, CSS propio (sin frameworks de UI)
- **Deploy:** Docker multi-stage, un unico contenedor

Las iteraciones se guardan de forma incremental (`version 1`, `version 2`, …). Nada se sobreescribe: cada
prompt y cada juego quedan como una fila nueva en la tabla `iterations`.

## Desarrollo local

```bash
npm run setup
```

```bash
npm run dev
```

- Cliente: http://localhost:5173 (Vite, con proxy hacia la API y los WebSockets)
- Servidor: http://localhost:3000

La base se crea sola en `server/data/steamlab.db`.

Para probar el build de produccion:

```bash
npm run build && npm start
```

## Docker

Uso local (publica el puerto 3000 en tu maquina):

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

Queda en http://localhost:3000. Los datos viven en el volumen `steamlab-data` montado en `/data`.

**Importante:** `docker-compose.yml` (el que usa produccion) NO publica puertos en el host.
Solo el override `docker-compose.local.yml` agrega `3000:3000` para desarrollo local.

## Deploy en Coolify

1. En Coolify: **New Resource → Docker Compose** (o **Public Repository** si conectas el repo de Git).
2. Repositorio: el de este proyecto. Branch: `main`. Compose file: `docker-compose.yml` (sin el override local).
3. El servicio `app` escucha en el puerto **3000** dentro del contenedor, pero no se publica
   en el host: el proxy de Coolify (Traefik) entra por la red interna de Docker. En el campo
   **Ports Exposes** pone `3000` si no lo detecta solo, y asigna el dominio a ese puerto.
4. Variables de entorno: no hace falta tocar nada; los valores por defecto ya estan en el compose.
   Si queres cambiarlos, copia `.env.example`.
5. **Importante:** dejar declarado el volumen `steamlab-data → /data` para no perder los juegos en cada deploy.
6. Deploy. El healthcheck pega contra `/api/health`.

El contenedor sirve la API, los WebSockets y el frontend estatico en el mismo puerto, asi que no hay que
configurar CORS ni un segundo servicio. El proxy de Coolify (Traefik) soporta WebSockets sin configuracion extra.

## El prompt se escribe adentro del prompt

En `/nuevo` no hay un formulario a un lado y un prompt al otro: el prompt **es** la pantalla. Se ve grande,
con las frases fijas y huecos para completar. El alumno solo puede escribir dentro de los huecos, nunca
romper la estructura, y ve el texto exacto que le va a mandar a la IA mientras lo escribe.

- Los huecos crecen con lo que se escribe y no tienen limite de caracteres.
- Los que quedan vacios desaparecen del prompt final, asi nunca se copia una frase colgada.
- Algunos huecos muestran ideas como sugerencias al enfocarlos, pero se puede escribir cualquier cosa.
- Las reglas tecnicas (un solo archivo, sin librerias, formato de respuesta) se agregan solas al copiar o
  enviar, y se pueden ver con un clic. No condicionan el contenido del juego, solo el formato.

El pedido de mejoras usa el mismo formato de prompt con huecos.

## Como se usa en clase

1. El alumno completa los huecos en `/nuevo` y aprieta **Enviar a los profes** (o **Copiar prompt**).
2. La primera vez que se entra a `/dashboard` la app pide el nombre del profe. Queda guardado en esa compu.
3. El proyecto aparece destacado en `/dashboard`. **Al abrir uno pendiente queda tomado automaticamente**:
   pasa a *En proceso* y muestra quien lo esta atendiendo, para que dos profes no trabajen sobre lo mismo.
   Si lo tiene otra persona, hay un boton **Tomarlo yo**.
4. El profe aprieta **Copiar prompt para la IA** y lo pega en el chat. Puede guardar el enlace del chat.
5. Pega la respuesta en el area de codigo (archivo unico o HTML/CSS/JS por separado). La previsualizacion
   muestra el juego antes de publicarlo.
6. **Aprobar y enviar al alumno**: el juego aparece en la pantalla del chico al instante, sin recargar.
7. El alumno pide mejoras agrupando varios cambios en un solo pedido y el ciclo se repite.

El profe puede volver a cualquier version anterior desde los chips `v1`, `v2`, … y corregir su codigo:
el cambio se refleja en vivo en la vista del alumno.

### Si se corta la conversacion con la IA

En cada version el panel del profe tiene una tarjeta para retomar el hilo desde cero:

- **Copiar resumen + codigo base**: todos los pedidos en orden mas el codigo completo de la ultima version
  que funciona, listo para pegar en un chat nuevo.
- **Solo el historial**: los pedidos sin el codigo.
- **Copiar codigo vN** y un visor para leer el codigo de la version anterior sin cambiar de pantalla.

### El alumno tambien puede hacer el ciclo completo

Copiar el prompt no bloquea nada. Debajo de cada pedido hay un area **"Ya tengo la respuesta de la IA"**
donde el chico pega el codigo, lo previsualiza y publica la version el mismo, sin depender de un profe. El
boton **Enviar a los profes** sigue disponible por si copio el prompt sin querer o prefiere delegarlo.

## El taller de imagenes

La misma idea que los juegos, pero lo que vuelve son imagenes. Corre sobre tablas propias
(`image_projects`, `image_requests`, `image_assets`) y su propia API en `/api/images`, asi los dos
talleres no se pisan.

1. En `/nueva-imagen` el alumno le pone un titulo y escribe el pedido en un cuadro libre. El comienzo
   **"Generame una imagen"** ya viene escrito y no se puede borrar: el chico sigue la frase con sus palabras.
2. Abajo puede adjuntar hasta 4 imagenes de referencia (arrastrandolas o eligiendolas del disco).
3. **Enviar a los profes** y queda esperando. El pedido aparece en `/dashboard-imagenes`.
4. El profe abre el pedido (queda tomado a su nombre), copia el prompt, lo pega en la IA y sube
   **4 imagenes** en la columna derecha. **Aprobar y enviar al alumno** las publica al instante.
5. El alumno ve las 4, **elige una** y escribe la correccion. Ese pedido nuevo viaja con la imagen elegida
   como punto de partida: el profe la ve marcada y la descarga para adjuntarla en el chat de la IA.
6. El ciclo se repite. Cada version queda guardada entera: nada se sobreescribe.

Detalles que conviene saber:

- Las imagenes se guardan como archivos en el volumen de datos (`<data>/images`) y se sirven por
  `/api/images/file/:assetId`. En la base solo queda el registro, no los bytes.
- Viajan al servidor como data URL adentro del JSON. El navegador las achica antes de mandarlas
  (1400 px las referencias, 1920 px los resultados) y el servidor rechaza cualquier cosa que no sea
  PNG, JPG, WEBP o GIF de hasta 8 MB.
- Si el profe vuelve a publicar sobre una version ya entregada, la tanda nueva reemplaza a la anterior
  y los archivos viejos se borran del disco. Las otras versiones no se tocan.
- El alumno tambien puede cerrar el ciclo solo: **"Ya tengo las imagenes de la IA"** le deja subir la tanda.

## Generacion automatica con IA

Opcional. Cuando un alumno **envia** su pedido a los profes, el servidor puede generar el juego con la API de
Anthropic y dejarlo como **borrador** en el panel del profe. El profe solo revisa: lo aprueba, o escribe los
cambios que quiere y la IA lo rehace, las veces que haga falta, **sin crear versiones nuevas** del alumno.

- **Se activa con `ANTHROPIC_API_KEY`.** Sin clave la tarjeta "Juego hecho por la IA" no aparece y todo
  funciona como antes (copiar prompt, pegar el codigo, aprobar).
- El borrador es privado: no aparece en la pantalla del alumno, ni en la galeria, ni en `/jugar` hasta que el
  profe aprueba con **Aprobar y enviar al alumno** (el mismo camino de siempre).
- **Rehacer** parte del codigo que el profe tiene en el editor (con sus ajustes a mano), el pedido original y
  los cambios pedidos antes. Se puede **cancelar** una generacion en curso y **reintentar** si fallo. Publicar
  a mano mientras la IA trabaja cancela ese intento y descarta su resultado.
- Los intentos viven en la tabla `ai_attempts` (varios por version). Si el servidor se reinicia, los que
  estaban en cola o generando se retoman (maximo 2 intentos antes de marcarlos con error).
- Si el `<script>` del juego tiene un error de sintaxis, el borrador igual se guarda con un aviso para pedir
  que lo rehaga.
- Los juegos que ya estaban pendientes al activar la funcion **no** se generan solos: tienen el boton
  **Generar con IA**.

Variables (todas opcionales salvo la clave; un valor invalido vuelve al por defecto):

| Variable | Por defecto | Que hace |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | vacia | Activa la funcion. Nunca llega al navegador. |
| `ANTHROPIC_MODEL` | `claude-opus-5-5` | Modelo a usar. |
| `AI_EFFORT` | `medium` | Esfuerzo de razonamiento: `low`, `medium`, `high`, `xhigh`, `max`. |
| `AI_AUTO` | `true` | `false` apaga la generacion al enviar; queda solo el boton manual. |
| `AI_MAX_CONCURRENCY` | `3` | Generaciones en paralelo; el resto espera en cola. |
| `AI_DAILY_LIMIT` | `150` | Tope en las ultimas 24 h. Al llegar, lo automatico deja un aviso en el panel y el boton responde 429. |

La app no tiene login, asi que estos topes (mas un solo intento activo por version y limites de largo en el
pedido y en los cambios) son la proteccion del gasto. Cada generacion larga con un modelo grande cuesta
dinero real: ajusta `AI_DAILY_LIMIT` a tu presupuesto.

En desarrollo, `npm run dev` lee un archivo `.env` (en la raiz o en `server/`) si existe; hace falta Node 22.9 o
mas. Ponele ahi solo las variables de IA: el resto de `.env.example` es para produccion (`DATABASE_PATH=/data/...`). En produccion las variables llegan por `docker-compose.yml` (Coolify las toma de su panel).

### Probar sin gastar

```bash
node server/test/fake-anthropic.js 4010        # falso de la API: devuelve un juego chico tras ~3 s
ANTHROPIC_BASE_URL=http://127.0.0.1:4010 ANTHROPIC_API_KEY=cualquiera npm run dev:server
npm test --prefix server                       # tests con node:test contra ese mismo falso
```

## Notas tecnicas

- **Miniaturas de la galeria:** el servidor abre cada juego en un Chromium headless con ventana de 1280x800
  y le saca una foto (`<data>/thumbs/<iterationId>.webp`, servida en `/api/iterations/:id/thumb`). Se hace
  al publicar o corregir un juego y, al arrancar, para los que falten. El juego corre sin acceso a la red.
  Sin navegador (`THUMBS_BROWSER`; se apaga con `THUMBS_DISABLED=1`) la galeria muestra la preview viva.
  En local usa el Chrome instalado; la imagen de Docker trae `chromium` y fuentes de emoji.
- **Juego en el celu:** en pantallas chicas el juego se dibuja a 1280x800 y se achica entero, sin recortes.
  Los controles tactiles mandan `postMessage` y un script que se agrega al servir el juego los convierte en
  `keydown`/`keyup` de flechas, espacio y enter, asi que tambien andan los juegos ya publicados.

- Los juegos corren dentro de un `iframe` con `sandbox` sin `allow-same-origin`, o sea que no pueden tocar
  la sesion ni los datos de la app. Como eso rompe `localStorage`, se inyecta un reemplazo en memoria para
  que los juegos que guardan el puntaje maximo sigan funcionando.
- Los errores de JavaScript del juego se reportan al contenedor con `postMessage` y se muestran tanto al
  profe como al alumno, que puede convertirlos en el proximo pedido de arreglo con un clic.
- Al copiar o enviar un prompt, el sistema le concatena las reglas tecnicas (un unico archivo HTML, sin
  librerias externas, manejo de errores, formato de respuesta). El alumno solo ve la version legible.
