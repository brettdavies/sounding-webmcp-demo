/**
 * Boot mode resolution — no Three.js imports (Node-safe for verify scripts).
 */

/**
 * @param {URLSearchParams} params
 * @returns {'sea' | 'land'}
 */
export function resolveBootMode(params) {
  return params.get('focus') === 'land' ? 'land' : 'sea';
}
