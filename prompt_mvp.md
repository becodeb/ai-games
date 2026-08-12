Actúa como un Desarrollador Full-Stack Senior y Diseñador de UX/UI. Necesito que crees una aplicación web completa, funcional y lista para producción, destinada a un taller escolar de programación con inteligencia artificial para niños. 

La aplicación debe ser ultra minimalista, limpia, moderna y profesional (estilo Vercel/Linear), sin usar emojis ni estética infantil barroca ("AI slop"). Debe estar optimizada para ser desplegada mediante Docker Compose en Coolify.

---

### 1. ARQUITECTURA TÉCNICA Y DEPLOYMENT

* **Stack Sugerido:** Next.js (App Router) o Node.js/Express + Frontend en React (Single Page Application), con SQLite/Prisma o PostgreSQL para almacenamiento persistente liviano, y **Socket.io** para la comunicación en tiempo real entre el dashboard del profesor y la vista del alumno.
* **Infraestructura:** Proporciona un archivo `docker-compose.yml` y un `Dockerfile` optimizado (multi-stage build) listo para conectar y desplegar en Coolify sin configuraciones adicionales.

---

### 2. VISTAS Y FLUJOS DE USUARIO

#### A. VISTA ALUMNO (`/`)

1. **Pantalla Inicial / Recuperación de Sesión:**
   * Al ingresar, hay dos opciones principales: **"Crear nuevo juego"** o **"Continuar un juego existente"**.
   * Si eligen "Continuar", se despliega una lista o modal con los títulos de los juegos creados. Al hacer clic en el suyo, recuperan su progreso exacto (prompts, juegos en renderizado, historial).
   * Un botón destacado arriba a la derecha: **"Ver Galería de Juegos"** (abre `/galeria` en una pestaña nueva).

2. **Generador del Primer Prompt (Llenado Dinámico):**
   * Un formulario tipo "Mad Libs" o por campos que arme un prompt visible en pantalla.
   * **Visualización del Prompt:** Los chicos ven una versión simplificada y legible del prompt (que incluye conceptos básicos como HTML/JS) para que el profesor pueda explicarles qué están pidiendo.
   * **Detrás de escena (Al copiar/enviar):** El sistema concatena instrucciones ocultas al final del texto para la IA (reglas de formato, respuesta en un único HTML/CSS/JS embebido, manejo de errores, apto para navegadores web, etc.).
   * **Campos del Prompt:** Deben dar suficiente libertad creativa pero guiada para modelos de IA no tan avanzados (juegos 2D de plataformas, preguntas, esquivar objetos, aventuras textuales, clickers). Campos sugeridos:
     * Título del juego.
     * Tipo/Mecánica de juego (desplegable + opción personalizada).
     * Personaje/Protagonista.
     * Fondo/Escenario.
     * Regla para ganar / Regla para perder.

3. **Acciones del Primer Prompt:**
   * **Botón "Copiar Prompt":** Copia al portapapeles el prompt enriquecido (para uso manual) e inmediatamente habilita la sección del "Segundo Prompt de Iteración" en la pantalla del chico.
   * **Botón "Enviar a los Profes":** Guarda el estado en la base de datos y marca el proyecto como "Pendiente de respuesta" en el dashboard.

4. **Línea del Tiempo Dinámica (Historial de Iteraciones):**
   * La pantalla del alumno funciona como un feed vertical donde se van apilando las iteraciones:
     * `Prompt 1` ➔ `Juego 1 (Renderizado en Iframe + Botón Pantalla Completa)`
     * `Prompt 2 (Iteración)` ➔ `Juego 2 (Renderizado en Iframe + Botón Pantalla Completa)`
     * ...y así sucesivamente.
   * **Manejo de estados:** Mientras la IA del profesor está generando el juego, el alumno ve un indicador de estado tipo *"El profesor está procesando tu juego..."* que se actualiza en tiempo real vía WebSockets tan pronto como el profesor envía el código.

5. **Prompt de Iteración (Mejoras y Arreglos):**
   * Debajo de cada juego generado aparece un nuevo formulario estructurado para iterar.
   * **Diseño anti-saturación:** Debe educar al alumno para que reúna **múltiples cambios en un solo envío** (ej.: *"1 Arreglo de error + 1 Mejora visual + 1 Nueva regla"*).
   * Contiene los mismos botones: "Copiar" y "Enviar a los profes".

---

#### B. DASHBOARD DEL PROFESOR (`/dashboard` y `/dashboard/[id]`)

1. **Vista Principal (`/dashboard`):**
   * Sin contraseñas complejas.
   * Muestra tarjetas (cards) de todos los proyectos activos con: **Título del juego**, **Nombre/Identificador**, **Estado** (Pendiente, En Proceso, Completado) e **Iteración Actual**.
   * Los proyectos pendientes de respuesta deben aparecer **destacados visualmente** en la parte superior.

2. **Vista de Detalle del Proyecto (`/dashboard/[id]`):**
   * **Campo de Enlace de la IA:** Un input para pegar y guardar la URL del chat de la IA usada (Gemini, ChatGPT, Claude) para no perder el hilo. Solo visible para el profesor.
   * **Área de Trabajo en 2 Columnas o Secciones:**
     * **Columna Izquierda:** El prompt enviado por el alumno + Botón gigante de **"Copiar Prompt para la IA"**.
     * **Columna Derecha:** Inputs de código para pegar la respuesta de la IA. Debe aceptar tanto un archivo HTML unificado como bloques separados de HTML, CSS y JS, e integrarlos automáticamente.
   * **Previsualización en Vivo:** Debajo del área de pegado, un `iframe` muestra inmediatamente cómo rinde el código pegado antes de enviarlo al chico.
   * **Botón "Aprobar y Enviar al Alumno":** Emite el evento vía WebSocket para que el juego aparezca instantáneamente en la pantalla del alumno sin recargar la página.
   * **Modificación Retroactiva:** El profesor puede editar el código HTML/JS/CSS de **cualquier iteración previa** en cualquier momento, y el cambio se refleja en tiempo real en la vista del alumno.

---

#### C. GALERÍA DE JUEGOS (`/galeria`)

* Ruta pública accesible desde un botón en la interfaz de los alumnos.
* Muestra un grid minimalista con todos los juegos creados en el taller que ya tengan al menos una versión jugable.
* Al hacer clic en un juego, se abre en un modal o vista dedicada con opción de **Jugar en Pantalla Completa**.

---

### 3. REQUISITOS TÉCNICOS Y ESTRUCTURA DE CÓDIGO

1. **WebSockets (Real-time):** Configura Socket.io para sincro bidireccional entre `/dashboard/[id]` y `/`. Si el profesor actualiza un código o aprueba un envío, el alumno debe verlo reflejado inmediatamente sin refresh.
2. **Estructura del Proyecto:** Entrega el código estructurado en carpetas estándar.
3. **Persistencia:** Guarda las iteraciones en la base de datos de manera incremental (`version_1`, `version_2`, etc.) para asegurar que **ningún juego o prompt se sobreescriba**.
4. **Archivos de Configuración:** Genera:
   * `docker-compose.yml`
   * `Dockerfile`
   * `.env.example`
   * `README.md` corto con instrucciones de despliegue en Coolify.

Por favor, genera la aplicación completa con todos los archivos necesarios.