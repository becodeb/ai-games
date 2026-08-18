/**
 * El prompt es un documento con huecos.
 *
 * Cada linea es una frase fija (que el alumno no puede romper) con uno o mas
 * huecos editables. Las lineas marcadas como `optional` desaparecen del prompt
 * final si su hueco quedo vacio, asi el texto que se copia nunca queda cojo.
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

const TYPE_SUGGESTIONS = [
  'de plataformas, saltando entre plataformas',
  'de esquivar cosas que caen',
  'de atrapar objetos que caen',
  'de preguntas y respuestas',
  'de aventura con texto y decisiones',
  'de hacer clic para sumar puntos',
  'de laberinto',
  'de encontrar pares de cartas',
  'de carreras vista desde arriba',
  'de disparar a objetivos'
]

const CONTROL_SUGGESTIONS = [
  'las flechas del teclado',
  'las flechas y la barra espaciadora',
  'el mouse',
  'botones grandes en la pantalla',
  'las teclas A y D para moverse y espacio para saltar'
]

/* ------------------------------------------------------------- plantillas */

export const INITIAL_LINES = [
  {
    id: 'intro',
    tokens: [
      {
        text:
          'Programa un videojuego para jugar en el navegador. Tiene que ser un solo archivo con HTML, CSS y JavaScript.'
      }
    ]
  },
  {
    id: 'title',
    tokens: [{ text: 'El juego se llama ' }, { field: 'title', placeholder: 'el nombre que quieras' }, { text: '.' }]
  },
  {
    id: 'author',
    optional: true,
    tokens: [{ text: 'Lo invento ' }, { field: 'studentName', placeholder: 'tu nombre o el del equipo' }, { text: '.' }]
  },
  {
    id: 'type',
    tokens: [
      { text: 'Es un juego ' },
      { field: 'gameType', placeholder: 'conta como se juega', suggestions: TYPE_SUGGESTIONS, grow: true },
      { text: '.' }
    ]
  },
  {
    id: 'character',
    tokens: [
      { text: 'El personaje principal es ' },
      { field: 'character', placeholder: 'quien es y como se ve', grow: true },
      { text: '.' }
    ]
  },
  {
    id: 'setting',
    optional: true,
    tokens: [
      { text: 'Todo pasa en ' },
      { field: 'setting', placeholder: 'donde transcurre, que se ve de fondo', grow: true },
      { text: '.' }
    ]
  },
  {
    id: 'win',
    tokens: [{ text: 'Se gana cuando ' }, { field: 'winRule', placeholder: 'que hay que lograr', grow: true }, { text: '.' }]
  },
  {
    id: 'lose',
    optional: true,
    tokens: [{ text: 'Se pierde cuando ' }, { field: 'loseRule', placeholder: 'que hace perder', grow: true }, { text: '.' }]
  },
  {
    id: 'controls',
    optional: true,
    tokens: [
      { text: 'Se juega con ' },
      { field: 'controls', placeholder: 'como se maneja', suggestions: CONTROL_SUGGESTIONS, grow: true },
      { text: '.' }
    ]
  },
  {
    id: 'extra',
    optional: true,
    tokens: [
      { text: 'Ademas quiero que ' },
      { field: 'extra', placeholder: 'todo lo que se te ocurra: niveles, enemigos, sonidos, power-ups...', multiline: true },
      { text: '.' }
    ]
  },
  {
    id: 'closing',
    tokens: [{ text: 'Que se entienda facil, que se vea lindo y que se pueda volver a jugar cuando termina.' }]
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
  return line.tokens.filter((token) => token.field).map((token) => token.field)
}

function lineHasContent(line, values) {
  return lineFields(line).some((key) => (values[key] || '').trim())
}

function renderLine(line, values) {
  return line.tokens
    .map((token) => (token.field ? (values[token.field] || '').trim() : token.text))
    .join('')
    .replace(/\s+([.,])/g, '$1')
}

/** Texto legible: exactamente lo que el alumno ve en pantalla. */
export function renderPrompt(lines, values) {
  return lines
    .filter((line) => !line.optional || lineHasContent(line, values))
    .map((line) => renderLine(line, values))
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
