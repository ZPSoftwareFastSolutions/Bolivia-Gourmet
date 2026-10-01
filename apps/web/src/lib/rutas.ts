/**
 * Rutas del sitio en un solo lugar. Un enlace roto por una errata en una ruta
 * escrita a mano en un componente es el tipo de fallo que nadie ve hasta que
 * un visitante lo encuentra.
 */

export const RUTAS = {
  inicio: '/',
  nosotros: '/nosotros',
  carrera: '/carrera',
  cursos: '/cursos',
  convenios: '/convenios',
  contacto: '/contacto',
  privacidad: '/privacidad',
  portal: '/portal',
  acceso: '/portal/acceso',
  registro: '/portal/registro',
  recuperar: '/portal/recuperar',
  nuevaClave: '/portal/nueva-clave',
  solicitud: '/portal/solicitud',
  renovacion: '/portal/renovacion',
  confirmar: '/auth/confirmar',
} as const;

/** La carrera tiene página propia; los cursos cuelgan de /cursos. */
export function rutaDePrograma(codigo: string): string {
  return codigo === 'gastronomia' ? RUTAS.carrera : `${RUTAS.cursos}/${codigo}`;
}

export interface EnlaceDeNavegacion {
  readonly etiqueta: string;
  readonly href: string;
}

export const NAVEGACION: readonly EnlaceDeNavegacion[] = [
  { etiqueta: 'Nosotros', href: RUTAS.nosotros },
  { etiqueta: 'Carrera', href: RUTAS.carrera },
  { etiqueta: 'Cursos', href: RUTAS.cursos },
  { etiqueta: 'Convenios', href: RUTAS.convenios },
  { etiqueta: 'Contacto', href: RUTAS.contacto },
];
