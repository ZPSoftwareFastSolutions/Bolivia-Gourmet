/**
 * Destinos de redirección seguros.
 *
 * Los enlaces de confirmación y recuperación llevan `?siguiente=/portal/...`.
 * Si se aceptara cualquier valor, un correo falso con
 * `?siguiente=https://sitio-malicioso` usaría nuestro dominio para mandar a la
 * víctima a otro sitio justo después de iniciar sesión (redirección abierta).
 * Solo se aceptan rutas internas del portal y del panel interno; lo demás cae
 * al portal (que lleva al personal a su panel).
 */

const DESTINO_POR_DEFECTO = '/portal';

/** Rutas a las que se puede volver tras autenticarse. */
const PREFIJOS_PERMITIDOS = ['/portal', '/panel'] as const;

export function destinoSeguro(valor: string | null | undefined): string {
  if (!valor) return DESTINO_POR_DEFECTO;
  const limpio = valor.trim();
  // Debe ser una ruta absoluta del propio sitio: empieza por «/» pero no por
  // «//» ni «/\» (que el navegador interpreta como otro dominio).
  if (!limpio.startsWith('/') || limpio.startsWith('//') || limpio.startsWith('/\\')) return DESTINO_POR_DEFECTO;
  if (/[\r\n\t]/.test(limpio) || limpio.includes('://')) return DESTINO_POR_DEFECTO;
  const ruta = limpio.split(/[?#]/)[0] ?? '';
  const permitido = PREFIJOS_PERMITIDOS.some((p) => ruta === p || ruta.startsWith(`${p}/`));
  return permitido ? limpio : DESTINO_POR_DEFECTO;
}
