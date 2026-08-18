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

## Notas tecnicas

- Los juegos corren dentro de un `iframe` con `sandbox` sin `allow-same-origin`, o sea que no pueden tocar
  la sesion ni los datos de la app. Como eso rompe `localStorage`, se inyecta un reemplazo en memoria para
  que los juegos que guardan el puntaje maximo sigan funcionando.
- Los errores de JavaScript del juego se reportan al contenedor con `postMessage` y se muestran tanto al
  profe como al alumno, que puede convertirlos en el proximo pedido de arreglo con un clic.
- Al copiar o enviar un prompt, el sistema le concatena las reglas tecnicas (un unico archivo HTML, sin
  librerias externas, manejo de errores, formato de respuesta). El alumno solo ve la version legible.
