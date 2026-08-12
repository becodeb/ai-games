/**
 * Construccion de prompts.
 *
 * - `readable`: lo que el alumno ve en pantalla. Lenguaje simple, nombra HTML/CSS/JS
 *   para que el profesor pueda explicar que se esta pidiendo.
 * - `full`: readable + instrucciones tecnicas ocultas que se agregan al copiar o enviar.
 */

export const GAME_TYPES = [
  { value: 'plataformas', label: 'Plataformas 2D', hint: 'Saltar entre plataformas y esquivar obstaculos.' },
  { value: 'esquivar', label: 'Esquivar objetos', hint: 'Moverse para no chocar con cosas que caen.' },
  { value: 'atrapar', label: 'Atrapar cosas', hint: 'Juntar objetos buenos y evitar los malos.' },
  { value: 'preguntas', label: 'Preguntas y respuestas', hint: 'Trivia con opciones y puntaje.' },
  { value: 'aventura', label: 'Aventura de texto', hint: 'Historia con decisiones y finales distintos.' },
  { value: 'clicker', label: 'Clicker', hint: 'Hacer clic para sumar puntos y desbloquear mejoras.' },
  { value: 'laberinto', label: 'Laberinto', hint: 'Llegar a la salida sin tocar las paredes.' },
  { value: 'memoria', label: 'Memoria', hint: 'Dar vuelta cartas y encontrar los pares.' },
  { value: 'personalizado', label: 'Otro (lo escribo yo)', hint: 'Describi vos la mecanica del juego.' }
]

export const CONTROL_OPTIONS = [
  { value: 'teclado', label: 'Flechas del teclado' },
  { value: 'teclado-espacio', label: 'Flechas + barra espaciadora' },
  { value: 'mouse', label: 'Mouse' },
  { value: 'clics', label: 'Clics en botones de la pantalla' },
  { value: 'teclado-mouse', label: 'Teclado y mouse' }
]

export const INITIAL_FIELDS = {
  title: '',
  studentName: '',
  gameType: 'plataformas',
  customGameType: '',
  character: '',
  setting: '',
  winRule: '',
  loseRule: '',
  controls: 'teclado',
  extra: ''
}

export const ITERATION_FIELDS = {
  fix: '',
  visual: '',
  rule: '',
  extra: ''
}

export const ITERATION_SLOTS = [
  {
    key: 'fix',
    label: 'Arreglo de error',
    placeholder: 'Ej.: cuando toco el borde derecho el personaje desaparece.',
    hint: 'Conta que pasa mal y cuando pasa.'
  },
  {
    key: 'visual',
    label: 'Mejora visual',
    placeholder: 'Ej.: que el fondo sea un cielo con estrellas y el personaje mas grande.',
    hint: 'Colores, tamanos, animaciones, pantalla de inicio.'
  },
  {
    key: 'rule',
    label: 'Regla o mecanica nueva',
    placeholder: 'Ej.: agregar un enemigo que aparece cada 10 segundos.',
    hint: 'Algo nuevo que el juego todavia no hace.'
  },
  {
    key: 'extra',
    label: 'Otro cambio (opcional)',
    placeholder: 'Ej.: mostrar el puntaje maximo en la esquina.',
    hint: 'Solo si te queda algo afuera.'
  }
]

function labelForGameType(fields) {
  if (fields.gameType === 'personalizado') {
    return (fields.customGameType || '').trim() || 'un juego original inventado por mi'
  }
  const found = GAME_TYPES.find((t) => t.value === fields.gameType)
  return found ? found.label.toLowerCase() : 'juego 2D simple'
}

function labelForControls(value) {
  const found = CONTROL_OPTIONS.find((c) => c.value === value)
  return found ? found.label.toLowerCase() : 'flechas del teclado'
}

function orDefault(value, fallback) {
  const text = (value || '').trim()
  return text || fallback
}

