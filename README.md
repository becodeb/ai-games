# STEAMLAB — Taller de juegos con IA

Aplicacion web para un taller escolar donde los chicos escriben el *prompt*, un profe lo ejecuta en la IA
(Gemini / ChatGPT / Claude) y pega el codigo resultante. El juego aparece en la pantalla del alumno en tiempo real.

## Que incluye

| Ruta | Quien la usa | Que hace |
| --- | --- | --- |
| `/` | Alumno | Crear un juego nuevo o continuar uno existente |
| `/nuevo` | Alumno | Formulario guiado que arma el primer prompt |
| `/proyecto/:id` | Alumno | Linea de tiempo: prompt → juego → prompt de mejoras → juego |
| `/dashboard` | Profesor | Todos los proyectos, con los pendientes destacados arriba |
| `/dashboard/:id` | Profesor | Prompt a la izquierda, codigo de la IA a la derecha, preview en vivo |
| `/galeria` | Publico | Grid con todos los juegos jugables |
| `/jugar/:iterationId` | Publico | El juego a pantalla completa |

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

```bash
docker compose up --build -d
```

Queda en http://localhost:3000. Los datos viven en el volumen `steamlab-data` montado en `/data`.

## Deploy en Coolify

1. En Coolify: **New Resource → Docker Compose** (o **Public Repository** si conectas el repo de Git).
2. Repositorio: el de este proyecto. Branch: `main`. Compose file: `docker-compose.yml`.
3. Coolify detecta el servicio `app` y el puerto **3000**. Asigna el dominio a ese puerto.
4. Variables de entorno: no hace falta tocar nada; los valores por defecto ya estan en el compose.
   Si queres cambiarlos, copia `.env.example`.
5. **Importante:** dejar declarado el volumen `steamlab-data → /data` para no perder los juegos en cada deploy.
6. Deploy. El healthcheck pega contra `/api/health`.

El contenedor sirve la API, los WebSockets y el frontend estatico en el mismo puerto, asi que no hay que
configurar CORS ni un segundo servicio. El proxy de Coolify (Traefik) soporta WebSockets sin configuracion extra.

## Como se usa en clase

1. El alumno completa el formulario en `/nuevo` y aprieta **Enviar a los profes**.
2. El proyecto aparece destacado en `/dashboard`.
3. El profe entra al proyecto, aprieta **Copiar prompt para la IA** y lo pega en el chat de la IA.
   Puede guardar el enlace del chat para no perder el hilo entre iteraciones.
4. Pega la respuesta en el area de codigo (archivo unico o HTML/CSS/JS por separado). La previsualizacion
   muestra el juego antes de publicarlo.
5. **Aprobar y enviar al alumno**: el juego aparece en la pantalla del chico al instante, sin recargar.
6. El alumno pide mejoras agrupando varios cambios en un solo pedido y el ciclo se repite.

El profe puede volver a cualquier version anterior desde los chips `v1`, `v2`, … y corregir su codigo:
el cambio se refleja en vivo en la vista del alumno.

## Notas tecnicas

- Los juegos corren dentro de un `iframe` con `sandbox` sin `allow-same-origin`, o sea que no pueden tocar
  la sesion ni los datos de la app. Como eso rompe `localStorage`, se inyecta un reemplazo en memoria para
  que los juegos que guardan el puntaje maximo sigan funcionando.
- Los errores de JavaScript del juego se reportan al contenedor con `postMessage` y se muestran tanto al
  profe como al alumno, que puede convertirlos en el proximo pedido de arreglo con un clic.
- Al copiar o enviar un prompt, el sistema le concatena las reglas tecnicas (un unico archivo HTML, sin
  librerias externas, manejo de errores, formato de respuesta). El alumno solo ve la version legible.
