/**
 * Las IAs responden casi siempre con el codigo dentro de un bloque markdown.
 * Limpiamos las comillas invertidas para que el profesor pueda pegar tal cual.
 */
export function stripCodeFences(text) {
  const value = String(text ?? '')
  const closed = value.match(/^\s*```[a-zA-Z]*\s*\r?\n([\s\S]*?)\r?\n?\s*```\s*$/)
  if (closed) return closed[1]

  return value.replace(/^\s*```[a-zA-Z]*\s*\r?\n?/, '').replace(/\r?\n?\s*```\s*$/, '')
}

export function looksLikeFullDocument(html) {
  return /<html[\s>]/i.test(html) || /<!doctype\s+html/i.test(html)
}
