// Utilitários simples para persistência em localStorage

/**
 * Lê um valor JSON do localStorage.
 * @param {string} key
 * @param {any} fallback
 */
export function readFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

/**
 * Escreve um valor JSON no localStorage.
 * @param {string} key
 * @param {any} value
 */
export function writeToStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Gera um ID simples incremental por coleção.
 * @param {string} sequenceKey
 */
export function nextId(sequenceKey) {
  const current = Number(readFromStorage(sequenceKey, 0)) || 0;
  const next = current + 1;
  writeToStorage(sequenceKey, next);
  return next;
}