/** Reglas de formato que se pegan al final del prompt, invisibles para el alumno. */
export const TECHNICAL_INSTRUCTIONS = `
--- INSTRUCCIONES TECNICAS (para la IA, no las expliques en la respuesta) ---
1. Devolve UN UNICO archivo HTML completo y autonomo: el CSS dentro de una etiqueta <style> y todo el JavaScript dentro de una etiqueta <script>, en el mismo archivo.
2. Respondé SOLO con el codigo, dentro de un unico bloque \`\`\`html ... \`\`\`. Sin explicaciones antes ni despues.
3. Prohibido usar librerias externas, CDNs, imagenes por URL, fuentes remotas, audio externo o fetch a internet: el juego tiene que funcionar sin conexion.
4. Los graficos se hacen con <canvas>, CSS, formas geometricas o caracteres de texto dibujados por codigo.
5. El juego debe ocupar el 100% del ancho y del alto disponibles, adaptarse al tamano de la ventana (escuchar el evento resize) y verse bien dentro de un iframe.
6. Incluí: pantalla de inicio con las instrucciones y un boton "Empezar", marcador visible durante la partida, y pantalla final con el resultado y un boton "Volver a jugar".
7. Manejo de errores: nada de variables sin definir ni recursos inexistentes. El juego no se tiene que romper si el jugador aprieta cualquier tecla o hace clic en cualquier lado. Envolvé en try/catch lo que pueda fallar.
8. No uses alert(), prompt() ni confirm(). Los mensajes se muestran dentro de la pantalla del juego.
9. Si guardas el puntaje maximo, tolera que el almacenamiento del navegador no este disponible (usa try/catch y segui funcionando igual).
10. Compatible con las versiones actuales de Chrome, Firefox y Edge. Nada experimental.
11. Comenta el codigo en espanol, con frases cortas, para que lo pueda leer un chico de 10 a 14 anos.
12. El juego tiene que arrancar y ser jugable apenas se abre el archivo, sin ningun paso extra.
`.trim()

/** Prompt inicial en la version simple que ve el alumno. */
export function buildInitialReadable(fields) {
  const lines = [
    'Quiero que programes un videojuego que se juegue en el navegador, con HTML, CSS y JavaScript en un solo archivo.',
    '',
    `Titulo del juego: ${orDefault(fields.title, 'Mi juego')}`,
    `Tipo de juego: ${labelForGameType(fields)}`,
    `Protagonista: ${orDefault(fields.character, 'un personaje simple hecho con formas')}`,
    `Escenario y fondo: ${orDefault(fields.setting, 'un fondo simple de un solo color')}`,
    `Se gana cuando: ${orDefault(fields.winRule, 'el jugador llega al final del nivel')}`,
    `Se pierde cuando: ${orDefault(fields.loseRule, 'el jugador choca con un obstaculo')}`,
    `Se juega con: ${labelForControls(fields.controls)}`
  ]

  if ((fields.extra || '').trim()) {
    lines.push(`Detalle especial: ${fields.extra.trim()}`)
  }

  lines.push(
    '',
    'Que el juego sea facil de entender, que se vea lindo y que se pueda volver a jugar cuando termina.'
  )

  return lines.join('\n')
}

/** Prompt inicial enriquecido: es el que se copia al portapapeles y ve el profesor. */
export function buildInitialFull(fields) {
  return `${buildInitialReadable(fields)}\n\n${TECHNICAL_INSTRUCTIONS}`
}

export function countIterationChanges(fields) {
  return ITERATION_SLOTS.filter((slot) => (fields[slot.key] || '').trim()).length
}

/** Prompt de iteracion en version simple. */
export function buildIterationReadable(fields, context = {}) {
  const title = orDefault(context.title, 'mi juego')
  const version = context.version || 1

  const changes = ITERATION_SLOTS
    .filter((slot) => (fields[slot.key] || '').trim())
    .map((slot, index) => `${index + 1}. ${slot.label}: ${fields[slot.key].trim()}`)

  return [
    `Segui trabajando sobre el mismo juego "${title}" (version ${version}).`,
    'Aplica TODOS estos cambios juntos, en una sola version nueva:',
    '',
    ...changes,
    '',
    'Todo lo demas que ya funcionaba tiene que seguir igual.'
  ].join('\n')
}

/** Prompt de iteracion enriquecido. */
export function buildIterationFull(fields, context = {}) {
  const extra = `
--- INSTRUCCIONES TECNICAS DE LA ITERACION ---
A. Devolvé el archivo HTML COMPLETO de nuevo, desde <!DOCTYPE html> hasta </html>. Nunca fragmentos, nunca "el resto queda igual", nunca "...".
B. Conservá todo lo que ya andaba: mecanicas, puntaje, pantallas y estilo, salvo lo que se pide cambiar.
C. Mantené las mismas reglas de formato: un unico archivo, sin librerias ni recursos externos, respuesta en un unico bloque \`\`\`html ... \`\`\` y sin explicaciones.
D. Si un pedido es imposible o rompe el juego, resolvelo de la forma mas parecida posible y dejalo funcionando igual.
`.trim()

  return `${buildIterationReadable(fields, context)}\n\n${extra}`
}
