/**
 * El prompt es un documento con huecos, organizado en 3 bloques pedagogicos:
 * La Orden (rol + mision), La Idea (detalles creativos) y El Formato (reglas
 * tecnicas). Cada linea puede ser:
 * - `{ text }`: texto fijo que el alumno no puede romper.
 * - `{ label, field }`: etiqueta + hueco editable ("Titulo: [hueco]").
 *   Si tiene `options`, se muestran como chips seleccionables de un clic.
 *
 * Las lineas marcadas como `optional` desaparecen del prompt final si su hueco
 * quedo vacio, asi el texto que se copia nunca queda cojo.
 */

export const INITIAL_FIELDS = {
  title: '',
  studentName: '',
  gameType: '',
  character: '',
  setting: '',
  winRule: '',
  loseRule: '',
  controls: '',
  extra: ''
}

export const ITERATION_FIELDS = {
  fix: '',
  visual: '',
  rule: '',
  extra: ''
}

const GAME_TYPE_OPTIONS = [
  'esquivar obstáculos',
  'responder preguntas',
  'atrapar cosas',
  'saltar entre plataformas',
  'recorrer un laberinto',
  'encontrar pares de cartas',
  'correr una carrera',
  'vivir una aventura con decisiones',
  'hacer clic para sumar puntos',
  'apuntar y disparar a objetivos'
]

const CONTROL_OPTIONS = [
  'las flechas del teclado',
  'las flechas y la barra espaciadora',
  'el mouse',
  'botones grandes en la pantalla',
  'las teclas A y D y el espacio'
]

/* --------------------------------------------------------------- bloques */

/**
 * Los 3 bloques visibles del prompt. Separadores sutiles de la interfaz, no
 * parte del texto que se copia: ayudan a entender que a la IA hay que darle
 * la orden, la idea y el formato.
 */
export const INITIAL_SECTIONS = [
  { id: 'order', title: 'La Orden' },
  { id: 'idea', title: 'La Idea' },
  { id: 'format', title: 'El Formato' }
]

/* ------------------------------------------------------------- plantillas */

export const INITIAL_LINES = [
  // La Orden: quien es la IA y que tiene que hacer.
  { section: 'order', id: 'act', text: 'Actúa como: un creador de videojuegos experto.' },
  { section: 'order', id: 'mission', text: 'Tu misión es: inventar un juego web divertido y fácil de jugar.' },
  // La Idea: frases en prosa con huecos, como las escribiria una persona.
  { section: 'idea', id: 'title', tokens: [{ text: 'El título de mi juego es ' }, { field: 'title', placeholder: 'Mi Súper Juego' }, { text: '.' }] },
  { section: 'idea', id: 'author', optional: true, tokens: [{ text: 'Lo creó ' }, { field: 'studentName', placeholder: 'tu nombre o el del equipo' }, { text: '.' }] },
  { section: 'idea', id: 'type', tokens: [{ text: 'Mi juego consiste en ' }, { field: 'gameType', placeholder: 'elegí una idea o escribí la tuya', options: GAME_TYPE_OPTIONS }, { text: '.' }] },
  { section: 'idea', id: 'character', tokens: [{ text: 'El personaje principal es ' }, { field: 'character', placeholder: 'un gato espacial' }, { text: '.' }] },
  { section: 'idea', id: 'setting', optional: true, tokens: [{ text: 'Todo pasa en ' }, { field: 'setting', placeholder: 'la Luna' }, { text: '.' }] },
  { section: 'idea', id: 'win', tokens: [{ text: 'Se gana ' }, { field: 'winRule', placeholder: 'juntando 10 estrellas' }, { text: '.' }] },
  { section: 'idea', id: 'lose', optional: true, tokens: [{ text: 'Se pierde ' }, { field: 'loseRule', placeholder: 'si toco un meteorito' }, { text: '.' }] },
  { section: 'idea', id: 'controls', optional: true, tokens: [{ text: 'Se juega con ' }, { field: 'controls', placeholder: 'las flechas del teclado o un clic del mouse', options: CONTROL_OPTIONS }, { text: '.' }] },
  { section: 'idea', id: 'extra', optional: true, tokens: [{ text: 'Además quiero que ' }, { field: 'extra', placeholder: 'haya música o sonidos al ganar', multiline: true }, { text: '.' }] },
  // El Formato: las reglas tecnicas visibles en lenguaje natural.
  {
    section: 'format',
    id: 'code',
    text: 'Hazlo en un solo archivo HTML para que funcione en el navegador, con colores llamativos y un botón para volver a jugar.',
    spaced: true
  }
]

