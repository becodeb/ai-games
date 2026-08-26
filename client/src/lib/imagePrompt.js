/**
 * El prompt de imagenes es mas simple que el de juegos: en vez de un documento
 * con huecos, hay un comienzo fijo que el alumno no puede borrar y despues
 * texto libre. La idea pedagogica es la misma: el chico ve exactamente lo que
 * le va a llegar a la IA, y las reglas tecnicas se agregan solas al final.
 */

/** El arranque que ya viene escrito en el cuadro de texto del alumno. */
export const IMAGE_PREFIX = 'Generame una imagen'

/** El arranque del pedido de correccion, sobre la imagen que eligio. */
export const IMAGE_FIX_PREFIX = 'Corregi esta imagen'

export const IMAGE_PLACEHOLDER =
  ' de un gato astronauta flotando arriba de la Luna, con estilo de dibujo animado y colores brillantes...'

export const IMAGE_FIX_PLACEHOLDER =
  ': el gato tiene tres patas, arreglalo. Ademas hacela mas de noche y sacale el texto de arriba...'

/** Ideas cortas para destrabar al que no sabe por donde empezar. */
export const IMAGE_HINTS = [
  'que se ve en la imagen',
  'donde pasa',
  'de que estilo (dibujo, foto, pixel art, 3D)',
  'que colores',
  'de cerca o de lejos',
  'que sensacion tiene que dar'
]

export const IMAGE_FIX_HINTS = [
  'que esta mal',
  'que hay que sacar',
  'que hay que agregar',
  'que colores cambiar',
  'que se mantenga igual'
]

/* -------------------------------------------------------------- builders */

/** Texto legible: el comienzo fijo pegado a lo que escribio el alumno. */
export function renderImagePrompt(prefix, text) {
  const body = String(text || '').trim()
  if (!body) return prefix
  // Si arranca con puntuacion la pegamos sin espacio ("Generame una imagen: ...").
  const glue = /^[,.:;!?]/.test(body) ? '' : ' '
  return `${prefix}${glue}${body}`
}

/* --------------------------------------------------- instrucciones ocultas */

/**
 * Reglas de formato que se agregan al copiar o enviar. Solo dicen COMO tiene
 * que venir la respuesta (4 imagenes, sin texto raro), nunca que dibujar:
 * la idea queda entera en manos del alumno.
 */
export const IMAGE_INSTRUCTIONS = `
--- FORMATO DE LA RESPUESTA (instrucciones para la IA) ---
1. Genera 4 imagenes distintas de la misma idea, para poder elegir entre varias.
2. Que las 4 sean variantes de lo pedido, no 4 veces la misma: cambia el angulo, la luz o la composicion.
3. Respeta el pedido tal como esta escrito arriba. Si algo no se entiende, elegi la interpretacion mas linda y segui adelante.
4. No agregues texto ni letras dentro de la imagen, salvo que el pedido lo diga.
5. Sin marcas de agua, sin logos y sin firmas.
6. Que sea apropiada para chicos de escuela: nada violento ni de miedo.
7. Buena calidad y buena resolucion, con el sujeto principal completo y bien visible.
`.trim()

export const IMAGE_FIX_INSTRUCTIONS = `
--- FORMATO DE LA RESPUESTA (instrucciones para la IA) ---
A. Parti de la imagen de referencia que te paso y aplica TODOS los cambios pedidos arriba, juntos.
B. Todo lo demas tiene que quedar igual: el mismo personaje, el mismo estilo y los mismos colores, salvo lo que se pide cambiar.
C. Devolve otra vez 4 variantes de la imagen corregida.
D. Mismas reglas de siempre: sin texto adentro, sin marcas de agua y apta para chicos.
`.trim()

export function withImageInstructions(readable, instructions) {
  return `${readable}\n\n${instructions}`
}
