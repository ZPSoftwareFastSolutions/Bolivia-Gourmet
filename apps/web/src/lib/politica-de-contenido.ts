/**
 * Content-Security-Policy de las PÁGINAS (ADR 0006).
 *
 * Función pura: recibe el nonce y el entorno y devuelve la cabecera. Así se
 * prueba sin servidor (tests/seguridad.test.ts) y el proxy solo la aplica.
 *
 * Lo esencial:
 *   - Sin `'unsafe-inline'` en scripts ni en estilos en producción. Un script
 *     o un manejador inyectado (`<img onerror>`, `javascript:`) no se ejecuta.
 *   - `'strict-dynamic'`: los scripts de Next llevan el nonce y pueden cargar
 *     los trozos que piden; nada más.
 *   - Por eso NINGÚN componente usa el atributo `style` (la CSP lo ignora) ni
 *     `next/image`, que lo añade siempre. Una prueba lo vigila.
 *   - `connect-src 'self'`: el navegador no habla con Supabase. Todo acceso a
 *     datos y a la sesión ocurre en el servidor (Server Components y Server
 *     Actions), así que la clave publicable ni siquiera viaja al navegador.
 *   - `frame-src` solo para el mapa de Google, que se carga al pulsar.
 */

export interface OpcionesDePolitica {
  readonly nonce: string;
  readonly desarrollo: boolean;
}

/** Nonce de 128 bits en base64. Distinto en cada respuesta. */
export function nuevoNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario);
}

export function politicaDeContenido({ nonce, desarrollo }: OpcionesDePolitica): string {
  const directivas: Record<string, readonly string[]> = {
    'default-src': ["'self'"],
    // En `next dev` React usa eval para reconstruir pilas de error del
    // servidor. Nunca en producción (lo comprueba una prueba).
    'script-src': ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(desarrollo ? ["'unsafe-eval'"] : [])],
    // La capa de errores de `next dev` inyecta estilos en línea.
    'style-src': ["'self'", ...(desarrollo ? ["'unsafe-inline'"] : [`'nonce-${nonce}'`])],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'"],
    // `next dev` recarga en caliente por WebSocket.
    'connect-src': ["'self'", ...(desarrollo ? ['ws:', 'wss:'] : [])],
    'media-src': ["'self'"],
    'frame-src': ['https://www.google.com', 'https://maps.google.com'],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'self'"],
    'object-src': ["'none'"],
    'manifest-src': ["'self'"],
    'worker-src': ["'self'"],
  };

  const politica = Object.entries(directivas).map(([nombre, valores]) => `${nombre} ${valores.join(' ')}`);
  // En http://localhost subiría las peticiones a https y rompería el sitio.
  if (!desarrollo) politica.push('upgrade-insecure-requests');
  return politica.join('; ');
}

/**
 * Política para lo que NO es una página (imágenes, CSS, JS, iconos). No
 * ejecuta nada: cubre también un SVG abierto directamente, que es un
 * documento y podría llevar scripts.
 */
export const POLITICA_DE_ARCHIVOS = [
  "default-src 'none'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