export const ITERATION_LINES = [
  {
    id: 'intro',
    tokens: [
      { text: 'Segui trabajando sobre el mismo juego. Aplica todos estos cambios juntos, en una sola version nueva:' }
    ]
  },
  {
    id: 'fix',
    optional: true,
    tokens: [
      { text: '1. Arreglar este error: ' },
      { field: 'fix', placeholder: 'que pasa mal y cuando pasa', multiline: true },
      { text: '.' }
    ]
  },
  {
    id: 'visual',
    optional: true,
    tokens: [
      { text: '2. Mejorar como se ve: ' },
      { field: 'visual', placeholder: 'colores, tamanos, animaciones, pantallas', multiline: true },
      { text: '.' }
    ]
  },
  {
    id: 'rule',
    optional: true,
    tokens: [
      { text: '3. Agregar esto nuevo: ' },
      { field: 'rule', placeholder: 'una regla, un enemigo, un nivel, un power-up', multiline: true },
      { text: '.' }
    ]
  },
  {
    id: 'extra',
    optional: true,
    tokens: [
      { text: '4. Tambien: ' },
      { field: 'extra', placeholder: 'cualquier otro cambio', multiline: true },
      { text: '.' }
    ]
  },
  {
    id: 'closing',
    tokens: [{ text: 'Todo lo que ya funcionaba tiene que seguir igual.' }]
  }
]

/* -------------------------------------------------------------- builders */

function lineFields(line) {
  if (line.field) return [line.field]
  return line.tokens.filter((token) => token.field).map((token) => token.field)
}

function lineHasContent(line, values) {
  return lineFields(line).some((key) => (values[key] || '').trim())
}

function renderLine(line, values) {
  if (line.text) return line.text
  if (line.field) return `${line.label}: ${(values[line.field] || '').trim()}`
  return line.tokens
    .map((token) => (token.field ? (values[token.field] || '').trim() : token.text))
    .join('')
    .replace(/\s+([.,])/g, '$1')
}

/** Texto legible: exactamente lo que el alumno ve en pantalla. */
export function renderPrompt(lines, values) {
  return lines
    .filter((line) => !line.optional || lineHasContent(line, values))
    .map((line) => `${line.spaced ? '\n' : ''}${renderLine(line, values)}`)
    .join('\n')
}

/** Campos obligatorios que siguen vacios. */
export function missingRequired(lines, values, required) {
  return required.filter((key) => !(values[key] || '').trim())
}

export const INITIAL_REQUIRED = ['title', 'gameType', 'character', 'winRule']

export function countFilled(lines, values) {
  const keys = lines.flatMap(lineFields)
  return keys.filter((key) => (values[key] || '').trim()).length
}

/* --------------------------------------------------- instrucciones ocultas */

/**
 * Reglas de formato que se pegan al final al copiar o enviar.
 * Solo definen COMO tiene que venir la respuesta, no que juego hacer:
 * el contenido creativo queda entero en manos del alumno.
 */
export const TECHNICAL_INSTRUCTIONS = `
--- FORMATO DE LA RESPUESTA (instrucciones para la IA) ---
1. Devolve UN UNICO archivo HTML completo y autonomo, desde <!DOCTYPE html> hasta </html>, con el CSS dentro de <style> y el JavaScript dentro de <script>.
2. Responde SOLO con ese codigo, dentro de un unico bloque \`\`\`html ... \`\`\`, sin explicaciones antes ni despues.
3. No uses librerias externas, CDNs, imagenes por URL, fuentes remotas ni pedidos a internet: tiene que funcionar sin conexion.
4. Los graficos se hacen por codigo: <canvas>, CSS, formas o texto.
5. Que ocupe todo el ancho y el alto disponibles y se adapte al tamano de la ventana (escucha el evento resize).
6. No uses alert(), prompt() ni confirm(): los mensajes se muestran dentro del juego.
7. Si guardas datos en el navegador, envolvelo en try/catch y segui funcionando aunque falle.
8. Que no se rompa: nada de variables sin definir ni recursos que no existan, pase lo que pase con el teclado o el mouse.
9. Comenta el codigo en espanol, con frases cortas.
10. Respeta el pedido tal como esta escrito arriba. Si algo no se entiende, elegi la interpretacion mas divertida y seguí adelante.
`.trim()

export const ITERATION_INSTRUCTIONS = `
--- FORMATO DE LA RESPUESTA (instrucciones para la IA) ---
A. Devolve el archivo HTML COMPLETO de nuevo, desde <!DOCTYPE html> hasta </html>. Nunca fragmentos, nunca "el resto queda igual", nunca "...".
B. Conserva todo lo que ya funcionaba: mecanicas, puntaje, pantallas y estilo, salvo lo que se pide cambiar.
C. Mismas reglas de siempre: un unico archivo, sin librerias ni recursos externos, respuesta en un unico bloque \`\`\`html ... \`\`\` y sin explicaciones.
D. Si un pedido rompe el juego, resolvelo de la forma mas parecida posible y dejalo andando.
`.trim()

export function withInstructions(readable, instructions) {
  return `${readable}\n\n${instructions}`
}
